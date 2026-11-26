// Unified Zero-Dependency Vue 3 Reactive i18n (ru / uk / en)
// NovusWarden Frontend Localization Engine

import { ref, computed } from 'vue';

export type SupportedLocale = 'ru' | 'uk' | 'en';

export const LOCALE_OPTIONS: ReadonlyArray<{
  code: SupportedLocale;
  short: string;
  label: string;
  acceptHeader: string;
}> = [
  { code: 'ru', short: 'RU', label: 'Русский (RU)', acceptHeader: 'ru-RU,ru;q=0.9,en;q=0.8' },
  { code: 'uk', short: 'UK', label: 'Українська (UK)', acceptHeader: 'uk-UA,uk;q=0.9,en;q=0.8' },
  { code: 'en', short: 'EN', label: 'English (EN)', acceptHeader: 'en-US,en;q=0.9' },
];

export function normalizeSupportedLocale(raw?: string | null): SupportedLocale | null {
  if (!raw) return null;
  const norm = raw.trim().toLowerCase().replace('_', '-');
  if (norm === 'uk' || norm.startsWith('uk-')) return 'uk';
  if (norm === 'ru' || norm.startsWith('ru-')) return 'ru';
  if (norm === 'en' || norm.startsWith('en-')) return 'en';
  return null;
}

function detectBrowserLocale(): SupportedLocale {
  if (typeof navigator !== 'undefined') {
    const candidates: string[] = [];
    if (Array.isArray(navigator.languages)) {
      candidates.push(...navigator.languages);
    }
    if (navigator.language) {
      candidates.push(navigator.language);
    }
    for (const candidate of candidates) {
      const matched = normalizeSupportedLocale(candidate);
      if (matched) return matched;
    }
  }
  return 'en';
}

function detectInitialLocale(): SupportedLocale {
  if (typeof localStorage !== 'undefined') {
    const saved = normalizeSupportedLocale(localStorage.getItem('novus_locale'));
    if (saved) return saved;
  }
  return detectBrowserLocale();
}

export const currentLocale = ref<SupportedLocale>(detectInitialLocale());

function applyHtmlLang(loc: SupportedLocale) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = loc;
  }
}

applyHtmlLang(currentLocale.value);

export function getAcceptLanguageHeader(loc: SupportedLocale = currentLocale.value): string {
  return LOCALE_OPTIONS.find((opt) => opt.code === loc)?.acceptHeader || 'en-US,en;q=0.9';
}

/**
 * Align UI locale from the authenticated account profile culture when
 * the user has not explicitly pinned a browser override in localStorage.
 */
export function syncLocaleFromAccountCulture(culture?: string | null) {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('novus_locale')) {
    return;
  }
  const normalized = normalizeSupportedLocale(culture);
  if (normalized) {
    currentLocale.value = normalized;
    applyHtmlLang(normalized);
  }
}

export const messages = {
  ru: {
    'nav.vault': 'Хранилище',
    'nav.organizations': 'Организации',
    'nav.send': 'Send (Передача)',
    'nav.generator': 'Генератор',
    'nav.sentinel': 'Sentinel (Аудит)',
    'nav.settings': 'Настройки',
    'nav.docs': 'Документация',
    'nav.dashboard': 'Сводка',
    'nav.users': 'Пользователи',
    'nav.subscriptions': 'Тарифы и подписки',
    'nav.serverSettings': 'Настройки сервера',
    'nav.diagnostics': 'Диагностика',
    'nav.backToVault': '← В хранилище',
    'nav.logout': 'Выйти',
    'theme.system': 'Система',
    'theme.dark': 'Тёмная',
    'theme.light': 'Светлая',
    'lang.label': 'Язык интерфейса',
    'common.save': 'Сохранить',
    'common.cancel': 'Отмена',
    'common.delete': 'Удалить',
    'common.create': 'Создать',
    'common.refresh': 'Обновить',
    'common.loading': 'Загрузка...',
    'common.search': 'Поиск...',
    'common.all': 'Все',
    'common.enabled': 'Включено',
    'common.disabled': 'Отключено',
    'vault.newItem': 'Новый элемент',
    'vault.organizations': 'Организации',
    'vault.archive': 'Архив',
    'vault.trash': 'Корзина',
    'vault.favorites': 'Избранное',
    'vault.folders': 'Папки',
    'vault.collections': 'Коллекции',
    'security.fingerprintPhrase': 'Контрольная фраза (Fingerprint)',
    'security.securityStamp': 'Штамп безопасности (Security Stamp)',
    'security.argon2Locked': 'Криптозащита ключа: Argon2id (64 MiB · усиленный)',
    'org.title': 'Консоль организаций',
    'org.subtitle': 'Корпоративные хранилища, участники, коллекции, группы, политики и аудит-логи',
    'org.createNew': 'Создать организацию',
    'org.tab.overview': 'Обзор и экспорт',
    'org.tab.members': 'Участники',
    'org.tab.collections': 'Коллекции',
    'org.tab.groups': 'Группы',
    'org.tab.policies': 'Политики',
    'org.tab.events': 'Журнал событий',
    'org.tab.twoFactor': 'Duo 2FA организации',
    'auth.loginTitle': 'Войти',
    'auth.unlockTitle': 'Хранилище заблокировано',
    'auth.twoFactorTitle': 'Двухфакторная проверка',
    'auth.loginSubtitle': 'Защищённый доступ к корпоративному хранилищу NovusWarden',
    'auth.twoFactorSubtitle': 'Подтвердите вход с помощью второго фактора безопасности',
    'auth.emailLabel': 'Адрес электронной почты',
    'auth.passwordLabel': 'Мастер-пароль',
    'auth.rememberEmail': 'Запомнить email',
    'auth.loginSubmit': 'Войти в хранилище',
    'auth.unlockSubmit': 'Разблокировать хранилище',
    'auth.verifySubmit': 'Подтвердить вход',
    'auth.noAccount': 'Нет учётной записи?',
    'auth.createAccount': 'Создать аккаунт',
    'auth.switchAccount': 'Сменить аккаунт',
    'auth.registerTitle': 'Создать аккаунт',
    'auth.registerSubtitle': 'Нулевое разглашение (Zero-Knowledge) • Ключи шифрования создаются локально',
    'auth.nameLabel': 'Имя (опционально)',
    'auth.confirmPasswordLabel': 'Подтвердите мастер-пароль',
    'auth.passwordHintLabel': 'Подсказка для пароля (опционально)',
    'auth.languageLabel': 'Язык интерфейса и писем (Email)',
    'auth.languageHint': 'Определён автоматически по браузеру — можно изменить для писем и интерфейса',
    'auth.registerSubmit': 'Создать защищённый аккаунт',
    'auth.alreadyHaveAccount': 'Уже есть аккаунт?',
    'auth.signInLink': 'Войти в хранилище',
    'auth.verificationSentPrefix': 'На адрес',
    'auth.verificationSentSuffix': 'отправлено письмо подтверждения. Перейдите по ссылке в письме для завершения регистрации.',
    'settings.languageLabel': 'Язык интерфейса и уведомлений (Email)',
    'settings.languageHint': 'Используется для веб-сейфа и всех email-уведомлений безопасности',
    'settings.clipboardClear': 'Автоочистка буфера обмена',
    'settings.webauthnKeys': 'Ключи безопасности (FIDO2 / Passkeys)',
    'settings.activeDevices': 'Активные устройства и 2FA-сессии',
    'cmd.placeholder': 'Поиск записей, логинов, доменов или команд...',
    'admin.dashboardTitle': 'Сводка кластера',
    'admin.usersTitle': 'Управление пользователями',
    'admin.orgsTitle': 'Организации и корпоративные хранилища',
    'admin.settingsTitle': 'Конфигурация сервера',
    'admin.diagnosticsTitle': 'Диагностика и телеметрия системы',
    'admin.unsavedChanges': 'Несохранённые изменения',
    'admin.discard': 'Отменить',
    'admin.saveChanges': 'Сохранить изменения',
  },
  uk: {
    'nav.vault': 'Сховище',
    'nav.organizations': 'Організації',
    'nav.send': 'Send (Передача)',
    'nav.generator': 'Генератор',
    'nav.sentinel': 'Sentinel (Аудит)',
    'nav.settings': 'Налаштування',
    'nav.docs': 'Документація',
    'nav.dashboard': 'Огляд',
    'nav.users': 'Користувачі',
    'nav.subscriptions': 'Тарифи і підписки',
    'nav.serverSettings': 'Налаштування сервера',
    'nav.diagnostics': 'Діагностика',
    'nav.backToVault': '← До сховища',
    'nav.logout': 'Вийти',
    'theme.system': 'Система',
    'theme.dark': 'Темна',
    'theme.light': 'Світла',
    'lang.label': 'Мова інтерфейсу',
    'common.save': 'Зберегти',
    'common.cancel': 'Скасувати',
    'common.delete': 'Видалити',
    'common.create': 'Створити',
    'common.refresh': 'Оновити',
    'common.loading': 'Завантаження...',
    'common.search': 'Пошук...',
    'common.all': 'Усі',
    'common.enabled': 'Увімкнено',
    'common.disabled': 'Вимкнено',
    'vault.newItem': 'Новий запис',
    'vault.organizations': 'Організації',
    'vault.archive': 'Архів',
    'vault.trash': 'Кошик',
    'vault.favorites': 'Обране',
    'vault.folders': 'Теки',
    'vault.collections': 'Колекції',
    'security.fingerprintPhrase': 'Контрольна фраза (Fingerprint)',
    'security.securityStamp': 'Штамп безпеки (Security Stamp)',
    'security.argon2Locked': 'Криптозахист ключа: Argon2id (64 MiB · посилений)',
    'org.title': 'Консоль організацій',
    'org.subtitle': 'Корпоративні сховища, учасники, колекції, групи, політики та аудит-логи',
    'org.createNew': 'Створити організацію',
    'org.tab.overview': 'Огляд та експорт',
    'org.tab.members': 'Учасники',
    'org.tab.collections': 'Колекції',
    'org.tab.groups': 'Групи',
    'org.tab.policies': 'Політики',
    'org.tab.events': 'Журнал подій',
    'org.tab.twoFactor': 'Duo 2FA організації',
    'auth.loginTitle': 'Увійти',
    'auth.unlockTitle': 'Сховище заблоковане',
    'auth.twoFactorTitle': 'Двофакторна перевірка',
    'auth.loginSubtitle': 'Захищений доступ до корпоративного сховища NovusWarden',
    'auth.twoFactorSubtitle': 'Підтвердьте вхід за допомогою другого фактора безпеки',
    'auth.emailLabel': 'Адреса електронної пошти',
    'auth.passwordLabel': 'Майстер-пароль',
    'auth.rememberEmail': "Запам'ятати email",
    'auth.loginSubmit': 'Увійти до сховища',
    'auth.unlockSubmit': 'Розблокувати сховище',
    'auth.verifySubmit': 'Підтвердити вхід',
    'auth.noAccount': 'Немає облікового запису?',
    'auth.createAccount': 'Створити акаунт',
    'auth.switchAccount': 'Змінити акаунт',
    'auth.registerTitle': 'Створити акаунт',
    'auth.registerSubtitle': 'Нульове розголошення (Zero-Knowledge) • Ключі шифрування створюються локально',
    'auth.nameLabel': "Ім'я (необов'язково)",
    'auth.confirmPasswordLabel': 'Підтвердьте майстер-пароль',
    'auth.passwordHintLabel': "Підказка для пароля (необов'язково)",
    'auth.languageLabel': 'Мова інтерфейсу та листів (Email)',
    'auth.languageHint': 'Визначено автоматично за браузером — можна змінити для листів та інтерфейсу',
    'auth.registerSubmit': 'Створити захищений акаунт',
    'auth.alreadyHaveAccount': 'Вже є акаунт?',
    'auth.signInLink': 'Увійти до сховища',
    'auth.verificationSentPrefix': 'На адресу',
    'auth.verificationSentSuffix': 'надіслано лист підтвердження. Перейдіть за посиланням у листі для завершення реєстрації.',
    'settings.languageLabel': 'Мова інтерфейсу та сповіщень (Email)',
    'settings.languageHint': 'Використовується для веб-сейфу та всіх email-сповіщень безпеки',
    'settings.clipboardClear': 'Автоочищення буфера обміну',
    'settings.webauthnKeys': 'Ключі безпеки (FIDO2 / Passkeys)',
    'settings.activeDevices': 'Активні пристрої та 2FA-сесії',
    'cmd.placeholder': 'Пошук записів, логінів, доменів або команд...',
    'admin.dashboardTitle': 'Огляд кластера',
    'admin.usersTitle': 'Керування користувачами',
    'admin.orgsTitle': 'Організації та корпоративні сховища',
    'admin.settingsTitle': 'Конфігурація сервера',
    'admin.diagnosticsTitle': 'Діагностика та телеметрія системи',
    'admin.unsavedChanges': 'Незбережені зміни',
    'admin.discard': 'Скасувати',
    'admin.saveChanges': 'Зберегти зміни',
  },
  en: {
    'nav.vault': 'Vault',
    'nav.organizations': 'Organizations',
    'nav.send': 'Send',
    'nav.generator': 'Generator',
    'nav.sentinel': 'Sentinel Audit',
    'nav.settings': 'Settings',
    'nav.docs': 'Documentation',
    'nav.dashboard': 'Dashboard',
    'nav.users': 'Users',
    'nav.subscriptions': 'Billing & Plans',
    'nav.serverSettings': 'Server Settings',
    'nav.diagnostics': 'Diagnostics',
    'nav.backToVault': '← Back to Vault',
    'nav.logout': 'Log out',
    'theme.system': 'System',
    'theme.dark': 'Dark',
    'theme.light': 'Light',
    'lang.label': 'Interface Language',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.create': 'Create',
    'common.refresh': 'Refresh',
    'common.loading': 'Loading...',
    'common.search': 'Search...',
    'common.all': 'All',
    'common.enabled': 'Enabled',
    'common.disabled': 'Disabled',
    'vault.newItem': 'New item',
    'vault.organizations': 'Organizations',
    'vault.archive': 'Archive',
    'vault.trash': 'Trash',
    'vault.favorites': 'Favorites',
    'vault.folders': 'Folders',
    'vault.collections': 'Collections',
    'security.fingerprintPhrase': 'Fingerprint Phrase',
    'security.securityStamp': 'Security Stamp',
    'security.argon2Locked': 'Key Protection: Argon2id (64 MiB · High-Security)',
    'org.title': 'Organization Console',
    'org.subtitle': 'Shared vaults, members, collections, groups, enterprise policies and audit logs',
    'org.createNew': 'New Organization',
    'org.tab.overview': 'Overview & Export',
    'org.tab.members': 'Members',
    'org.tab.collections': 'Collections',
    'org.tab.groups': 'Groups',
    'org.tab.policies': 'Policies',
    'org.tab.events': 'Event Logs',
    'org.tab.twoFactor': 'Org Duo 2FA',
    'auth.loginTitle': 'Log in',
    'auth.unlockTitle': 'Vault is locked',
    'auth.twoFactorTitle': 'Two-step verification',
    'auth.loginSubtitle': 'Zero-knowledge access to your NovusWarden Vault',
    'auth.twoFactorSubtitle': 'Verify your login with a second security factor',
    'auth.emailLabel': 'Email address',
    'auth.passwordLabel': 'Master password',
    'auth.rememberEmail': 'Remember email',
    'auth.loginSubmit': 'Log in to Vault',
    'auth.unlockSubmit': 'Unlock Vault',
    'auth.verifySubmit': 'Verify login',
    'auth.noAccount': 'New to NovusWarden?',
    'auth.createAccount': 'Create account',
    'auth.switchAccount': 'Switch account',
    'auth.registerTitle': 'Create account',
    'auth.registerSubtitle': 'Zero-Knowledge Encryption • Keys are generated locally in your browser',
    'auth.nameLabel': 'Name (optional)',
    'auth.confirmPasswordLabel': 'Confirm master password',
    'auth.passwordHintLabel': 'Master password hint (optional)',
    'auth.languageLabel': 'Interface & Email Language',
    'auth.languageHint': 'Auto-detected from your browser — change anytime for emails and UI',
    'auth.registerSubmit': 'Create protected account',
    'auth.alreadyHaveAccount': 'Already have an account?',
    'auth.signInLink': 'Log in to Vault',
    'auth.verificationSentPrefix': 'A verification email has been sent to',
    'auth.verificationSentSuffix': '. Open the link in the email to complete registration.',
    'settings.languageLabel': 'Interface & Notification Language (Email)',
    'settings.languageHint': 'Used for Web Vault UI and all account security emails',
    'settings.clipboardClear': 'Clipboard auto-clear',
    'settings.webauthnKeys': 'Security Keys (FIDO2 / Passkeys)',
    'settings.activeDevices': 'Active Devices & 2FA Sessions',
    'cmd.placeholder': 'Search items, logins, domains, or commands...',
    'admin.dashboardTitle': 'Cluster Overview',
    'admin.usersTitle': 'User Management',
    'admin.orgsTitle': 'Organizations & Shared Vaults',
    'admin.settingsTitle': 'Server Configuration',
    'admin.diagnosticsTitle': 'System Diagnostics & Telemetry',
    'admin.unsavedChanges': 'Unsaved changes',
    'admin.discard': 'Discard',
    'admin.saveChanges': 'Save changes',
  },
} as const;

export type I18nKey = keyof typeof messages.ru;

export function setLocale(next: SupportedLocale) {
  currentLocale.value = next;
  applyHtmlLang(next);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('novus_locale', next);
  }
}

export function cycleLocale() {
  const order: SupportedLocale[] = ['ru', 'uk', 'en'];
  const next = order[(order.indexOf(currentLocale.value) + 1) % order.length];
  setLocale(next);
}

export function t(key: I18nKey): string {
  return messages[currentLocale.value]?.[key] || messages.en[key] || key;
}

export function useI18n() {
  const locale = computed(() => currentLocale.value);
  return { locale, t, setLocale, cycleLocale };
}
