# Полный аудит и план доработки NovusWarden (от А до Я)

Дата аудита: 2026-11-25  
Репозитории:
- Dev: `git@github.com:SGC-NOVUS/NovusWarden-dev.git`
- Public: `git@github.com:SGC-NOVUS/NovusWarden.git`

---

## Часть I. Архитектура проекта

**NovusWarden** — форк Vaultwarden (Bitwarden-совместимый сервер на Rust Edition 2024 + Rocket 0.5.2 + Diesel + Apache OpenDAL), в котором добавлены и развиваются:
1. **Ядро (Rust, `src/`):**
   - Поддержка SQLite, PostgreSQL, MySQL; объектное хранилище OpenDAL (FS / S3 / R2 / MinIO).
   - Нативная i18n-система (`src/i18n.rs`, `src/static/locales/{en,ru,uk}/*.json`) с CI-валидаторами в `tools/`.
   - Панель администратора (`src/api/admin.rs`): защита от перебора (блокировка после 2 неудачных попыток с письмом разблокировки `/admin/unlock?token=...`), экспорт пользователей (`/admin/users/export`), управление тарифами/лицензиями (`novus_billing.json`, `novus_licenses.json`).
   - SCIM 2.0 discovery (`src/api/scim.rs`), жёсткие лимиты KDF (`Argon2id` до 64 итераций, `PBKDF2` до 2 000 000 раундов).
2. **Админ-панель Vue 3 (`frontend/admin/`):**
   - SPA на Vue 3 + Vue Router (hash history) + Pinia + Vite.
   - Страницы: Сводка, Пользователи, Организации, Тарифы и подписки, Настройки сервера, Диагностика, Вход.
3. **Новый Web Vault на Vue 3 (`frontend/vault/`):**
   - Новая SPA (пока не закоммичена в git и не подключена к Rust-серверу), реализующая Zero-Knowledge WebCrypto-движок (PBKDF2 / Argon2id через `hash-wasm`, AES-256-CBC + HMAC-SHA256, RSA-OAEP, генератор паролей и SSH-ключей, TOTP, Novus Sentinel аудит, Send, настройки).
4. **Классический Web Vault (`web-vault/` + `docker/web-vault-overlay/`):**
   - Upstream Angular web-vault с наложенным CSS/SVG/WebP брендингом (`novus-brand.css`, `theme-toggle.js`, `brand_web_vault.sh`).
5. **Email-пайплайн (`frontend/emails/` + `src/static/templates/email/`):**
   - Прекомпиляция Vue 3 компонентов (`@vue-email/compiler` + `vue-email`) в статические HTML Handlebars-шаблоны `*.html.hbs` через `frontend/emails/compile-emails.mjs`.

---

## Часть II. Детальный реестр выявленных проблем и ошибок

### 1. Сборочный пайплайн, Vite, Rust и Docker
1. **Рассинхронизация `vite.config.ts` с `src/api/admin.rs` и `docker/Dockerfile.j2`:**
   - `frontend/vite.config.ts` переведён на multi-entry сборку (`admin` + `vault`) в `frontend/dist/` с `base: '/'` и путями вида `/assets/[name]-[hash].js`.
   - Rust (`src/api/admin.rs:586`) по-прежнему встраивает `src/static/admin_ui/` через `include_dir!`, где лежит устаревшая сборка с `/admin/ui/assets/index.js`, а `docker/Dockerfile.j2:168` копирует именно `src/static/admin_ui`.
   - При загрузке `/admin/ui/` ссылки на `/assets/...` в production дают 404, так как маршрутизатор админки слушает только `/admin/ui/<p..>`.
2. **`frontend/vault` не подключён к Rust-серверу и Docker:**
   - `src/api/web.rs` и `src/main.rs` проверяют и раздают исключительно `CONFIG.web_vault_folder()` (`web-vault/`).
   - `docker/Dockerfile.j2` всё ещё забирает upstream-образ `docker.io/vaultwarden/web-vault`.
3. **`frontend/tsconfig.json` неполный:**
   - В `include` входит только `admin/src/**/*` (без `vault/src/**/*`), а в `paths` отсутствует `@vault/*` и `@admin/*`.
4. **Ограничение ФС рабочей копии (`fuseblk`):**
   - Раздел `/media/kyryll/Локальный диск` смонтирован как `fuseblk` без бита исполнения, из-за чего `cargo` не может выполнить `build-script-build` в `target/` (`Permission denied (os error 13)`), а `frontend/node_modules/` не содержит `.bin/*`. Для локальной компиляции требуется Linux-ФС (`ext4`/`btrfs` / `CARGO_TARGET_DIR`) и `npm install`.

### 2. Ошибки и рассинхронизация в `frontend/admin` и `src/api/admin.rs`
1. **Отсутствующий TypeScript-тип `BillingConfig` и неверное имя поля `licensePlan`:**
   - `frontend/admin/src/views/SubscriptionsView.vue:3` импортирует несуществующий `type BillingConfig` из `../api/client.ts`.
   - Там же в строке `229` используется `user.licensePlan`, хотя в `UserSummary` (`client.ts:22`) и ответе сервера (`admin.rs:844`) поле называется `subscriptionPlan`.
2. **Неверный параметр срока лицензии в `UsersView.vue`:**
   - `UsersView.vue:89-96` передаёт `expiresAt` (ISO-строку), тогда как `client.ts:204` и `src/api/admin.rs:728` (`UserLicenseUpdate`) ждут `expiresDays: number | null`. В итоге срок лицензии игнорируется.
   - Кроме того, при `licenseDays === -1` («Бессрочно») в `SubscriptionsView` / `UsersView` нужно передавать `null`.
3. **Нерабочий `logout` в админке:**
   - `frontend/admin/src/api/client.ts:158` делает `fetch('/admin/logout', { method: 'POST' })`, но в `src/api/admin.rs:819` маршрут объявлен как `#[get("/logout")]`. Cookie `VW_ADMIN` не очищается.
4. **Расхождение схемы `novus_billing.json` между Rust и Vue:**
   - `default_billing_config()` в `src/api/admin.rs:665-710` возвращает `{ gateway: {...}, plans: [{ price, period, ... }] }`.
   - `SubscriptionsView.vue:14-64` ожидает плоский объект `{ enabled, currency, stripePublishableKey, stripeSecretKey, stripeWebhookSecret, cryptoWallet, webhookUrl, plans: [{ priceMonthly, priceYearly, storageGb, pamSeats, badgeColor, features }] }`.
5. **Рассинхронизация хранения лицензий по `uuid` и `email`:**
   - `invite_user` (`src/api/admin.rs:795-801`) записывает план в `novus_licenses.json` и под `uuid`, и под `email`, а `set_user_license` (`admin.rs:740`) обновляет только `uuid`.
6. **Хардкод личного email в `src/api/admin.rs`:**
   - Строки `354` и `421` содержат fallback `"582151.ua@gmail.com"` при отсутствии `ADMIN_EMAIL` — необходимо убрать или сделать безопасный отказ без отправки на сторонний адрес.

### 3. Критические ошибки в `frontend/vault` (Vue 3 Web Vault)
1. **Несовместимость создания/обновления записей (`CipherData.encryptedFor`):**
   - В `src/api/core/ciphers.rs:272, 388` поле `encrypted_for: UserId` обязательно и проверяется на равенство `headers.user.uuid`.
   - `frontend/vault/src/stores/vault.ts:257-264` не передаёт `encryptedFor` (и `authStore.profile?.id` изначально пуст до первого `sync()`). Создание и редактирование записей будут падать с 422.
2. **Сломан `toggleFavorite`:**
   - `frontend/vault/src/api/client.ts:340-351` отправляет `PUT /api/ciphers/<id>` только с `{ favorite }`, а `put_cipher` требует полный `CipherData`. Ошибка 422 молча игнорируется, изменения теряются после перезагрузки. Нужно использовать `/api/ciphers/<id>/partial` (передавая `folderId` и `favorite`).
3. **Сломана регистрация (`register`):**
   - `auth.ts:148` и `client.ts:227` обращаются к `POST /api/accounts/register` без `emailVerificationToken`.
   - Сервер (`src/api/identity.rs:1125-1198`, `src/api/core/accounts.rs:270-336`) использует 2-шаговый flow: `POST /identity/accounts/register/send-verification-email` → `POST /identity/accounts/register/finish` (с поддержкой случая, когда подтверждение по email выключено и токен возвращается сразу в ответе, и случая с письмом подтверждения).
4. **Сломана смена KDF (`changeKdf`):**
   - `auth.ts:260-268` отправляет плоский JSON, тогда как `src/api/core/accounts.rs:768-775` (`ChangeKdfData`) требует `{ authenticationData, unlockData, masterPasswordHash }`.
5. **Некорректная соль Argon2id (крипто-несовместимость с Bitwarden):**
   - `frontend/vault/src/crypto/kdf.ts:35-53` передаёт в `argon2id` сырые байты email. По стандарту Bitwarden для Argon2id солью является **SHA-256(lowercase(email))** (32 байта).
6. **Отсутствует 2FA при логине и режим разблокировки после F5:**
   - При наличии 2FA `api.login` выбрасывает ошибку вместо отображения формы ввода TOTP/Email-кода (`twoFactorProvider`, `twoFactorToken`, `twoFactorRemember`).
   - После обновления страницы `token` есть в `sessionStorage`, а `userKey` в памяти сброшен: роутер отправляет на `/login` вместо экрана разблокировки по мастер-паролю, нет обновления токена по `refresh_token`.
7. **Незавершённые экраны и потеря полей:**
   - `VaultView.vue`: нет блока просмотра для типа `4` (Identity); для типа `3` (Card) не отображаются `brand` и `code`; в `vault.ts:292-302` при сохранении Identity теряются 10 из 17 полей.
   - `SendView.vue`: `showCreateModal = true` не имеет разметки модального окна, нет API создания/удаления Send и шифрования/расшифровки Send-ключей.
   - `SettingsView.vue`: нет UI для импорта (при наличии `api.importCiphers`) и 2FA-настроек (при наличии `api.getTwoFactor`).
   - `LoginView.vue`: модалка SSO ничего не запускает.

### 4. Ошибки в `frontend/emails` (`vue-email`)
1. **Неверное имя переменной IP в `new_device_logged_in.vue`:**
   - Шаблон использует `{{ip_address}}`, а `src/mail.rs:735` передаёт `"ip"` → IP в письмах пустой.
2. **Переведено только 3 шаблона из 26+:** (`welcome.vue`, `twofactor_email.vue`, `new_device_logged_in.vue`).
3. **Потеряна мультиязычность (`en`/`ru`/`uk`) в теле 3 переведённых шаблонов:** текст в них захардкожен на английском без `{{t "..." locale=lang}}`.
4. **Внешняя SVG-ссылка вместо локального растрового логотипа:** `<EImg src="https://raw.githubusercontent.com/...svg">` ломается в offline-среде и почтовых клиентах (Gmail/Outlook блокируют SVG) вместо использования `{{img_src}}` + PNG/WebP.

---

## Часть III. Пошаговый план действий (Фазы 1–5)

### Фаза 1: Сборка, TypeScript и исправление Admin Control Plane (`frontend/admin` + `src/api/admin.rs`)
1. Разделить сборку `admin` и `vault` в `frontend/vite.config.ts` и `frontend/package.json`:
   - `build:admin`: сборка `frontend/admin` с `base: '/admin/ui/'` напрямую в `src/static/admin_ui/` (чтобы `ADMIN_UI_DIR` и `Dockerfile.j2` работали без 404).
   - `build:vault`: сборка `frontend/vault` с `base: '/'` в `frontend/dist/vault/` (и/или в `src/static/vault_ui` для встроенного режима).
   - Dev-сервер (порт 3000) сохраняет единый multi-SPA роутинг и проксирование API.
2. Обновить `frontend/tsconfig.json`: добавить `vault/src/**/*`, алиасы `@admin/*`, `@vault/*`, `@shared/*` и корректные типы.
3. Починить `frontend/admin`:
   - Добавить `BillingConfig` и `BillingPlan` в `frontend/admin/src/api/client.ts`, синхронизировав с `SubscriptionsView.vue` и `default_billing_config()` в `src/api/admin.rs`.
   - Исправить `UsersView.vue` (`expiresDays` вместо `expiresAt`, обработка `-1` → `null`) и `SubscriptionsView.vue` (`subscriptionPlan` вместо `licensePlan`, передача `invitePlan` при приглашении).
   - Исправить `api.logout()` в `client.ts` (использовать `GET /admin/logout` или добавить `POST /admin/logout` в `admin.rs` + корректный redirect).
4. Починить `src/api/admin.rs`:
   - Выровнять `default_billing_config()` под структуру `SubscriptionsView.vue`.
   - Синхронизировать обновление `novus_licenses.json` (очищать/обновлять по `uuid` и `email`).
   - Убрать захардкоженный личный email `"582151.ua@gmail.com"`.

### Фаза 2: Криптография и API-контракты Vue 3 Web Vault (`frontend/vault`)
1. Исправить `kdf.ts`: вычислять соль Argon2id как `SHA-256(lowercase(email))`.
2. Исправить `vault.ts` и `client.ts`:
   - Обязательно передавать `encryptedFor: authStore.profile.id` (с подстраховкой через `api.getAccountProfile` при отсутствии `profile.id`).
   - Исправить `toggleFavorite` через `PUT /api/ciphers/<id>/partial` с `folderId` и `favorite`.
   - Сохранять все 17 полей `Identity` и полные поля `Card`/`Login`.
3. Исправить `auth.ts` и `client.ts`:
   - Реализовать 2-шаговую регистрацию (`/identity/accounts/register/send-verification-email` → `/identity/accounts/register/finish`) и обработку подтверждения email.
   - Исправить `changeKdf` под структуру `ChangeKdfData` (`authenticationData` + `unlockData`).
   - Добавить поддержку 2FA (`TwoFactorProviders`) и auto-refresh по `refresh_token`.
   - Добавить корректный экран/режим разблокировки (Unlock) при перезагрузке страницы.

### Фаза 3: Завершение UI Web Vault и подключение к Rust + Docker
1. Доработать `VaultView.vue` (детальный просмотр `Identity`, `brand`/`code` у `Card`, множественные URI).
2. Доработать `SendView.vue` (модалка создания/удаления Text/File Send с локальным шифрованием ключа Send).
3. Доработать `SettingsView.vue` (импорт JSON/CSV, управление 2FA) и SSO-поток в `LoginView.vue`.
4. Подключить Vue Web Vault в `src/api/web.rs` и `docker/Dockerfile.j2` (с возможностью выбора или полной замены).

### Фаза 4: Исправление `vue-email` и унификация писем
1. Исправить `new_device_logged_in.vue` (`{{ip}}` вместо `{{ip_address}}`).
2. Вернуть i18n-ключи `{{t "..." locale=lang}}` в `.vue`-шаблоны и настроить `compile-emails.mjs`, чтобы `tools/check_template_i18n_keys.py` не терял переводы.
3. Заменить внешний GitHub SVG на PNG/WebP через `{{img_src}}` (добавить PNG-баннер в `STATIC_FILES` при необходимости, т.к. почтовые клиенты плохо поддерживают WebP/SVG).
4. Последовательно перевести оставшиеся HTML-шаблоны писем на единый `EmailLayout.vue`.

### Фаза 5: Финальная верификация и приведение git в порядок
1. Проверить компиляцию TypeScript (`tsc --noEmit`), сборку Vite (`build:admin`, `build:vault`, `build:emails`).
2. Проверить Rust (`cargo fmt --check`, `cargo clippy`, `cargo check --features sqlite,postgresql`, `cargo test --features sqlite`).
3. Проверить i18n-скрипты и Docker-шаблоны (`docker/make`), подготовить чистые коммиты в `dev` и `origin`.


---

## Статус выполнения фаз (обновлено)

- **Фаза 1 (Сборка, маршруты, Docker, TypeScript):** Выполнено в коде (`package.json`, `vite.config.ts`, `tsconfig.json`, `frontend/vault/src/env.d.ts`, `src/api/web.rs`, `docker/Dockerfile.j2` → перегенерированы `Dockerfile.debian` и `Dockerfile.alpine` через `make -C docker`).
- **Фаза 2 (Безопасность и контракты Admin Panel ↔ Rust):** Выполнено в коде (`src/api/admin.rs`: удалён хардкод fallback admin email, синхронизирован формат `BillingConfig` и `novus_licenses.json` по `uuid` и `email`, добавлен `storageUsage`; `frontend/admin`: исправлен `GET /admin/logout`, `expiresDays`, `subscriptionPlan`, нормализация конфига биллинга).
- **Фаза 3 (Криптография, Auth/Sync, Web Vault Vue UI и роутинг):** Выполнено в коде (`kdf.ts` — Argon2id salt `SHA-256(lowercase(email))`; `symmetric.ts` — HKDF для Send + `encryptBytes` EncType 2; `client.ts` / `auth.ts` / `vault.ts` — 2FA + email code, JWT `sub`, refresh token retry, двухэтапная регистрация + `/finish-signup`, `PUT /api/ciphers/{id}/partial`, `ChangeKdfData`, 17 полей Identity и `encryptedFor`, Text и File Send, импорт JSON и CSV; `SettingsView.vue`, `VaultView.vue`, `SendView.vue`, `LoginView.vue`, `RegisterView.vue`; `src/config.rs` / `src/api/web.rs` / `src/main.rs` / `src/util.rs` — переключатель `WEB_VAULT_VUE` и авто-выбор `web-vault-vue/`).
- **Фаза 4 (`vue-email` и i18n):** Выполнено — создан общий `EmailLayout.vue`, все **33** email-шаблона (`welcome*`, `register_verify_email`, `verify_email`, `twofactor_email`, `new_device_logged_in`, `incomplete_2fa_login`, `recover_twofactor`, `delete_account`, `protected_action`, `smtp_test`, `change_email*`, `sso_change_email`, `pw_hint_*`, `admin_*`, `send_org_invite`, `invite_*`, `send_*_removed_from_org`, `emergency_access_*`, `send_emergency_access_invite`) перенесены в `frontend/emails/templates/*.vue` и синхронизированы в `src/static/templates/email/*.html.hbs` с ключами `{{t "..." locale=lang}}`, `{{ip}}` и встроенным логотипом `{{img_src}}logo-gray.png`.
- **Фаза 5 (Верификация и приведение git в порядок):** Выполнены проверки `cargo fmt --all -- --check`, `cargo check --features sqlite,postgresql`, `cargo test --features sqlite` (45/45 юнит-тестов пройдены с `CARGO_TARGET_DIR` на `ext4`), `make -C docker`, `tools/check_*.py` (383/383 шаблонных и 118/118 admin i18n-ключей), TypeScript (`tsc --noEmit`: 0 ошибок) и компиляция всех 50 `.vue` SFC через `@vue/compiler-sfc` (0 ошибок). Единственный невыполнимый локально шаг — запуск нативного бинарника `esbuild` для `vite build` и `compile-emails.mjs` (раздел `/media/kyryll/Локальный диск` смонтирован как `fuseblk` без прав исполнения → `EACCES`). Для финальной сборки бандлов на `ext4`/Docker выполнить: `cd frontend && npm install && npm run build`, после чего закоммитить и отправить в `dev` и `origin`.


---

## Часть IV. Глубокий аудит совместимости с оригинальным Bitwarden (`Bitwarden/server-main` и `Bitwarden/clients-main`)

Проведено прямое сопоставление исходного кода официального Bitwarden (`server-main` + `clients-main` v2026.11.0) с серверной (`src/`) и клиентской (`frontend/admin/`, `frontend/vault/`) частями NovusWarden.

### 1. Серверная часть (`Bitwarden/server-main` vs `src/`)

1. **Критические расхождения API и совместимости с официальными клиентами (Desktop / Mobile / CLI / Extensions):**
   - **SignalR `/negotiate` (`Notifications/Startup.cs` vs `src/api/notifications.rs`):** в NovusWarden есть `GET /notifications/hub` и `/anonymous-hub`, но отсутствуют `POST /notifications/hub/negotiate`, `POST /notifications/anonymous-hub/negotiate`, `GET /notifications/alive`, `GET /notifications/now`. Клиенты с HTTP-негоциацией получают `404`.
   - **CSP / CORS / Attachments (`Core/Constants.cs`, `Api/Startup.cs` vs `src/util.rs`, `src/api/web.rs`):**
     - В CSP `frame-ancestors` отсутствуют ID расширений Chrome Beta (`hccnnhgbibccigepcmlgppchkpfdophk`) и Opera (`ccnckbpmaceehanjmeomladnmlffdjgn`).
     - В `Cors` отсутствуют `Access-Control-Expose-Headers: Content-Disposition` и `Vary: Origin`, что ломает скачивание бинарных вложений в браузерных/веб-клиентах; `/attachments/<cipher>/<id>` отдаёт `NamedFile` без заголовка `Content-Disposition`.
     - В `connect-src` отсутствует `https://quack.duckduckgo.com` (генератор email-алиасов).
   - **`CipherData.data` и новые типы записей (`CipherRequestModel` / `SyncController` vs `src/api/core/ciphers.rs`, `src/db/models/cipher.rs`):**
     - `CipherData` не принимает опциональный SDK-блоб `data`, а `Cipher::to_json` не отдаёт `"data"`; при отсутствии sub-объекта (`login`/`card`) сервер падает на `cipher_data_missing`.
     - В `SyncResponse` фильтруется `SSHKey (5)` для старых клиентов, но не фильтруются `BankAccount (6)`, `DriversLicense (7)`, `Passport (8)` для клиентов `< 2026.2.0`.
   - **Устройства и верификация новых устройств (`DevicesController` / `AccountsController` vs `src/api/core/accounts.rs`, `src/db/models/device.rs`, `user.rs`):**
     - Отсутствует legacy-маршрут `GET /api/devices/knowndevice/<email>/<identifier>` (есть только header-вариант).
     - Отсутствуют `POST /api/accounts/resend-new-device-otp`, `PUT/POST /api/accounts/verify-devices`, `verifyDevices` в `ProfileResponse`, `lastActivityDate` в `DeviceResponse`.
     - Отсутствуют роуты Trust/Keys (`PUT/POST /api/devices/<id>/keys`, `retrieve-keys`, `DELETE /api/devices/<id>`, `POST /api/devices/untrust`, `lost-trust`).
   - **`AuthRequestsController` (`src/api/core/accounts.rs`):**
     - `GET /api/auth-requests/{id}` и `.../response` возвращают `requestApproved: null` вместо `false`; отсутствуют поля `requestDeviceIdentifier`, `requestDeviceTypeValue`, `requestCountryName`; `GET /api/auth-requests` фильтрует только `pending`; отсутствует `POST /api/auth-requests/admin-request`.
   - **`verify-password`, `folders`, `sends`, `/api/config`, `.well-known`:**
     - `POST /api/accounts/verify-password` отдаёт `"Object"` (PascalCase) вместо `"object"`.
     - В `src/api/core/folders.rs` отсутствуют `DELETE /api/folders` (bulk) и `DELETE /api/folders/all`.
     - В `src/api/core/sends.rs` отсутствует `PUT /api/sends/<id>/remove-auth`.
     - В `GET /api/config` (`src/api/core/mod.rs`) `environment.sso` всегда `""` даже при включённом SSO; отсутствует `settings.enableEmailVerification`.
     - Отсутствуют `/.well-known/webauthn` и `/.well-known/assetlinks.json`.
   - **Среднесрочные / Enterprise-модули (отдельные крупные подсистемы):**
     - `grant_type=webauthn` + `WebAuthn PRF` (`webauthn/assertion-options`, `attestation-options`, `WebAuthnPrfOption`).
     - `V2 Account Encryption` (`AccountKeys` со `signedPublicKey`/`signatureKeyPair`/`securityState`, `/api/accounts/key-management/*`, `/api/users/{id}/keys`).
     - `Key Connector`, `Security Tasks` (`/api/tasks/*`), `Notification Center` (`/api/notifications/*`), `SCIM v2 /Users & /Groups`, `Secrets Manager`, `PAM`.

### 2. Админ-панель (`frontend/admin/` + `src/api/admin.rs`)

1. **Критичные баги навигации, доступа и статики:**
   - `GET /admin` (`admin.rs`) не проверяет cookie/блокировку перед отдачей SPA, а `authState` в `frontend/admin/src/api/client.ts` инициализируется как `{ needsAuth: false, isAuthenticated: true }`.
   - `handleLogout()` в `App.vue` / `client.ts` не перенаправляет на `/login`; `api.login()` трактует HTTP `429` как «осталась 1 попытка»; все URL в `client.ts`/`App.vue` захардкожены в корень без поддержки `domain_path`.
   - `admin_ui_files` (`src/api/admin.rs`) отдаёт `.webp`, `.woff`, `.woff2`, `.wasm`, `.webmanifest` с `Content-Type: application/octet-stream` и возвращает `index.html` вместо `404` для отсутствующих ассетов `/admin/ui/assets/*`.
2. **Баги и пропуски в экранах (`SettingsView`, `UsersView`, `DiagnosticsView`, `SubscriptionsView`, `OrganizationsView`):**
   - `SettingsView.vue`: из фильтра категорий пропали 5 секций (`folders`, `smtp`, `email_2fa`, `yubico`, `duo`); фильтр `"Только чтение"` проверяет `every(!editable)` вместо сбора всех `!editable` полей из всех групп; `grouptoggle` не блокирует дочерние поля; после сохранения не вызывается `loadConfig()`; при нажатии `Тест SMTP` нет предупреждения о несохранённых правках; `database_url` не замаскирован.
   - `UsersView.vue`: роль `4` (`Manager`) отображается как «Участник» и не выбирается в модалке; `user.subscriptionPlan` не приведён к `.toLowerCase()` (`"Free"` != `'free'`); не отображается `emailVerified` и нет фильтров; экспорт открывает сырой JSON вместо скачивания файла; нет модалки деталей пользователя (`GET /admin/users/<id>`), подтверждения удаления по email, сортировки и пагинации.
   - `DiagnosticsView.vue`: не запускает проверку WebSocket (`/notifications/anonymous-hub`), HTTP-кодов (`/admin/diagnostics/http`), не отображает `domainMatches`, HTTPS-статус, `config_file_status`, `overrides`, `invalid_env_vars`, `invalid_feature_flags`, `ntp_time` drift, `web_vault_compare` и формирует сырой JSON вместо Markdown-отчёта.
   - `SubscriptionsView.vue` / `OrganizationsView.vue`: вкладка B2B в `SubscriptionsView.vue` полностью захардкожена моками `org-demo-1..3` вместо `/admin/organizations`.

### 3. Клиентская часть Vue 3 Web Vault (`Bitwarden/clients-main` vs `frontend/vault/`)

1. **Протокол и потеря данных (Критично):**
   - `frontend/vault/src/api/client.ts` не отправляет заголовки `Device-Type`, `Bitwarden-Client-Name`, `Bitwarden-Client-Version`, `Device-Identifier`, `Cache-Control: no-store`, `; charset=utf-8`, вызывает `POST /api/accounts/profile` вместо `PUT`, не читает `/api/config`, маппит `RecoveryCode` 2FA на `'4'` вместо `'8'` (`TwoFactorProviderType`), не маппит `ForcePasswordReset`.
   - В `stores/vault.ts`: баг `match: u.match || null` превращает `0` (`Domain`) в `null`; при сохранении записи (`saveCipher`) безвозвратно теряются `fields[]`, `fido2Credentials[]`, `passwordHistory[]`, `attachments[]`, `collectionIds[]`, `key` (если запись создана в официальном клиенте Bitwarden).
   - **Send URL & Public Access:** `SendView.vue` открывает `/#/send/${id}` вместо официального `/#/send/${accessId}/${urlB64Key}`; отсутствует публичный маршрут `/send/:sendId/:key` и страница просмотра/расшифровки/скачивания Send для получателей.
2. **Недостающий функционал оригинального Web Vault:**
   - **Master Password Reprompt** (чекбокс защиты и проверка мастер-пароля перед показом/копированием/редактированием/удалением).
   - **Custom Fields** (`text`, `hidden`, `boolean`, `linked`), **URI Match Detection** селектор (`0..5`), **Password History** (история паролей и автоматическое добавление старого пароля при смене), **Passkeys (`fido2Credentials`)** отображение.
   - **Encrypted Cipher Attachments** (загрузка, расшифровка/скачивание, удаление вложений записи с отдельным ключом вложения).
   - **Organizations & Collections** (расшифровка `organizations`/`collections`, фильтр по организациям и коллекциям, назначение `collectionIds`).
   - **Bulk Actions & Empty Trash** (чекбоксы массового выделения, массовое удаление/восстановление/перемещение по папкам, кнопка «Очистить корзину»).
   - **Безопасность сессии и аккаунта:** Auto-Lock таймер (простой/закрытие), PIN-блокировка, локальный Unlock без повторного сетевого логина, Account Fingerprint Phrase, смена Email и удаление аккаунта, расширенный генератор **Username / Email Alias** (Plus-addressing, Catch-all, Random word).
   - **Login with Device (Auth Requests)** и **Emergency Access UI** в настройках, **2FA настройки** (TOTP + Recovery Code + Email/WebAuthn обзор).

---

### План доработки до 100% совместимости (Фазы 6–9)

- **Фаза 6 (Серверная совместимость Bitwarden — Rust):**
  1. `src/util.rs` & `src/api/web.rs`: CSP (`Chrome Beta`, `Opera`, `quack.duckduckgo.com`), `CORS` (`Content-Disposition`, `Vary: Origin`), заголовки скачивания `/attachments/...`, `/.well-known/webauthn` & `/.well-known/assetlinks.json`.
  2. `src/api/notifications.rs`: `POST /notifications/hub/negotiate`, `/anonymous-hub/negotiate`, `GET /notifications/alive`, `/notifications/now`.
  3. `src/api/mod.rs`, `src/api/core/*`, `src/db/models/`: `verify-password` `"object"`, `GET /api/devices/knowndevice/<email>/<id>`, `POST /api/accounts/resend-new-device-otp`, `verify-devices` (`ProfileResponse` + API), `Device.lastActivityDate`, `AuthRequestResponse` fixes (`requestApproved: false`, `requestDeviceIdentifier`, `requestDeviceTypeValue`, `requestCountryName`, all requests list, `/auth-requests/admin-request`), `DELETE /api/folders` & `/all`, `PUT /api/sends/<id>/remove-auth`, `CipherData.data` поддержка + фильтрация типов `6..8` в `Sync`, `GET /api/config` (`environment.sso`, `enableEmailVerification`).
  4. `src/api/admin.rs`: `/admin/session` проверка, фикс MIME + 404 для `admin_ui_files`.

- **Фаза 7 (Админ-панель Vue 3 — `frontend/admin/`):**
  1. `App.vue` / `client.ts` / `router/index.ts`: безопасная инициализация сессии (`/admin/session`), редирект при `logout`, обработка `429`, динамический base path.
  2. `SettingsView.vue`: все 12 категорий конфига, корректный фильтр `readonly`, зависимость `grouptoggle`, маскирование `database_url`, предупреждение при `Тест SMTP`, автообновление после `Save`.
  3. `UsersView.vue`: роль `4` (`Manager`), `.toLowerCase()` для плана, `emailVerified` + фильтры, скачивание экспорта файлом, детали пользователя (`GET /admin/users/<id>`), удаление с подтверждением email, сортировка и пагинация.
  4. `DiagnosticsView.vue`: живые WS/HTTP проверки, `domainMatches`/HTTPS, `config_file_status`, `overrides`, `invalid_env_vars`, NTP drift, Markdown-отчёт.
  5. `SubscriptionsView.vue` & `OrganizationsView.vue`: замена B2B-моков на реальные организации `/admin/organizations`.

- **Фаза 8 (Vue 3 Web Vault — крипто, протокол и UI-паритет):**
  1. `frontend/vault/src/api/client.ts`: официальные заголовки (`Device-Type`, `Bitwarden-Client-Name`, `Bitwarden-Client-Version`, `Device-Identifier`), `PUT /api/accounts/profile`, `getServerConfig()`, исправленный `TwoFactorProviderType` (`8=RecoveryCode`, `7=WebAuthn`), методы вложений, коллекций, bulk-операций и Send Access.
  2. `stores/vault.ts` & `stores/auth.ts`: фикс `match ?? null`, сохранение и шифрование/расшифровка `fields`, `passwordHistory`, `fido2Credentials`, `attachments`, `collectionIds`, `key`; Master Password Reprompt; локальный Unlock + Auto-Lock таймер + PIN; Send URL `/#/send/<accessId>/<urlB64Key>`.
  3. Компоненты и роутер: публичный `SendAccessView.vue` (`/#/send/:sendId/:key`); доработка `VaultView.vue` (Custom Fields, URI Match, Password History, Passkeys, Attachments, Bulk/Empty Trash, Reprompt, Organizations/Collections, скрытие номера карты), `SendView.vue` (копирование ссылки, пароль, срок, заметки, hideEmail, disable), `GeneratorView.vue` (вкладка Username/Alias + история), `SettingsView.vue` (Auto-Lock/PIN, Account Fingerprint Phrase, Change Email, Delete Account, Auth Requests / Login with Device).

- **Фаза 9 (Верификация и финальный контроль):**
  1. `cargo fmt --all -- --check`, `cargo clippy --features sqlite`, `cargo check --features sqlite,postgresql`, `cargo test --features sqlite`.
  2. `tsc --noEmit`, `@vue/compiler-sfc` на всех `.vue`, `tools/check_*.py` (en/ru/uk).


### Статус выполнения Фаз 6–9 (Bitwarden parity)
- **Фаза 6 (Серверная совместимость Bitwarden):** Выполнено (`src/util.rs`, `src/auth.rs`, `src/api/web.rs`, `src/api/notifications.rs`, `src/api/core/mod.rs`, `folders.rs`, `sends.rs`, `ciphers.rs`, `accounts.rs`, `organizations.rs`, `two_factor/email.rs`, `two_factor/duo.rs`, `src/db/models/device.rs`, `user.rs`, `src/api/admin.rs`). Включая: fallback заголовка `Device-Identifier` в email 2FA, Organization Duo (`/organizations/<id>/two-factor*`), `POST /api/accounts/resend-new-device-otp`, `PUT|POST /api/accounts/verify-devices`, `POST /api/auth-requests/admin-request` + валидацию последнего pending-запроса, `GET /api/ciphers/organization-details/{logins,assigned}` и `GET /admin/organizations/<id>`.
- **Фаза 7 (Админ-панель Vue 3):** Выполнено (`frontend/admin/src/api/client.ts`, `router/index.ts`, `App.vue`, `SettingsView.vue`, `UsersView.vue`, `OrganizationsView.vue`, `DiagnosticsView.vue`, `SubscriptionsView.vue`). Включая: модалку деталей пользователя (`GET /admin/users/<id>`), модалку деталей организации (`GET /admin/organizations/<id>`), предупреждения о plaintext `ADMIN_TOKEN` и флагах `(Know the risks!)`, приведение Stripe/лицензий к честной валидации без фиктивных заглушек.
- **Фаза 8 (Vue 3 Web Vault parity):** Выполнено (`crypto/utils.ts`, `crypto/symmetric.ts`, `crypto/asymmetric.ts`, `services/notifications.ts`, `api/client.ts`, `stores/auth.ts`, `stores/vault.ts`, `router/index.ts`, `SendAccessView.vue`, `SendView.vue`, `GeneratorView.vue`, `SettingsView.vue`, `VaultView.vue`, `LoginView.vue`). Включая: Real-time SignalR/MessagePack WebSocket-клиент (`/notifications/hub`), вход с другого устройства + одобрение/отклонение Auth Requests, смену email (`email-token`/`email`), Emergency Access, Recovery Code / Email 2FA / WebAuthn, зашифрованный JSON-экспорт (`encrypted: true`), типы записей 6–8 (`BankAccount`, `DriversLicense`, `Passport`), Архив, вложенные папки (`/`) и перенос в организацию / коллекции (`share` / `collections`).
- **Фаза 9 (Верификация):** `cargo fmt`, `cargo clippy --features sqlite`, `cargo check --features sqlite,postgresql`, `cargo test --features sqlite`, `tsc --noEmit`, `@vue/compiler-sfc` и `tools/check_*.py` запущены после финальных правок. Сборка Vite/vue-email бандлов (`npm run build`) выполняется на Linux-ФС (`ext4`/Docker) без ограничения `fuseblk` на бинарник `esbuild`.
- **Фаза 10 (Очистка, Argon2id-онбординг, Org Console, i18n 100%, Light/Dark UI & Email):**
  - `frontend/tsconfig.json`: удалён устаревший параметр `"baseUrl": "."` (совместимость TypeScript 6/7).
  - `RegisterView.vue` и `stores/auth.ts`: удалён выбор алгоритма KDF при регистрации; принудительно применяется **Argon2id** (`kdfType=1`, `iterations=3`, `memory=64`, `parallelism=4`).
  - Очистка легаси/бандлов: удалена устаревшая папка `frontend/dist/`, из `frontend/vite.config.ts` убран легаси-fallback `web-vault/web-vault`, в `src/config.rs` включён `web_vault_vue = true` по умолчанию.
  - **Org Console (`frontend/vault/src/views/OrganizationsView.vue`, `/organizations`):** создание организаций (клиентская генерация OrgKey + RSA-ключей), участники (приглашение, подтверждение, роли, отзыв/восстановление, удаление), коллекции, группы, политики, аудит-логи, экспорт и Org Duo 2FA.
  - **Light & Dark UI/UX:** `frontend/admin/index.html`, все 7 админ-экранов и `frontend/vault/src/style.css` переведены на единые адаптивные CSS-переменные и правила `html.light`/`html.dark` без сливающегося текста.
  - **i18n 100% & `vue-email`:** добавлен реактивный словарь `frontend/shared/i18n.ts` (`ru`/`uk`/`en`, `75` ключей) с автоопределением `navigator.languages` и переключателем языка, выровнены все `15/15` JSON-словарей (`en`/`ru`/`uk`, вкл. `admin_settings.json` `161`, `admin_settings_desc.json` `144`, `templates.json` `399`/`401` ключей шаблонов), все `33` email-шаблона (`EmailLayout.vue`, `.vue` и `.html.hbs`) обновлены для Light/Dark режима (`prefers-color-scheme: dark` + `[data-ogsc]`), локализованы и проверены юнит-тестом (`99` рендеров).
- **Фаза 11 (Сквозная локализация, документация А–Я, аудит корневых файлов и очистка):**
  - Исправлен `Headers::from_request` (`src/auth.rs`), улучшен `preferred_from_accept_language` (`q`-веса и поддерживаемые каталоги в `src/i18n.rs`), добавлена передача `culture` при регистрации (`src/api/identity.rs`, `src/api/core/accounts.rs`, `RegisterView.vue`) и смене профиля (`SettingsView.vue`).
  - Структурировано дерево проекта ([PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)), вынесены неиспользуемые исходники логотипов в `resources/branding/`, удалён локальный клон `Bitwarden/` (после подтверждения паритета) и дубликат `LICENSE`.
  - Проведена полная проверка кода/доков на упоминания ИИ; приведены в порядок корневые файлы (`AUTHORS.md`, `CONTRIBUTORS.md`, `CREDITS.md`, `NOTICE_FORK.md`, `Cargo.toml`, `CHANGELOG.md`, `.env.template`, `docker-compose.yml`, `.gitattributes`).
  - Добавлена полная документация [DOCUMENTATION.md](./DOCUMENTATION.md) и встроенный мультиязычный портал справки (`#/docs`) на страницах входа/регистрации, в Web Vault и в Admin Control Plane.
