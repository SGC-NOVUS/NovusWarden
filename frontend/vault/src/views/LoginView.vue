<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useThemeStore } from '../stores/theme.ts';
import { api, TwoFactorRequiredError } from '../api/client.ts';
import { generateEphemeralKeyPair } from '../crypto/asymmetric.ts';
import {
  parseWebauthnRequestOptions,
  buildWebauthnAssertionJson,
  formatWebauthnError,
} from '../crypto/webauthn.ts';
import { useI18n } from '@shared/i18n.ts';
import {
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Building2,
  AlertCircle,
  Globe,
  Sun,
  Moon,
  Monitor,
  LogOut,
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const { locale, t, cycleLocale } = useI18n();

const email = ref(authStore.savedEmail || '');
const password = ref('');
const rememberEmail = ref(true);
const showPassword = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');
const showSsoModal = ref(false);
const ssoOrgId = ref('');

// Login with Device (Auth Request) state
const showDeviceLoginModal = ref(false);
const deviceLoginStatus = ref<'idle' | 'waiting' | 'error'>('idle');
const deviceLoginCode = ref('');
const deviceLoginError = ref('');
let devicePollTimer: any = null;
let ephemeralKeyPair: { publicKeyB64: string; privateKey: CryptoKey } | null = null;

function stopDeviceLoginPoll() {
  if (devicePollTimer) {
    clearInterval(devicePollTimer);
    devicePollTimer = null;
  }
}

onUnmounted(() => {
  stopDeviceLoginPoll();
});

function generateReadableAccessCode(): string {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

async function handleStartDeviceLogin() {
  const targetEmail = (isUnlockMode.value ? authStore.savedEmail : email.value).trim();
  if (!targetEmail) {
    errorMessage.value = 'Сначала введите адрес электронной почты';
    return;
  }
  errorMessage.value = '';
  deviceLoginError.value = '';
  deviceLoginStatus.value = 'waiting';
  showDeviceLoginModal.value = true;
  stopDeviceLoginPoll();

  try {
    ephemeralKeyPair = await generateEphemeralKeyPair();
    const accessCode = generateReadableAccessCode();
    deviceLoginCode.value = accessCode;
    const req = await api.createAuthRequest(targetEmail, ephemeralKeyPair.publicKeyB64, accessCode);
    const reqId = req.id;

    devicePollTimer = setInterval(async () => {
      try {
        const res = await api.pollAuthRequestResponse(reqId, accessCode);
        if (res?.requestApproved && res?.key && ephemeralKeyPair) {
          stopDeviceLoginPoll();
          await authStore.loginWithAuthRequest(
            targetEmail,
            accessCode,
            reqId,
            res.key,
            ephemeralKeyPair.privateKey
          );
          showDeviceLoginModal.value = false;
          const redirectUrl = (route.query.redirect as string) || '/vault';
          router.push(redirectUrl);
        }
      } catch (pollErr: any) {
        deviceLoginError.value = pollErr?.message || 'Запрос не одобрен или истёк';
        deviceLoginStatus.value = 'error';
        stopDeviceLoginPoll();
      }
    }, 2500);
  } catch (err: any) {
    deviceLoginError.value = err?.message || 'Не удалось создать запрос входа';
    deviceLoginStatus.value = 'error';
  }
}

function closeDeviceLoginModal() {
  stopDeviceLoginPoll();
  showDeviceLoginModal.value = false;
}

// 2FA state
const twoFactorStep = ref(false);
const twoFactorProviders = ref<string[]>([]);
const selectedTwoFactorProvider = ref<number>(0);
const twoFactorCode = ref('');
const rememberTwoFactor = ref(false);
const emailCodeSent = ref(false);

const isUnlockMode = computed(() => authStore.isLocked && !!authStore.savedEmail && !twoFactorStep.value);

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

const lockLogoSrc = computed(() => {
  return themeStore.isDark
    ? '/vw_static/novuswarden_storage_lock_black_crisp.webp'
    : '/vw_static/novuswarden_storage_lock_white_crisp.webp';
});

const brandBannerSrc = computed(() => {
  return themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp';
});

function providerLabel(code: string): string {
  switch (code) {
    case '0': return 'Приложение-аутентификатор (TOTP)';
    case '1': return 'Код на Email';
    case '2':
    case '6':
      return 'Duo Security (Push)';
    case '3': return 'Аппаратный ключ YubiKey';
    case '7': return 'Ключ безопасности (WebAuthn / FIDO2)';
    case '8': return 'Код восстановления (Recovery Code)';
    default: return `Провайдер #${code}`;
  }
}

async function handleSendEmail2fa() {
  errorMessage.value = '';
  try {
    await authStore.requestEmailTwoFactor();
    emailCodeSent.value = true;
  } catch (err: any) {
    errorMessage.value = err?.message || 'Ошибка отправки кода 2FA';
  }
}

function handleSwitchAccount() {
  authStore.logout();
  twoFactorStep.value = false;
  password.value = '';
  twoFactorCode.value = '';
  errorMessage.value = '';
}

function handleSsoContinue() {
  const org = ssoOrgId.value.trim();
  if (!org) return;
  showSsoModal.value = false;
  window.location.href = `/sso-connector.html?identifier=${encodeURIComponent(org)}`;
}

async function handleLogin() {
  if (isSubmitting.value) return;

  const targetEmail = isUnlockMode.value ? authStore.savedEmail : email.value;
  if (!targetEmail.trim()) {
    errorMessage.value = 'Пожалуйста, введите адрес электронной почты';
    return;
  }
  if (!password.value) {
    errorMessage.value = 'Пожалуйста, введите мастер-пароль';
    return;
  }
  if (twoFactorStep.value && selectedTwoFactorProvider.value !== 7 && !twoFactorCode.value.trim()) {
    errorMessage.value = 'Введите код двухфакторной аутентификации';
    return;
  }

  errorMessage.value = '';
  isSubmitting.value = true;

  try {
    if (isUnlockMode.value && !twoFactorStep.value) {
      await authStore.unlock(password.value);
    } else if (twoFactorStep.value && selectedTwoFactorProvider.value === 7) {
      if (typeof navigator === 'undefined' || !('credentials' in navigator)) {
        throw new Error('WebAuthn не поддерживается в текущем браузере');
      }
      const rawWebauthn = authStore.pendingTwoFactor?.providers2?.['7'];
      if (!rawWebauthn) {
        throw new Error('Параметры вызова WebAuthn не получены от сервера');
      }
      const publicKey = parseWebauthnRequestOptions(rawWebauthn);
      const asserted = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
      if (!asserted) {
        throw new Error('Не получен ответ от ключа безопасности');
      }
      const assertionJson = buildWebauthnAssertionJson(asserted);
      await authStore.login(targetEmail, password.value, rememberEmail.value, {
        token: assertionJson,
        provider: 7,
        remember: rememberTwoFactor.value,
      });
    } else {
      await authStore.login(
        targetEmail,
        password.value,
        rememberEmail.value,
        twoFactorStep.value
          ? {
              token: twoFactorCode.value.replace(/\s+/g, ''),
              provider: selectedTwoFactorProvider.value,
              remember: rememberTwoFactor.value,
            }
          : undefined
      );
    }
    const redirectUrl = (route.query.redirect as string) || '/vault';
    router.push(redirectUrl);
  } catch (err: any) {
    if (err instanceof TwoFactorRequiredError) {
      twoFactorStep.value = true;
      twoFactorProviders.value = err.providers;
      const preferred =
        err.providers.find((p) => p === '0') ??
        err.providers.find((p) => p === '7') ??
        err.providers.find((p) => p === '1') ??
        err.providers.find((p) => p === '3') ??
        err.providers[0] ??
        '0';
      const firstProvider = parseInt(preferred, 10);
      selectedTwoFactorProvider.value = isNaN(firstProvider) ? 0 : firstProvider;
      twoFactorCode.value = '';
      emailCodeSent.value = false;
      if (selectedTwoFactorProvider.value === 1) {
        await handleSendEmail2fa().catch(() => {});
      }
      return;
    }
    if (twoFactorStep.value && selectedTwoFactorProvider.value === 7 && err?.name) {
      errorMessage.value = formatWebauthnError(err, locale.value);
    } else {
      errorMessage.value = err?.message || 'Неверный логин или мастер-пароль';
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="login-wrapper">
    <!-- Top Bar: Logo & Theme Switcher -->
    <header class="top-nav">
      <div class="brand-container">
        <img :src="brandBannerSrc" alt="NovusWarden" class="nav-banner" />
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="theme-pill"
          @click="cycleLocale"
          :title="t('lang.label')"
        >
          <Globe class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ locale.toUpperCase() }}</span>
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

    <!-- Main Auth Container (Zero vertical scroll) -->
    <main class="login-center">
      <div class="login-card">
        <!-- Vault Lock Icon -->
        <div class="lock-emblem-wrap">
          <img :src="lockLogoSrc" alt="NovusWarden Lock" class="lock-emblem" />
        </div>

        <h1 class="login-title">
          {{ twoFactorStep ? t('auth.twoFactorTitle') : isUnlockMode ? t('auth.unlockTitle') : t('auth.loginTitle') }}
        </h1>
        <p class="login-subtitle">
          {{
            twoFactorStep
              ? t('auth.twoFactorSubtitle')
              : isUnlockMode
              ? `${t('auth.unlockTitle')} (${authStore.savedEmail})`
              : t('auth.loginSubtitle')
          }}
        </p>

        <!-- Error Banner -->
        <div v-if="errorMessage" class="error-banner" role="alert">
          <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Login / Unlock / 2FA Form -->
        <form @submit.prevent="handleLogin" class="auth-form" novalidate>
          <template v-if="twoFactorStep">
            <div v-if="twoFactorProviders.length > 1" class="field-group">
              <label class="field-label">Способ подтверждения</label>
              <select v-model.number="selectedTwoFactorProvider" class="cyber-input pl-3!">
                <option v-for="p in twoFactorProviders" :key="p" :value="Number(p)">
                  {{ providerLabel(p) }}
                </option>
              </select>
            </div>

            <div v-if="selectedTwoFactorProvider === 7" class="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs text-slate-300 leading-relaxed">
              Нажмите <strong class="text-sky-300">«Считать ключ безопасности»</strong> и приложите аппаратный ключ FIDO2 или подтвердите Passkey в браузере.
            </div>

            <div v-else class="field-group">
              <div class="flex justify-between items-center mb-1">
                <label for="twofactor-code" class="field-label mb-0!">Код подтверждения</label>
                <button
                  v-if="selectedTwoFactorProvider === 1"
                  type="button"
                  class="text-[11px] text-sky-400 hover:underline"
                  @click="handleSendEmail2fa"
                >
                  {{ emailCodeSent ? 'Отправить повторно' : 'Отправить код на email' }}
                </button>
              </div>
              <div class="input-wrap">
                <ShieldCheck class="input-icon" />
                <input
                  id="twofactor-code"
                  v-model="twoFactorCode"
                  type="text"
                  autocomplete="one-time-code"
                  placeholder="Введите 6-значный код"
                  required
                  class="cyber-input"
                  :disabled="isSubmitting"
                />
              </div>
            </div>

            <div class="remember-row">
              <label class="remember-label">
                <input v-model="rememberTwoFactor" type="checkbox" class="cyber-checkbox" />
                <span>Запомнить это устройство на 30 дней</span>
              </label>
              <div class="flex items-center gap-3">
                <router-link to="/recover-2fa" class="text-[11px] text-amber-400/90 hover:underline">
                  Потеряли 2FA?
                </router-link>
                <button type="button" class="text-xs text-slate-400 hover:text-sky-400" @click="twoFactorStep = false">
                  Назад
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <!-- Email Field (hidden in Unlock mode) -->
            <div v-if="!isUnlockMode" class="field-group">
              <label for="email" class="field-label">{{ t('auth.emailLabel') }}</label>
              <div class="input-wrap">
                <Mail class="input-icon" />
                <input
                  id="email"
                  v-model="email"
                  type="email"
                  autocomplete="username"
                  placeholder="name@company.com"
                  required
                  class="cyber-input"
                  :disabled="isSubmitting"
                />
              </div>
            </div>

            <!-- Password Field -->
            <div class="field-group">
              <div class="flex justify-between items-center mb-1">
                <label for="password" class="field-label mb-0!">{{ t('auth.passwordLabel') }}</label>
              </div>
              <div class="input-wrap">
                <KeyRound class="input-icon" />
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="••••••••••••••••"
                  required
                  class="cyber-input pr-10"
                  :disabled="isSubmitting"
                />
                <button
                  type="button"
                  class="password-toggle"
                  @click="showPassword = !showPassword"
                  tabindex="-1"
                  title="Показать / скрыть пароль"
                >
                  <component :is="showPassword ? EyeOff : Eye" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Remember Email Checkbox + Hint link -->
            <div v-if="!isUnlockMode" class="remember-row">
              <label class="remember-label">
                <input
                  v-model="rememberEmail"
                  type="checkbox"
                  class="cyber-checkbox"
                />
                <span>{{ t('auth.rememberEmail') }}</span>
              </label>
              <router-link to="/hint" class="text-[11px] text-sky-400/90 hover:text-sky-300 hover:underline">
                Забыли пароль?
              </router-link>
            </div>
          </template>

          <!-- Submit Button -->
          <button
            type="submit"
            class="cyber-btn-primary"
            :disabled="isSubmitting"
          >
            <span v-if="!isSubmitting">
              {{
                twoFactorStep
                  ? selectedTwoFactorProvider === 7
                    ? 'Считать ключ безопасности'
                    : t('auth.verifySubmit')
                  : isUnlockMode
                  ? t('auth.unlockSubmit')
                  : t('auth.loginSubmit')
              }}
            </span>
            <span v-else class="flex items-center gap-2">
              <span class="btn-spinner"></span>
              {{
                twoFactorStep && selectedTwoFactorProvider === 7
                  ? 'Ожидание ключа безопасности...'
                  : 'Расшифровка ключей...'
              }}
            </span>
            <ArrowRight v-if="!isSubmitting" class="w-4 h-4" />
          </button>

          <button
            v-if="isUnlockMode"
            type="button"
            class="cyber-btn-sso"
            @click="handleSwitchAccount"
          >
            <LogOut class="w-4 h-4 text-rose-400" />
            <span>Выйти и сменить аккаунт</span>
          </button>

          <!-- SSO & Device Login Buttons -->
          <div v-else-if="!twoFactorStep" class="space-y-2">
            <button
              type="button"
              class="cyber-btn-sso"
              @click="handleStartDeviceLogin"
            >
              <ShieldCheck class="w-4 h-4 text-emerald-400" />
              <span>Войти с другого устройства</span>
            </button>
            <button
              type="button"
              class="cyber-btn-sso"
              @click="showSsoModal = true"
            >
              <Building2 class="w-4 h-4 text-sky-400" />
              <span>Использовать единый вход (SSO)</span>
            </button>
          </div>
        </form>

        <!-- Signup Navigation -->
        <div class="signup-footer">
          <span>{{ t('auth.noAccount') }}</span>
          <router-link to="/signup" class="signup-link">
            {{ t('auth.createAccount') }}
          </router-link>
        </div>

        <div class="mt-2 text-center">
          <router-link to="/docs" class="text-[11px] text-sky-400 hover:underline font-medium">
            {{ t('nav.docs') }} • Zero-Knowledge & Security →
          </router-link>
        </div>
      </div>
    </main>

    <!-- Localized Footer -->
    <footer class="app-footer">
      <div class="footer-title">NovusWarden Web 2026.7.0</div>
      <div class="footer-powered">
        Работает на платформе SGC-NOVUS<br />
        System Generations Core Novus
      </div>
    </footer>

    <!-- SSO Modal -->
    <div v-if="showSsoModal" class="modal-backdrop" @click.self="showSsoModal = false">
      <div class="modal-card">
        <h3 class="modal-title">Вход через корпоративный SSO</h3>
        <p class="modal-desc">
          Введите идентификатор организации для перехода на защищённый IdP-сервер:
        </p>
        <input
          v-model="ssoOrgId"
          type="text"
          placeholder="org-id (например: acme-corp)"
          class="cyber-input mb-4"
        />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="cyber-btn-secondary h-8! px-3!"
            @click="showSsoModal = false"
          >
            Отмена
          </button>
          <button
            type="button"
            class="cyber-btn-primary h-8! px-4!"
            @click="handleSsoContinue"
          >
            Продолжить
          </button>
        </div>
      </div>
    </div>

    <!-- Login With Device Modal -->
    <div v-if="showDeviceLoginModal" class="modal-backdrop" @click.self="closeDeviceLoginModal">
      <div class="modal-card">
        <h3 class="modal-title">Вход с другого устройства</h3>
        <p class="modal-desc">
          Откройте авторизованное приложение или настройки NovusWarden («Безопасность → Ожидающие запросы входа») и одобрите запрос для <strong class="text-slate-200">{{ isUnlockMode ? authStore.savedEmail : email }}</strong>.
        </p>
        <div class="p-3 rounded-lg bg-black/30 border border-slate-800 mb-3 text-center">
          <div class="text-[11px] text-slate-400 mb-1">Код проверки запроса (Access Code)</div>
          <code class="font-mono text-sm text-emerald-400 tracking-wider select-all">{{ deviceLoginCode }}</code>
        </div>
        <div v-if="deviceLoginStatus === 'waiting'" class="text-xs text-sky-400 flex items-center gap-2 mb-4">
          <span class="btn-spinner"></span>
          <span>Ожидание подтверждения на доверенном устройстве...</span>
        </div>
        <div v-if="deviceLoginError" class="text-xs text-rose-400 mb-4">
          {{ deviceLoginError }}
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="cyber-btn-secondary h-8! px-3!" @click="closeDeviceLoginModal">
            Отмена
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
  padding: 12px 20px 8px 20px;
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
  display: flex;
  align-items: center;
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

.login-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 24px 28px;
  border-radius: 16px;
  background: var(--card-bg, rgba(10, 18, 35, 0.88));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.28));
  box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.75), 0 0 25px rgba(14, 165, 233, 0.12);
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lock-emblem-wrap {
  width: 58px;
  height: 58px;
  border-radius: 14px;
  background: var(--input-bg, rgba(2, 6, 23, 0.7));
  border: 1px solid rgba(56, 189, 248, 0.35);
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.lock-emblem {
  width: 44px;
  height: 44px;
  object-fit: contain;
}

.login-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px 0;
  letter-spacing: -0.02em;
}

.login-subtitle {
  font-size: 11.5px;
  color: var(--text-secondary, #94a3b8);
  margin: 0 0 16px 0;
  text-align: center;
}

.error-banner {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(244, 63, 94, 0.12);
  border: 1px solid rgba(244, 63, 94, 0.35);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: #fb7185;
  margin-bottom: 14px;
}

.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary, #cbd5e1);
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 10px;
  width: 15px;
  height: 15px;
  color: #64748b;
  pointer-events: none;
}

.cyber-input {
  width: 100%;
  box-sizing: border-box;
  height: 38px;
  padding: 0 12px 0 34px;
  background: var(--input-bg, rgba(3, 7, 18, 0.85));
  border: 1px solid var(--input-border, #334155);
  border-radius: 8px;
  color: var(--text-primary, #ffffff);
  font-size: 13px;
  outline: none;
  transition: all 0.2s ease;
}

.cyber-input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.25);
}

.password-toggle {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.password-toggle:hover {
  color: #38bdf8;
}

.remember-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
}

.remember-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary, #94a3b8);
  cursor: pointer;
}

.cyber-checkbox {
  accent-color: #0284c7;
  cursor: pointer;
}

.cyber-btn-primary {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
  transition: all 0.2s ease;
}

.cyber-btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.cyber-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.cyber-btn-sso {
  width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 8px;
  color: #38bdf8;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cyber-btn-sso:hover {
  background: rgba(14, 165, 233, 0.15);
  border-color: #38bdf8;
}

.signup-footer {
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  display: flex;
  gap: 6px;
}

.signup-link {
  color: #38bdf8;
  font-weight: 600;
  text-decoration: none;
}

.signup-link:hover {
  text-decoration: underline;
}

.app-footer {
  text-align: center;
  line-height: 1.35;
  padding: 4px 0;
}

.footer-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
}

.footer-powered {
  font-size: 10.5px;
  color: var(--text-muted, #64748b);
  margin-top: 2px;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 380px;
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, #1e293b);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.modal-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 6px 0;
}

.modal-desc {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  margin: 0 0 14px 0;
}
</style>

