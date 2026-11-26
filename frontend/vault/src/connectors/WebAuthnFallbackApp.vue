<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useThemeStore } from '../stores/theme.ts';
import {
  useI18n,
  normalizeSupportedLocale,
  type SupportedLocale,
} from '@shared/i18n.ts';
import {
  getQueryParam,
  base64DecodeUtf8,
  parseWebauthnRequestOptions,
  buildWebauthnAssertionJson,
  formatWebauthnError,
} from '../crypto/webauthn.ts';
import {
  Globe,
  Sun,
  Moon,
  Monitor,
  KeyRound,
  Fingerprint,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-vue-next';

const themeStore = useThemeStore();
const { locale, t, cycleLocale } = useI18n();

const activeLocale = ref<SupportedLocale>(locale.value);

const COPY: Record<
  SupportedLocale,
  {
    pageTitle: string;
    badge: string;
    title: string;
    subtitle: string;
    rememberLabel: string;
    rememberHint: string;
    readButton: string;
    readingButton: string;
    verifiedButton: string;
    successTitle: string;
    successBody: string;
    closeTab: string;
    errNoParent: string;
    errNoData: string;
    errParseData: string;
    errNotSupported: string;
    footerPowered1: string;
    footerPowered2: string;
  }
> = {
  ru: {
    pageTitle: 'NovusWarden — Подтверждение ключа безопасности (WebAuthn)',
    badge: 'FIDO2 / WebAuthn · Zero-Knowledge',
    title: 'Подтвердите вашу личность',
    subtitle:
      'Выполните следующие шаги, чтобы завершить авторизацию в расширении с помощью ключа безопасности или Passkey.',
    rememberLabel: 'Не спрашивать на этом устройстве в течение 30 дней',
    rememberHint: 'Доверенный токен будет привязан только к этому браузеру',
    readButton: 'Считать ключ безопасности',
    readingButton: 'Ожидание ключа безопасности...',
    verifiedButton: 'Ключ подтверждён',
    successTitle: 'WebAuthn успешно прошёл верификацию!',
    successBody: 'Подтверждение передано в расширение — вы можете закрыть эту вкладку.',
    closeTab: 'Закрыть вкладку',
    errNoParent: 'Отсутствует параметр родительского окна (parent). Откройте страницу повторно из расширения.',
    errNoData: 'Не переданы параметры вызова WebAuthn (data). Повторите попытку входа из расширения.',
    errParseData: 'Не удалось разобрать параметры WebAuthn. Повторите вход из расширения.',
    errNotSupported: 'WebAuthn не поддерживается в текущем браузере.',
    footerPowered1: 'Работает на платформе SGC-NOVUS',
    footerPowered2: 'System Generations Core Novus',
  },
  uk: {
    pageTitle: 'NovusWarden — Підтвердження ключа безпеки (WebAuthn)',
    badge: 'FIDO2 / WebAuthn · Zero-Knowledge',
    title: 'Підтвердьте вашу особу',
    subtitle:
      'Виконайте наведені нижче кроки, щоб завершити авторизацію в розширенні за допомогою ключа безпеки або Passkey.',
    rememberLabel: 'Не запитувати на цьому пристрої протягом 30 днів',
    rememberHint: 'Довірений токен буде прив’язано лише до цього браузера',
    readButton: 'Зчитати ключ безпеки',
    readingButton: 'Очікування ключа безпеки...',
    verifiedButton: 'Ключ підтверджено',
    successTitle: 'WebAuthn успішно пройшов верифікацію!',
    successBody: 'Підтвердження передано в розширення — ви можете закрити цю вкладку.',
    closeTab: 'Закрити вкладку',
    errNoParent: 'Відсутній параметр батьківського вікна (parent). Відкрийте сторінку повторно з розширення.',
    errNoData: 'Не передано параметри виклику WebAuthn (data). Повторіть спробу входу з розширення.',
    errParseData: 'Не вдалося розібрати параметри WebAuthn. Повторіть вхід із розширення.',
    errNotSupported: 'WebAuthn не підтримується в поточному браузері.',
    footerPowered1: 'Працює на платформі SGC-NOVUS',
    footerPowered2: 'System Generations Core Novus',
  },
  en: {
    pageTitle: 'NovusWarden — Security Key Verification (WebAuthn)',
    badge: 'FIDO2 / WebAuthn · Zero-Knowledge',
    title: 'Verify your identity',
    subtitle:
      'Follow the steps below to finish signing in to your browser extension with a security key or Passkey.',
    rememberLabel: "Don't ask again on this device for 30 days",
    rememberHint: 'The trusted remember token stays bound to this browser only',
    readButton: 'Read security key',
    readingButton: 'Waiting for security key...',
    verifiedButton: 'Verification complete',
    successTitle: 'WebAuthn verification succeeded!',
    successBody: 'Your assertion has been sent back to the extension — you may close this tab.',
    closeTab: 'Close tab',
    errNoParent: 'Missing parent parameter. Please reopen this page from the browser extension.',
    errNoData: 'Missing WebAuthn challenge data. Please restart login from the browser extension.',
    errParseData: 'Unable to parse WebAuthn challenge data. Please restart login from the extension.',
    errNotSupported: 'WebAuthn is not supported in this browser.',
    footerPowered1: 'Powered by SGC-NOVUS Platform',
    footerPowered2: 'System Generations Core Novus',
  },
};

const copy = computed(() => COPY[activeLocale.value] || COPY.en);

const rememberDevice = ref(true);
const isReading = ref(false);
const isVerified = ref(false);
const errorMessage = ref('');
const hasValidPayload = ref(false);

let rawWebauthnJson: string | Record<string, any> | null = null;
let parsedParamsDone = false;

const themeIcon = computed(() => {
  if (themeStore.mode === 'dark') return Moon;
  if (themeStore.mode === 'light') return Sun;
  return Monitor;
});

const themeLabel = computed(() => {
  if (themeStore.mode === 'dark') return t('theme.dark');
  if (themeStore.mode === 'light') return t('theme.light');
  return t('theme.system');
});

const brandBannerSrc = computed(() =>
  themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp'
);

function handleCycleLocale() {
  cycleLocale();
  activeLocale.value = locale.value;
  document.title = copy.value.pageTitle;
}

function parseConnectorParameters() {
  if (parsedParamsDone) return;
  parsedParamsDone = true;

  const qsLocale = normalizeSupportedLocale(getQueryParam('locale'));
  if (qsLocale) {
    activeLocale.value = qsLocale;
    document.documentElement.lang = qsLocale;
  }
  document.title = copy.value.pageTitle;

  const parentParam = getQueryParam('parent');
  if (!parentParam) {
    errorMessage.value = copy.value.errNoParent;
    return;
  }

  const dataParam = getQueryParam('data');
  if (!dataParam) {
    errorMessage.value = copy.value.errNoData;
    return;
  }

  const version = getQueryParam('v');
  try {
    if (version === '1') {
      rawWebauthnJson = base64DecodeUtf8(dataParam, true);
    } else {
      const decoded = JSON.parse(base64DecodeUtf8(dataParam, true));
      if (!decoded || decoded.data == null) {
        errorMessage.value = copy.value.errNoData;
        return;
      }
      rawWebauthnJson = decoded.data;
    }
    hasValidPayload.value = true;
  } catch {
    errorMessage.value = copy.value.errParseData;
  }
}

async function handleReadSecurityKey() {
  if (isVerified.value || isReading.value) return;

  if (typeof navigator === 'undefined' || !('credentials' in navigator)) {
    errorMessage.value = copy.value.errNotSupported;
    return;
  }

  if (!rawWebauthnJson) {
    parseConnectorParameters();
    if (!rawWebauthnJson) {
      if (!errorMessage.value) errorMessage.value = copy.value.errNoData;
      return;
    }
  }

  let publicKeyOptions: PublicKeyCredentialRequestOptions;
  try {
    publicKeyOptions = parseWebauthnRequestOptions(rawWebauthnJson);
  } catch {
    errorMessage.value = copy.value.errParseData;
    return;
  }

  errorMessage.value = '';
  isReading.value = true;

  try {
    const assertedCredential = (await navigator.credentials.get({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (isVerified.value) return;
    if (!assertedCredential) {
      throw new Error(copy.value.errParseData);
    }

    const dataString = buildWebauthnAssertionJson(assertedCredential);
    // Exact message contract expected by Bitwarden browser extension content script
    window.postMessage(
      {
        command: 'webAuthnResult',
        data: dataString,
        remember: rememberDevice.value,
      },
      '*'
    );

    isVerified.value = true;
  } catch (err) {
    errorMessage.value = formatWebauthnError(err, activeLocale.value);
  } finally {
    isReading.value = false;
  }
}

function handleCloseTab() {
  window.close();
}

onMounted(() => {
  parseConnectorParameters();
});
</script>

<template>
  <div class="connector-wrapper">
    <!-- Top Bar: Brand Logo + Locale & Theme Pills -->
    <header class="top-nav">
      <a href="/" class="brand-container" title="NovusWarden Web Vault">
        <img :src="brandBannerSrc" alt="NovusWarden" class="nav-banner" />
      </a>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="theme-pill"
          @click="handleCycleLocale"
          :title="t('lang.label')"
        >
          <Globe class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ activeLocale.toUpperCase() }}</span>
        </button>

        <button
          type="button"
          class="theme-pill"
          @click="themeStore.cycleTheme"
          :title="themeLabel"
        >
          <component :is="themeIcon" class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ themeLabel }}</span>
        </button>
      </div>
    </header>

    <!-- Main Centered Verification Card -->
    <main class="connector-center">
      <div class="connector-card">
        <!-- Animated Hardware Key Emblem -->
        <div
          class="emblem-wrap"
          :class="{
            'emblem-success': isVerified,
            'emblem-reading': isReading,
            'emblem-error': !!errorMessage && !isVerified,
          }"
        >
          <CheckCircle2 v-if="isVerified" class="w-8 h-8 text-emerald-400" />
          <Fingerprint v-else-if="isReading" class="w-8 h-8 text-sky-300 animate-pulse" />
          <KeyRound v-else class="w-7 h-7 text-sky-400" />
        </div>

        <span class="protocol-badge">
          <ShieldCheck class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ copy.badge }}</span>
        </span>

        <h1 class="connector-title">{{ copy.title }}</h1>
        <p class="connector-subtitle">{{ copy.subtitle }}</p>

        <!-- Success Banner -->
        <div v-if="isVerified" class="status-banner status-success" role="status">
          <CheckCircle2 class="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
          <div class="text-left">
            <div class="font-semibold text-emerald-300 text-[13px] leading-snug">
              {{ copy.successTitle }}
            </div>
            <div class="text-[12px] text-emerald-200/80 mt-0.5 leading-relaxed">
              {{ copy.successBody }}
            </div>
          </div>
        </div>

        <!-- Error Banner -->
        <div v-else-if="errorMessage" class="status-banner status-error" role="alert">
          <AlertCircle class="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <span class="text-left leading-relaxed">{{ errorMessage }}</span>
        </div>

        <!-- Remember Device Panel -->
        <label
          for="remember"
          class="remember-card"
          :class="{ 'remember-disabled': isVerified || isReading }"
        >
          <input
            id="remember"
            v-model="rememberDevice"
            type="checkbox"
            class="cyber-checkbox mt-0.5"
            :disabled="isVerified || isReading"
          />
          <div class="text-left">
            <div class="remember-title">{{ copy.rememberLabel }}</div>
            <div class="remember-hint">{{ copy.rememberHint }}</div>
          </div>
        </label>

        <!-- Primary WebAuthn Action Button -->
        <button
          id="webauthn-button"
          type="button"
          class="action-btn-primary"
          :disabled="isVerified || isReading || !hasValidPayload"
          @click="handleReadSecurityKey"
        >
          <span v-if="isReading" class="flex items-center gap-2">
            <span class="btn-spinner"></span>
            <span>{{ copy.readingButton }}</span>
          </span>
          <span v-else-if="isVerified" class="flex items-center gap-2">
            <CheckCircle2 class="w-4 h-4" />
            <span>{{ copy.verifiedButton }}</span>
          </span>
          <span v-else class="flex items-center gap-2">
            <KeyRound class="w-4 h-4" />
            <span>{{ copy.readButton }}</span>
          </span>
        </button>

        <!-- Convenience Close Tab button after successful verification -->
        <button
          v-if="isVerified"
          type="button"
          class="cyber-btn-secondary w-full mt-2.5 !h-9"
          @click="handleCloseTab"
        >
          <X class="w-4 h-4" />
          <span>{{ copy.closeTab }}</span>
        </button>
      </div>
    </main>

    <!-- Footer matching LoginView -->
    <footer class="app-footer">
      <div class="footer-title">NovusWarden Web 2026.7.0</div>
      <div class="footer-powered">
        {{ copy.footerPowered1 }}<br />
        {{ copy.footerPowered2 }}
      </div>
    </footer>
  </div>
</template>

<style scoped>
.connector-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  padding: 14px 20px 12px 20px;
  box-sizing: border-box;
}

.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  height: 48px;
}

.brand-container {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

.nav-banner {
  height: 38px;
  width: auto;
  max-width: 180px;
  object-fit: contain;
}

.theme-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  background: var(--card-bg, rgba(15, 23, 42, 0.8));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.3));
  color: var(--text-primary, #f8fafc);
  backdrop-filter: blur(12px);
  transition: all 0.2s ease;
}

.theme-pill:hover {
  transform: translateY(-1px);
  border-color: #38bdf8;
}

.connector-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
}

.connector-card {
  width: 100%;
  max-width: 440px;
  padding: 28px 30px;
  border-radius: 18px;
  background: var(--card-bg, rgba(10, 18, 35, 0.88));
  border: 1px solid var(--card-border-strong, rgba(56, 189, 248, 0.3));
  box-shadow: var(
    --card-shadow,
    0 20px 45px -10px rgba(0, 0, 0, 0.75),
    0 0 28px rgba(14, 165, 233, 0.14)
  );
  backdrop-filter: blur(18px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.emblem-wrap {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--input-bg, rgba(2, 6, 23, 0.75));
  border: 1px solid rgba(56, 189, 248, 0.38);
  box-shadow: 0 0 24px rgba(14, 165, 233, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  transition: all 0.25s ease;
}

.emblem-reading {
  border-color: rgba(56, 189, 248, 0.75);
  box-shadow: 0 0 32px rgba(56, 189, 248, 0.4);
}

.emblem-success {
  border-color: rgba(16, 185, 129, 0.55);
  box-shadow: 0 0 28px rgba(16, 185, 129, 0.32);
}

.emblem-error {
  border-color: rgba(244, 63, 94, 0.5);
  box-shadow: 0 0 24px rgba(244, 63, 94, 0.22);
}

.protocol-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-secondary, #cbd5e1);
  background: rgba(14, 165, 233, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.24);
  margin-bottom: 12px;
}

.connector-title {
  font-size: 21px;
  font-weight: 700;
  margin: 0 0 6px 0;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.connector-subtitle {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-secondary, #94a3b8);
  margin: 0 0 18px 0;
}

.status-banner {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 12.5px;
  margin-bottom: 16px;
}

.status-success {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.38);
  color: #a7f3d0;
}

.status-error {
  background: rgba(244, 63, 94, 0.12);
  border: 1px solid rgba(244, 63, 94, 0.36);
  color: #fda4af;
}

.remember-card {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--input-bg, rgba(4, 9, 21, 0.72));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.2));
  cursor: pointer;
  margin-bottom: 16px;
  transition: border-color 0.2s ease;
}

.remember-card:hover:not(.remember-disabled) {
  border-color: var(--card-border-strong, rgba(56, 189, 248, 0.4));
}

.remember-disabled {
  opacity: 0.65;
  cursor: default;
}

.remember-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.35;
}

.remember-hint {
  font-size: 11px;
  color: var(--text-muted, #64748b);
  margin-top: 2px;
}

.cyber-checkbox {
  accent-color: #0284c7;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  cursor: pointer;
}

.action-btn-primary {
  width: 100%;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(2, 132, 199, 0.38);
  transition: all 0.2s ease;
}

.action-btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.action-btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  filter: none;
}

.btn-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.app-footer {
  text-align: center;
  padding: 6px 0 4px 0;
  font-size: 11px;
  color: var(--text-muted, #64748b);
  line-height: 1.45;
}

.footer-title {
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
}

:global(html.light) .status-success {
  background: rgba(16, 185, 129, 0.1);
  color: #065f46;
}

:global(html.light) .status-success .text-emerald-300 {
  color: #047857 !important;
}

:global(html.light) .status-success .text-emerald-200\/80 {
  color: #065f46 !important;
}

:global(html.light) .status-error {
  background: rgba(225, 29, 72, 0.08);
  color: #9f1239;
}
</style>
