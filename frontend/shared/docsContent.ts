import type { SupportedLocale } from './i18n.ts';

export type DocsTabId = 'overview' | 'users' | 'orgs' | 'admin' | 'security';

export interface DocsSectionCard {
  title: string;
  badge?: string;
  body: string;
  bullets: string[];
  code?: string;
}

export interface DocsTabContent {
  id: DocsTabId;
  label: string;
  summary: string;
  cards: DocsSectionCard[];
}

export interface DocsBundle {
  heroTitle: string;
  heroSubtitle: string;
  backVault: string;
  backAdmin: string;
  backLogin: string;
  goSignup: string;
  tabs: DocsTabContent[];
}

export const DOCS_CONTENT: Record<SupportedLocale, DocsBundle> = {
  ru: {
    heroTitle: 'Документация, возможности и безопасность NovusWarden',
    heroSubtitle:
      'Полное руководство для пользователей, команд и администраторов • Архитектура Zero-Knowledge • SGC-NOVUS',
    backVault: '← В хранилище',
    backAdmin: '← В панель управления',
    backLogin: '← Войти в аккаунт',
    goSignup: 'Создать аккаунт',
    tabs: [
      {
        id: 'overview',
        label: 'Возможности',
        summary:
          'NovusWarden — высокопроизводительный корпоративный менеджер паролей на базе Rust, Vue 3 и протокола Bitwarden/Vaultwarden, модернизированный командой SGC-NOVUS.',
        cards: [
          {
            title: '100% совместимость с клиентами Bitwarden',
            badge: 'Protocol Parity',
            body: 'Подключайте официальные браузерные расширения (Chrome, Firefox, Edge, Safari, Opera), десктопные и мобильные приложения (Windows, macOS, Linux, iOS, Android) и Bitwarden CLI.',
            bullets: [
              'Поддержка OAuth2 Identity (`/identity/connect/token`), Prelogin KDF и 2-шаговой регистрации',
              'Мгновенная синхронизация через SignalR WebSocket (MessagePack) и Push Relay',
              'Поддержка типов записей: Логины, Карты, Личные данные, Заметки, SSH-ключи, Банк, Паспорт и Права',
            ],
          },
          {
            title: 'Современный интерфейс и мультиязычность',
            badge: 'Vue 3 · Vite · Light/Dark',
            body: 'Веб-сейф, панель администратора и email-уведомления (Vue-Email) адаптированы под светлую и тёмную темы и автоматически подстраиваются под язык браузера.',
            bullets: [
              'Автоопределение языка по браузеру (`ru` / `uk` / `en`) с уточнением при регистрации и в профиле',
              'Все системные и защитные email-письма отправляются на родном языке пользователя',
              'Встроенная панель организаций (`/organizations`) и аудит безопасности Novus Sentinel',
            ],
          },
        ],
      },
      {
        id: 'users',
        label: 'Пользователям',
        summary:
          'Пошаговая инструкция по началу работы, хранению секретов, безопасному обмену и восстановлению доступа.',
        cards: [
          {
            title: 'Быстрый старт и регистрация',
            badge: 'Argon2id',
            body: 'При создании аккаунта браузер локально генерирует 256-битный мастер-ключ, пользовательский ключ и пару ключей RSA-2048. Мастер-пароль никогда не покидает ваше устройство.',
            bullets: [
              'Укажите email, имя и надёжный мастер-пароль (рекомендуется 12+ символов)',
              'Проверьте автоматически выбранный язык интерфейса и email-уведомлений',
              'Подтвердите email (если включено администратором) и настройте двухфакторную защиту',
            ],
          },
          {
            title: 'Записи, папки, Novus Send и защита сессии',
            badge: 'Daily Workflow',
            body: 'Управляйте всеми секретами, вложениями и одноразовыми передачами прямо из веб-сейфа.',
            bullets: [
              'Используйте вложенные папки (`Папка/Подпапка`), избранное, пользовательские поля и Master Password Reprompt',
              'Передавайте пароли и файлы по временным зашифрованным ссылкам в **Novus Send** (ключ передаётся только после `#` в URL)',
              'Включите Auto-Lock, PIN-код, TOTP/Passkeys, а также доверенные контакты в разделе **Экстренный доступ**',
              'Регулярно создавайте зашифрованную резервную копию (`.json` с `encrypted: true`) в **Настройках**',
            ],
          },
        ],
      },
      {
        id: 'orgs',
        label: 'Организациям',
        summary:
          'Совместное корпоративное управление доступами через зашифрованные коллекции, группы и политики безопасности.',
        cards: [
          {
            title: 'Создание организации и жизненный цикл участников',
            badge: 'B2B / Teams',
            body: 'Откройте раздел **Организации** в боковом меню: ключ организации создаётся на клиенте и обёртывается публичным RSA-ключом каждого участника.',
            bullets: [
              'Пригласите сотрудника по email, после чего подтвердите его публичный RSA-отпечаток в один клик',
              'Назначайте гранулярные роли: Owner (Владелец), Admin (Администратор), Manager (Менеджер), User',
              'При увольнении используйте **Отозвать (Revoke)** / **Восстановить** без потери корпоративных записей',
            ],
          },
          {
            title: 'Коллекции, группы, политики и аудит',
            badge: 'Governance',
            body: 'Разграничивайте доступ отделов и контролируйте соблюдение стандартов безопасности.',
            bullets: [
              '**Коллекции и Группы**: настраивайте доступ `ReadOnly` или `HidePasswords` для отдельных команд',
              '**Корпоративные политики**: обязательная 2FA, требования сложности мастер-пароля, Single Org, отключение Send, сброс пароля администратором',
              '**Журнал событий (Event Logs)** и принудительный **Org Duo 2FA** для критических операций',
            ],
          },
        ],
      },
      {
        id: 'admin',
        label: 'Администраторам',
        summary:
          'Развёртывание, настройка БД/S3/SMTP, защита Control Plane и диагностика инфраструктуры NovusWarden.',
        cards: [
          {
            title: 'Развёртывание и защита доступа в Control Plane',
            badge: 'Admin Security',
            body: 'Админ-панель (`/admin`) защищена мастер-токеном `ADMIN_TOKEN`. В production используйте только Argon2id PHC-хэш вместо открытого токена.',
            bullets: [
              'Защита от перебора **Novus Sentinel**: автоматическая блокировка после 2 неверных попыток и отправка экстренной ссылки разблокировки на `ADMIN_EMAIL`',
              'Поддержка SQLite (WAL, <30 MB RAM), PostgreSQL 16+ и MySQL, а также S3 / Cloudflare R2 / MinIO через OpenDAL',
              'Экспорт базы пользователей и моментальные снимки SQLite (`VACUUM INTO`) в разделе Пользователи',
            ],
            code: 'novuswarden hash\nADMIN_TOKEN="$argon2id$v=19$m=65540,t=3,p=4$..."\nADMIN_EMAIL="security@domain.tld"',
          },
          {
            title: 'Почта (Vue-Email), Push и переменные окружения',
            badge: 'Operations',
            body: 'Все 33 HTML-шаблона (`Vue-Email`) и текстовые версии локализованы (`en`, `ru`, `uk`) с поддержкой светлой и тёмной тем почтовых клиентов.',
            bullets: [
              'Почта работает через SMTP (`STARTTLS`/`TLS`/`sendmail`) или через REST API **Resend** (`RESEND_API_KEY`)',
              'Для современного веб-интерфейса включено по умолчанию `WEB_VAULT_VUE=true` (`WEB_VAULT_ENABLED=true`)',
              'В разделе **Диагностика** проверяются DNS, WebSocket, NTP-дрейф времени, HTTPS и сравнение версий',
            ],
          },
        ],
      },
      {
        id: 'security',
        label: 'Безопасность и прозрачность',
        summary:
          'Криптографическая модель с нулевым разглашением (Zero-Knowledge), защита сервера и открытость исходного кода.',
        cards: [
          {
            title: 'Zero-Knowledge криптография (End-to-End)',
            badge: 'Argon2id + AES-256-CBC + HMAC',
            body: 'Сервер NovusWarden хранит и маршрутизирует только зашифрованные шифртексты. Ни администратор сервера, ни база данных не имеют технической возможности прочитать ваши пароли.',
            bullets: [
              'Все новые регистрации принудительно используют усиленный **Argon2id** (`64 MiB`, `3` итерации, `4` потока, соль `SHA-256(lowercase(email))`)',
              'Каждая запись шифруется уникальным симметричным ключом по схеме **AES-256-CBC + HMAC-SHA256** (`EncType 2`)',
              'Совместный доступ в организациях и Send защищён асимметричным **RSA-2048 OAEP-SHA1/SHA256**',
              'Сервер дополнительно ограничивает верхние границы KDF для защиты от CPU/RAM DoS-атак',
            ],
          },
          {
            title: 'Прозрачность, приватность и лицензия',
            badge: 'AGPL-3.0 · Zero Telemetry',
            body: 'Проект полностью прозрачен: исходный код открыт под лицензией GNU AGPL-3.0, без скрытой аналитики и сторонних трекеров.',
            bullets: [
              'Нет скрытой телеметрии, рекламных SDK или передачи пользовательских секретов во внешние сервисы',
              'Защита от SSRF во встроенном HTTP-клиенте (блокировка локальных/приватных IP-диапазонов при загрузке иконок)',
              'Строгие заголовки безопасности HTTP (`CSP`, `X-Content-Type-Options`, `Permissions-Policy`, ограниченный `CORS`)',
            ],
          },
        ],
      },
    ],
  },
  uk: {
    heroTitle: 'Документація, можливості та безпека NovusWarden',
    heroSubtitle:
      'Повний посібник для користувачів, команд та адміністраторів • Архітектура Zero-Knowledge • SGC-NOVUS',
    backVault: '← До сховища',
    backAdmin: '← До панелі керування',
    backLogin: '← Увійти в акаунт',
    goSignup: 'Створити акаунт',
    tabs: [
      {
        id: 'overview',
        label: 'Можливості',
        summary:
          'NovusWarden — високопродуктивний корпоративний менеджер паролів на базі Rust, Vue 3 і протоколу Bitwarden/Vaultwarden, модернізований командою SGC-NOVUS.',
        cards: [
          {
            title: '100% сумісність із клієнтами Bitwarden',
            badge: 'Protocol Parity',
            body: 'Підключайте офіційні браузерні розширення (Chrome, Firefox, Edge, Safari, Opera), десктопні та мобільні застосунки і Bitwarden CLI.',
            bullets: [
              'Підтримка OAuth2 Identity (`/identity/connect/token`), Prelogin KDF і 2-крокової реєстрації',
              'Миттєва синхронізація через SignalR WebSocket (MessagePack) і Push Relay',
              'Усі типи записів: Логіни, Картки, Персональні дані, Нотатки, SSH-ключі, Банк, Паспорт і Посвідчення',
            ],
          },
          {
            title: 'Сучасний інтерфейс та мультимовність',
            badge: 'Vue 3 · Vite · Light/Dark',
            body: 'Веб-сейф, панель адміністратора та email-сповіщення (Vue-Email) підтримують світлу й темну теми та автоматично підлаштовуються під мову браузера.',
            bullets: [
              'Автовизначення мови з браузера (`ru` / `uk` / `en`) з уточненням під час реєстрації та в профілі',
              'Усі системні та захисні листи надсилаються рідною мовою користувача',
              'Вбудована консоль організацій (`/organizations`) та аудит безпеки Novus Sentinel',
            ],
          },
        ],
      },
      {
        id: 'users',
        label: 'Користувачам',
        summary:
          'Покрокова інструкція для початку роботи, збереження секретів, безпечного обміну та відновлення доступу.',
        cards: [
          {
            title: 'Швидкий старт і реєстрація',
            badge: 'Argon2id',
            body: 'Під час створення акаунта браузер локально генерує 256-бітний майстер-ключ, ключ користувача та пару ключів RSA-2048. Майстер-пароль ніколи не покидає ваш пристрій.',
            bullets: [
              'Вкажіть email, ім’я та надійний майстер-пароль (рекомендовано 12+ символів)',
              'Перевірте автоматично визначену мову інтерфейсу та email-сповіщень',
              'Підтвердьте email (якщо вимагається) та увімкніть двофакторний захист (2FA)',
            ],
          },
          {
            title: 'Записи, теки, Novus Send та захист сесії',
            badge: 'Daily Workflow',
            body: 'Керуйте секретами, вкладеннями та тимчасовими зашифрованими посиланнями безпосередньо у веб-сейфі.',
            bullets: [
              'Вкладені теки (`Тека/Підтека`), обране, додаткові поля та Master Password Reprompt',
              'Передавайте паролі й файли через **Novus Send** (ключ шифрування передається лише після `#` у URL)',
              'Налаштуйте Auto-Lock, PIN-код, TOTP/Passkeys і довірені контакти **Екстреного доступу**',
              'Створюйте зашифровані резервні копії (`.json` із `encrypted: true`) у **Налаштуваннях**',
            ],
          },
        ],
      },
      {
        id: 'orgs',
        label: 'Організаціям',
        summary:
          'Командне керування доступами через зашифровані колекції, групи та корпоративні політики безпеки.',
        cards: [
          {
            title: 'Створення організації та учасники',
            badge: 'B2B / Teams',
            body: 'У розділі **Організації** ключ організації створюється локально й шифрується публічним RSA-ключем кожного учасника.',
            bullets: [
              'Запрошуйте колег за email та підтверджуйте їхній RSA-ключ в один клік',
              'Гранулярні ролі: Owner, Admin, Manager, User',
              'Миттєве **Відкликання (Revoke)** або **Відновлення** доступу без втрати корпоративних записів',
            ],
          },
          {
            title: 'Колекції, групи, політики та аудит',
            badge: 'Governance',
            body: 'Розділяйте доступи відділів і контролюйте виконання політик безпеки.',
            bullets: [
              '**Колекції та Групи**: права `ReadOnly` або `HidePasswords` для окремих команд',
              '**Політики**: обов’язкова 2FA, вимоги до складності паролів, Single Org, вимкнення Send, скидання пароля адміністратором',
              '**Журнал подій (Event Logs)** і примусова **Org Duo 2FA**',
            ],
          },
        ],
      },
      {
        id: 'admin',
        label: 'Адміністраторам',
        summary:
          'Розгортання, налаштування БД/S3/SMTP, захист Control Plane та діагностика NovusWarden.',
        cards: [
          {
            title: 'Розгортання та захист Control Plane',
            badge: 'Admin Security',
            body: 'Панель адміністратора (`/admin`) захищена токеном `ADMIN_TOKEN`. У продакшені використовуйте Argon2id PHC-рядок замість відкритого токена.',
            bullets: [
              'Захист **Novus Sentinel**: автоматичне блокування після 2 невдалих спроб із листом розблокування на `ADMIN_EMAIL`',
              'Підтримка SQLite (WAL, <30 MB RAM), PostgreSQL 16+ / MySQL та S3 / Cloudflare R2 / MinIO через OpenDAL',
              'Експорт бази користувачів і знімки SQLite (`VACUUM INTO`)',
            ],
            code: 'novuswarden hash\nADMIN_TOKEN="$argon2id$v=19$m=65540,t=3,p=4$..."\nADMIN_EMAIL="security@domain.tld"',
          },
          {
            title: 'Пошта (Vue-Email), Push та конфігурація',
            badge: 'Operations',
            body: 'Усі 33 HTML-шаблони (`Vue-Email`) та текстові версії локалізовані (`en`, `ru`, `uk`) зі світлою й темною темами поштових клієнтів.',
            bullets: [
              'Надсилання через SMTP (`STARTTLS`/`TLS`/`sendmail`) або REST API **Resend** (`RESEND_API_KEY`)',
              'Сучасний веб-сейф Vue 3 увімкнений за замовчуванням (`WEB_VAULT_VUE=true`)',
              'Діагностика перевіряє DNS, WebSocket, NTP-час, HTTPS і порівняння версій',
            ],
          },
        ],
      },
      {
        id: 'security',
        label: 'Безпека та прозорість',
        summary:
          'Криптографічна модель з нульовим розголошенням (Zero-Knowledge), захист сервера та відкритий код.',
        cards: [
          {
            title: 'Zero-Knowledge криптографія',
            badge: 'Argon2id + AES-256-CBC + HMAC',
            body: 'Сервер NovusWarden зберігає виключно зашифровані дані. Ні адміністратор сервера, ні база даних не можуть прочитати ваші паролі.',
            bullets: [
              'Усі нові реєстрації примусово використовують **Argon2id** (`64 MiB`, `3` ітерації, `4` потоки, сіль `SHA-256(lowercase(email))`)',
              'Кожен запис шифрується по схемі **AES-256-CBC + HMAC-SHA256** (`EncType 2`)',
              'Спільний доступ і Send захищені **RSA-2048 OAEP-SHA1/SHA256**',
              'Жорсткі межі параметрів KDF на сервері захищають від CPU/RAM DoS-атак',
            ],
          },
          {
            title: 'Прозорість, приватність та ліцензія',
            badge: 'AGPL-3.0 · Zero Telemetry',
            body: 'Повністю прозорий відкритий код під ліцензією GNU AGPL-3.0 без прихованої телеметрії та трекерів.',
            bullets: [
              'Жодної прихованої телеметрії або передачі секретів стороннім сервісам',
              'SSRF-захист вбудованого HTTP-клієнта (блокування локальних і приватних IP під час завантаження іконок)',
              'Суворі заголовки безпеки HTTP (`CSP`, `X-Content-Type-Options`, `Permissions-Policy`)',
            ],
          },
        ],
      },
    ],
  },
  en: {
    heroTitle: 'NovusWarden Documentation, Capabilities & Security',
    heroSubtitle:
      'Complete Guide for Users, Organizations & Administrators • Zero-Knowledge Architecture • SGC-NOVUS',
    backVault: '← Back to Vault',
    backAdmin: '← Back to Control Plane',
    backLogin: '← Log in',
    goSignup: 'Create account',
    tabs: [
      {
        id: 'overview',
        label: 'Overview',
        summary:
          'NovusWarden is a high-performance, self-hosted password management core built on Rust, Vue 3, and the Bitwarden/Vaultwarden protocol, modernized by SGC-NOVUS.',
        cards: [
          {
            title: '100% Bitwarden Client Compatibility',
            badge: 'Protocol Parity',
            body: 'Connect official Bitwarden browser extensions (Chrome, Firefox, Edge, Safari, Opera), desktop/mobile apps (Windows, macOS, Linux, iOS, Android), and CLI.',
            bullets: [
              'Full OAuth2 Identity (`/identity/connect/token`), Prelogin KDF, and two-step registration',
              'Real-time SignalR WebSocket (MessagePack) sync and Push Relay compatibility',
              'All cipher types supported: Login, Card, Identity, Secure Note, SSH Key, Bank Account, Driver License, Passport',
            ],
          },
          {
            title: 'Modern Vue 3 UI & Native Localization',
            badge: 'Vue 3 · Vite · Light/Dark',
            body: 'Web Vault, Control Plane, and Vue-Email notifications adapt seamlessly to Light & Dark themes and detect user language automatically.',
            bullets: [
              'Automatic browser language detection (`ru` / `uk` / `en`) with confirmation during signup and in Settings',
              'Transactional & security emails render in the user’s native language across all 33 templates',
              'Integrated Organizations Console (`/organizations`) and Novus Sentinel Security Audit',
            ],
          },
        ],
      },
      {
        id: 'users',
        label: 'User Guide',
        summary:
          'Step-by-step instructions for onboarding, vault management, secure sharing, and account recovery.',
        cards: [
          {
            title: 'Getting Started & Zero-Knowledge Registration',
            badge: 'Argon2id',
            body: 'When creating an account, your browser derives your master key, symmetric user key, and RSA-2048 keypair locally. Your master password is never transmitted in plaintext.',
            bullets: [
              'Enter your email, optional display name, and strong master password (12+ chars recommended)',
              'Verify or refine your auto-detected Interface & Email Language directly on registration',
              'Confirm email verification (if enabled) and enable 2FA (TOTP / Email / WebAuthn Passkeys)',
            ],
          },
          {
            title: 'Vault Items, Folders, Novus Send & Session Lock',
            badge: 'Daily Workflow',
            body: 'Organize credentials, attachments, and ephemeral encrypted links from one workspace.',
            bullets: [
              'Nested folders (`Team/Prod`), Favorites, Custom Fields, Password History, and Master Password Reprompt',
              'Share secrets & files ephemerally with **Novus Send** (decryption key stays client-side after `#` in URL)',
              'Configure Auto-Lock, PIN unlock, TOTP/Passkeys, and **Emergency Access** trustees',
              'Download encrypted `.json` (`encrypted: true`) or `.csv` backups anytime in **Settings**',
            ],
          },
        ],
      },
      {
        id: 'orgs',
        label: 'Organizations',
        summary:
          'Shared team access control backed by RSA-wrapped organization keys, collections, groups, and enterprise policies.',
        cards: [
          {
            title: 'Organization Lifecycle & Member Confirmation',
            badge: 'B2B / Teams',
            body: 'Create organizations directly in **Organizations**; the organization key is generated client-side and wrapped using each member’s RSA public key.',
            bullets: [
              'Invite members by email and confirm their RSA-OAEP trust relationship in one click',
              'Granular roles: Owner, Admin, Manager, User',
              'Revoke or restore members cleanly without losing shared organizational items',
            ],
          },
          {
            title: 'Collections, Groups, Policies & Audit Logs',
            badge: 'Governance',
            body: 'Enforce organization-wide security standards and track critical actions.',
            bullets: [
              '**Collections & Groups**: fine-grained `ReadOnly` and `HidePasswords` permissions',
              '**Policies**: Two-Factor Enforcement, Master Password Complexity, Single Org, Disable Send, Reset Password',
              '**Event Logs** auditing and organization-wide **Duo 2FA**',
            ],
          },
        ],
      },
      {
        id: 'admin',
        label: 'Admin Guide',
        summary:
          'Deployment, database/S3/SMTP setup, Control Plane hardening, and system diagnostics.',
        cards: [
          {
            title: 'Deployment & Control Plane Hardening',
            badge: 'Admin Security',
            body: 'Control Plane (`/admin`) is protected by `ADMIN_TOKEN`. In production, always hash the token as an Argon2id PHC string using `novuswarden hash`.',
            bullets: [
              '**Novus Sentinel brute-force protection**: locks after 2 invalid attempts and emails an unlock link to `ADMIN_EMAIL`',
              'Supports SQLite (WAL, <30 MB RAM), PostgreSQL 16+, MySQL, plus S3 / Cloudflare R2 / MinIO via Apache OpenDAL',
              'JSON user exports and live SQLite `VACUUM INTO` snapshots in the Control Plane',
            ],
            code: 'novuswarden hash\nADMIN_TOKEN="$argon2id$v=19$m=65540,t=3,p=4$..."\nADMIN_EMAIL="security@domain.tld"',
          },
          {
            title: 'Vue-Email, Push Relays & Server Settings',
            badge: 'Operations',
            body: 'All 33 HTML email templates (`Vue-Email`) and text fallbacks support `en`, `ru`, and `uk` with Light/Dark mail client styling.',
            bullets: [
              'Deliver mail via SMTP (`STARTTLS`/`TLS`/`sendmail`) or **Resend** API (`RESEND_API_KEY`)',
              '`WEB_VAULT_VUE=true` is enabled by default (`WEB_VAULT_ENABLED=true`)',
              'Use **Diagnostics** to verify WebSocket, HTTP connectivity, NTP drift, HTTPS, and version parity',
            ],
          },
        ],
      },
      {
        id: 'security',
        label: 'Security & Transparency',
        summary:
          'Verifiable Zero-Knowledge cryptography, anti-SSRF hardening, and AGPL-3.0 open-source transparency.',
        cards: [
          {
            title: 'Zero-Knowledge Cryptography (End-to-End)',
            badge: 'Argon2id + AES-256-CBC + HMAC',
            body: 'The NovusWarden server only stores and syncs encrypted blobs. Neither server operators nor database backups can decrypt your vault secrets.',
            bullets: [
              'All new registrations enforce **Argon2id** (`64 MiB`, `3` iterations, `4` parallelism, `SHA-256(lowercase(email))` salt)',
              'Per-cipher **AES-256-CBC + HMAC-SHA256** (`EncType 2`) authenticated encryption',
              'Organization sharing and Send access use asymmetric **RSA-2048 OAEP** key wrapping',
              'Server-side KDF upper bounds mitigate computational DoS attacks',
            ],
          },
          {
            title: 'Transparency, Privacy & Licensing',
            badge: 'AGPL-3.0 · Zero Telemetry',
            body: 'Fully auditable GNU AGPL-3.0 codebase with zero telemetry, zero trackers, and strict network boundaries.',
            bullets: [
              'Zero hidden telemetry or third-party secret transmission',
              'Built-in SSRF protection blocks internal/non-global IP ranges during favicon fetching',
              'Hardened HTTP response headers (`CSP`, `X-Content-Type-Options`, `Permissions-Policy`, scoped `CORS`)',
            ],
          },
        ],
      },
    ],
  },
};
