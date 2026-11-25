# Структура проекта NovusWarden

Документ описывает организованную модульную архитектуру **NovusWarden** (Rust-бэкенд + Vue 3 / Vite Web Vault + Vue 3 Admin Control Plane + Vue-Email + единая система локализации `en` / `ru` / `uk`).

```text
NovusWarden/
├── src/                               # Backend (Rust + Rocket + Diesel)
│   ├── main.rs                        # Точка входа, инициализация пула БД и маршрутов
│   ├── config.rs                      # Конфигурация (.env / admin config, web_vault_vue=true)
│   ├── auth.rs                        # JWT, headers/cookies, ClientHeaders, RequestLocale, Headers
│   ├── i18n.rs                        # Загрузка локалей (en/ru/uk), парсинг Accept-Language с q-весами
│   ├── mail.rs                        # Движок отправки (SMTP/Sendmail/Resend) + рендер HTML/Text писем
│   ├── api/                           # REST / Identity / WebSocket / Push / SCIM API
│   │   ├── admin.rs                   # API и маршруты Control Plane (/admin/*)
│   │   ├── identity.rs                # OAuth2, Prelogin, Two-Step Registration, Login & SSO
│   │   ├── notifications.rs           # SignalR/WebSocket хабы синхронизации клиентов
│   │   ├── push.rs                    # Push Relay совместимость с мобильными клиентами
│   │   ├── scim.rs                    # SCIM v2 провижининг пользователей/групп
│   │   ├── web.rs                     # Статические встроенные ресурсы (/vw_static/*), SPA fallback
│   │   └── core/                      # Основные Bitwarden API (/api/*)
│   │       ├── accounts.rs            # Регистрация (Argon2id + culture), профиль, KDF, Auth Requests
│   │       ├── ciphers.rs             # Элементы хранилища, вложения, архив, шарринг
│   │       ├── folders.rs             # Папки хранилища
│   │       ├── organizations.rs       # Организации, роли, коллекции, группы, политики, аудит
│   │       ├── sends.rs               # Bitwarden Sends (текст + файлы)
│   │       ├── emergency_access.rs    # Экстренный доступ
│   │       └── two_factor/            # TOTP, Email 2FA, WebAuthn, Duo, YubiKey, Recovery Code
│   ├── db/models/                     # Модели БД (SQLite, PostgreSQL, MySQL)
│   └── static/
│       ├── locales/{en,ru,uk}/        # 15 JSON-словарей на каждую локаль (100% паритет ключей)
│       ├── templates/email/           # 33 HTML-шаблона (.html.hbs из Vue-Email) + 33 text .hbs + 3 partials
│       ├── admin_ui/                  # Скомпилированный SPA админ-панели для встраивания в бинарник
│       ├── templates/admin/           # Legacy HBS-диагностика (совместимость)
│       ├── scripts/                   # Вспомогательные скрипты и CSS админ-маршрутов
│       └── images/                    # Встраиваемые в бинарник логотипы, иконки и фавиконки
├── frontend/                          # Единое Vue 3 + Vite + TypeScript пространство
│   ├── shared/
│   │   └── i18n.ts                    # Реактивный i18n (ru/uk/en), автодетект navigator.languages, Accept-Language
│   ├── vault/                         # Пользовательский Web Vault (Vue 3 + Pinia + Zero-Knowledge WebCrypto)
│   │   └── src/
│   │       ├── api/client.ts          # Типизированный API-клиент с Accept-Language и culture
│   │       ├── crypto/                # Argon2id (hash-wasm), AES-256-CBC/HMAC, RSA-2048, TOTP, SSH
│   │       ├── stores/                # auth, vault, theme
│   │       └── views/                 # Login, Register, Vault, Organizations, Send, Generator, Sentinel, Settings
│   ├── admin/                         # Панель администратора (Control Plane на Vue 3)
│   │   └── src/
│   │       ├── api/client.ts          # /admin REST-клиент (с динамическим Accept-Language)
│   │       └── views/                 # Dashboard, Users, Organizations, Subscriptions, Settings, Diagnostics
│   └── emails/                        # Система email-шаблонов на Vue-Email
│       ├── compile-emails.mjs         # Pre-compiler .vue -> src/static/templates/email/*.html.hbs
│       └── templates/                 # EmailLayout.vue + 33 шаблона писем с Light/Dark адаптацией
├── docker/                            # Multi-stage Docker сборки + branding overlay
├── docs/                              # Документация, отчёт аудита, архитектура i18n и форка
├── migrations/                        # Diesel миграции БД (sqlite / postgresql / mysql)
├── resources/                         # Исходные графические материалы и документационные ресурсы
│   └── branding/                      # Неиспользуемые в рантайме исходники логотипов NovusWarden
└── tools/                             # Утилиты валидации i18n, watchdog и миграции БД
```

## Поток локализации (Язык браузера → Регистрация → Профиль → Email)

1. **Автоопределение в браузере**: [frontend/shared/i18n.ts](../frontend/shared/i18n.ts) проверяет `localStorage.novus_locale`, затем массив `navigator.languages` / `navigator.language` и формирует заголовок `Accept-Language` для всех запросов Vault и Control Plane.
2. **Уточнение при регистрации и в профиле**:
   - На экране регистрации [RegisterView.vue](../frontend/vault/src/views/RegisterView.vue) автоматически выбранный язык можно подтвердить или сменить; значение передаётся как `culture` в `/identity/accounts/register/send-verification-email` и `/identity/accounts/register/finish` ([identity.rs](../src/api/identity.rs), [accounts.rs](../src/api/core/accounts.rs)).
   - В профиле пользователя ([SettingsView.vue](../frontend/vault/src/views/SettingsView.vue)) сохранение `culture` обновляет `users.locale` в БД через `PUT /api/accounts/profile`.
3. **Серверный резолвер и письма**: [src/i18n.rs](../src/i18n.rs) учитывает `q`-веса и поддерживаемые локали в `Accept-Language`, а [src/mail.rs](../src/mail.rs) передаёт `lang` и `locale_override` во все 33 HTML-письма (`Vue-Email` → `.html.hbs`) и plaintext-версии (`.hbs`).
