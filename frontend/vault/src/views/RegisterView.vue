<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useThemeStore } from '../stores/theme.ts';
import { evaluatePasswordStrength, PasswordScore } from '../crypto/generator.ts';
import { useI18n, LOCALE_OPTIONS, type SupportedLocale } from '@shared/i18n.ts';
import {
  UserPlus,
  Mail,
  User,
  KeyRound,
  Eye,
  EyeOff,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Globe,
  Sun,
  Moon,
  Monitor,
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const { locale, t, setLocale, cycleLocale } = useI18n();

const verificationToken = computed(() => (route.query.token as string) || '');
const email = ref((route.query.email as string) || '');
const name = ref('');
const password = ref('');
const confirmPassword = ref('');
const passwordHint = ref('');
const showPassword = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');
const verificationSent = ref(false);

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

const selectedCulture = computed<SupportedLocale>({
  get: () => locale.value,
  set: (val) => setLocale(val),
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

const passwordStrength = computed<PasswordScore>(() => {
  return evaluatePasswordStrength(password.value);
});

async function handleRegister() {
  if (!email.value.trim()) {
    errorMessage.value = 'Пожалуйста, укажите email адрес';
    return;
  }
  if (!password.value) {
    errorMessage.value = 'Пожалуйста, задайте мастер-пароль';
    return;
  }
  if (password.value.length < 8) {
    errorMessage.value = 'Мастер-пароль должен содержать не менее 8 символов';
    return;
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Введённые пароли не совпадают';
    return;
  }

  errorMessage.value = '';
  verificationSent.value = false;
  isSubmitting.value = true;

  try {
    const res = await authStore.register(
      email.value,
      name.value,
      password.value,
      passwordHint.value,
      1, // Enforced Argon2id (strongest KDF)
      verificationToken.value || undefined,
      selectedCulture.value
    );
    if (res.needsEmailVerification) {
      verificationSent.value = true;
      return;
    }
    router.push('/vault');
  } catch (err: any) {
    errorMessage.value = err?.message || 'Ошибка регистрации аккаунта';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="register-wrapper">
    <!-- Top Bar -->
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

    <!-- Main Registration Card -->
    <main class="register-center">
      <div class="register-card">
        <!-- Vault Emblem -->
        <div class="lock-emblem-wrap">
          <img :src="lockLogoSrc" alt="NovusWarden" class="lock-emblem" />
        </div>

        <h1 class="register-title">{{ t('auth.registerTitle') }}</h1>
        <p class="register-subtitle">
          {{ t('auth.registerSubtitle') }}
        </p>

        <!-- Verification Sent Banner -->
        <div
          v-if="verificationSent"
          class="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-start gap-2 mb-3"
          role="status"
        >
          <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          <span>
            {{ t('auth.verificationSentPrefix') }} <strong>{{ email }}</strong> {{ t('auth.verificationSentSuffix') }}
          </span>
        </div>

        <!-- Error Banner -->
        <div v-if="errorMessage" class="error-banner" role="alert">
          <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Register Form -->
        <form @submit.prevent="handleRegister" class="auth-form" novalidate>
          <div class="grid grid-cols-2 gap-3">
            <!-- Email -->
            <div class="field-group">
              <label for="reg-email" class="field-label">Адрес email *</label>
              <div class="input-wrap">
                <Mail class="input-icon" />
                <input
                  id="reg-email"
                  v-model="email"
                  type="email"
                  autocomplete="email"
                  placeholder="name@company.com"
                  required
                  class="cyber-input"
                  :disabled="isSubmitting"
                />
              </div>
            </div>

            <!-- Name -->
            <div class="field-group">
              <label for="reg-name" class="field-label">Ваше имя</label>
              <div class="input-wrap">
                <User class="input-icon" />
                <input
                  id="reg-name"
                  v-model="name"
                  type="text"
                  autocomplete="name"
                  placeholder="Иван Иванов"
                  class="cyber-input"
                  :disabled="isSubmitting"
                />
              </div>
            </div>
          </div>

          <!-- Master Password -->
          <div class="field-group">
            <label for="reg-pwd" class="field-label">Мастер-пароль *</label>
            <div class="input-wrap">
              <KeyRound class="input-icon" />
              <input
                id="reg-pwd"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="Минимум 12 символов"
                required
                class="cyber-input pr-10"
                :disabled="isSubmitting"
              />
              <button
                type="button"
                class="password-toggle"
                @click="showPassword = !showPassword"
                tabindex="-1"
              >
                <component :is="showPassword ? EyeOff : Eye" class="w-4 h-4" />
              </button>
            </div>

            <!-- Password Strength Meter -->
            <div v-if="password" class="strength-meter">
              <div class="strength-bars">
                <div
                  v-for="i in 5"
                  :key="i"
                  class="strength-bar"
                  :style="{
                    backgroundColor: i - 1 <= passwordStrength.score ? passwordStrength.color : 'var(--input-border, rgba(148,163,184,0.25))'
                  }"
                ></div>
              </div>
              <div class="strength-meta">
                <span :style="{ color: passwordStrength.color }">
                  {{ passwordStrength.label }} ({{ passwordStrength.entropy }} бит)
                </span>
                <span>Взлом: {{ passwordStrength.estimatedCrackTime }}</span>
              </div>
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="field-group">
            <label for="reg-confirm-pwd" class="field-label">Подтвердите мастер-пароль *</label>
            <div class="input-wrap">
              <KeyRound class="input-icon" />
              <input
                id="reg-confirm-pwd"
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                placeholder="Повторите мастер-пароль"
                required
                class="cyber-input"
                :disabled="isSubmitting"
              />
            </div>
          </div>

          <!-- Language & Password Hint -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="field-group">
              <label for="reg-lang" class="field-label">{{ t('auth.languageLabel') }}</label>
              <div class="input-wrap">
                <Globe class="input-icon" />
                <select
                  id="reg-lang"
                  v-model="selectedCulture"
                  class="cyber-input"
                  :disabled="isSubmitting"
                >
                  <option v-for="opt in LOCALE_OPTIONS" :key="opt.code" :value="opt.code">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <p class="text-[10px] text-slate-400 mt-1 leading-tight">
                {{ t('auth.languageHint') }}
              </p>
            </div>

            <div class="field-group">
              <label for="reg-hint" class="field-label">{{ t('auth.passwordHintLabel') }}</label>
              <div class="input-wrap">
                <HelpCircle class="input-icon" />
                <input
                  id="reg-hint"
                  v-model="passwordHint"
                  type="text"
                  placeholder="Подсказка, если забудете пароль"
                  class="cyber-input"
                  :disabled="isSubmitting"
                />
              </div>
            </div>
          </div>

          <!-- Enforced Argon2id Security Badge -->
          <div class="kdf-selector">
            <div class="kdf-header">
              <Cpu class="w-3.5 h-3.5 text-emerald-400" />
              <span>{{ t('security.argon2Locked') }}</span>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="cyber-btn-primary"
            :disabled="isSubmitting"
          >
            <span v-if="!isSubmitting">{{ t('auth.registerSubmit') }}</span>
            <span v-else class="flex items-center gap-2">
              <span class="btn-spinner"></span>
              {{ t('common.loading') }}
            </span>
            <ArrowRight v-if="!isSubmitting" class="w-4 h-4" />
          </button>
        </form>

        <!-- Login Navigation -->
        <div class="login-redirect">
          <span>{{ t('auth.alreadyHaveAccount') }}</span>
          <router-link to="/login" class="login-link">
            {{ t('auth.signInLink') }}
          </router-link>
        </div>

        <div class="mt-2 text-center">
          <router-link to="/docs?tab=security" class="text-[11px] text-sky-400 hover:underline font-medium">
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
  </div>
</template>

<style scoped>
.register-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 12px 20px 12px 20px;
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

.register-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.register-card {
  width: 100%;
  max-width: 460px;
  padding: 22px 26px;
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
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--input-bg, rgba(2, 6, 23, 0.7));
  border: 1px solid rgba(56, 189, 248, 0.35);
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.lock-emblem {
  width: 38px;
  height: 38px;
  object-fit: contain;
}

.register-title {
  font-size: 19px;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.register-subtitle {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
  margin: 0 0 14px 0;
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
  padding: 7px 10px;
  font-size: 11.5px;
  color: #fb7185;
  margin-bottom: 12px;
}

.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.field-label {
  font-size: 11px;
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
  width: 14px;
  height: 14px;
  color: #64748b;
  pointer-events: none;
}

.cyber-input {
  width: 100%;
  box-sizing: border-box;
  height: 36px;
  padding: 0 10px 0 32px;
  background: var(--input-bg, rgba(3, 7, 18, 0.85));
  border: 1px solid var(--input-border, #334155);
  border-radius: 8px;
  color: var(--text-primary, #ffffff);
  font-size: 12.5px;
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
  padding: 0;
}

.strength-meter {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.strength-bars {
  display: flex;
  gap: 4px;
  height: 3px;
}

.strength-bar {
  flex: 1;
  border-radius: 2px;
  transition: background-color 0.25s ease;
}

.strength-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  color: #94a3b8;
}

.kdf-selector {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.kdf-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary, #cbd5e1);
  font-weight: 500;
}

.kdf-options {
  display: flex;
  gap: 6px;
}

.kdf-opt {
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
  color: #94a3b8;
  transition: all 0.2s ease;
}

.kdf-opt.active {
  background: rgba(14, 165, 233, 0.2);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  font-weight: 600;
}

.cyber-btn-primary {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
  transition: all 0.2s ease;
  margin-top: 4px;
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

.login-redirect {
  margin-top: 12px;
  font-size: 11.5px;
  color: var(--text-secondary, #94a3b8);
  display: flex;
  gap: 6px;
}

.login-link {
  color: #38bdf8;
  font-weight: 600;
  text-decoration: none;
}

.login-link:hover {
  text-decoration: underline;
}

.app-footer {
  text-align: center;
  line-height: 1.35;
  padding: 2px 0;
}

.footer-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
}

.footer-powered {
  font-size: 10px;
  color: var(--text-muted, #64748b);
  margin-top: 1px;
}
</style>

