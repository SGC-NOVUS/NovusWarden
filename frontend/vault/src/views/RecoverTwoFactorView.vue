<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useThemeStore } from '../stores/theme.ts';
import { ShieldOff, Mail, KeyRound, LifeBuoy, AlertCircle, ArrowLeft } from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();

const email = ref(authStore.savedEmail || '');
const masterPassword = ref('');
const recoveryCode = ref('');
const submitting = ref(false);
const errorMessage = ref('');

const brandBannerSrc = computed(() =>
  themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp'
);

async function handleRecover() {
  if (submitting.value) return;
  const normEmail = email.value.trim();
  const cleanCode = recoveryCode.value.replace(/\s+/g, '');
  if (!normEmail || !masterPassword.value || !cleanCode) {
    errorMessage.value = 'Заполните email, мастер-пароль и одноразовый код восстановления 2FA';
    return;
  }

  submitting.value = true;
  errorMessage.value = '';
  try {
    // Provider 8 = RecoveryCode (disables all 2FA providers & unlocks account)
    await authStore.login(normEmail, masterPassword.value, true, {
      token: cleanCode,
      provider: 8,
      remember: false,
    });
    router.push('/settings/security');
  } catch (err: any) {
    errorMessage.value = err?.message || 'Неверный код восстановления или мастер-пароль';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col justify-between p-5 box-border">
    <header class="max-w-5xl w-full mx-auto flex justify-between items-center">
      <router-link to="/"><img :src="brandBannerSrc" alt="NovusWarden" class="h-9 object-contain" /></router-link>
      <router-link to="/login" class="cyber-btn-secondary !h-8 !px-3 no-underline">
        <ArrowLeft class="w-3.5 h-3.5" />
        <span>Назад ко входу</span>
      </router-link>
    </header>

    <main class="flex-1 flex items-center justify-center py-6">
      <div class="recover-card">
        <div class="emblem">
          <ShieldOff class="w-7 h-7 text-amber-400" />
        </div>
        <h1 class="text-xl font-bold m-0 mb-1.5">Сброс двухфакторной защиты (2FA)</h1>
        <p class="text-xs text-slate-400 leading-relaxed m-0 mb-5">
          Используйте резервный <strong>Recovery Code</strong>, чтобы отключить утерянный 2FA и вернуть доступ к аккаунту. После входа сразу настройте новый TOTP или ключ FIDO2.
        </p>

        <div v-if="errorMessage" class="err-box" role="alert">
          <AlertCircle class="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <span class="text-left">{{ errorMessage }}</span>
        </div>

        <form class="w-full space-y-3 text-left" @submit.prevent="handleRecover">
          <div>
            <label class="text-[11.5px] font-semibold text-slate-300 block mb-1">Email</label>
            <div class="relative flex items-center">
              <Mail class="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <input v-model="email" type="email" required placeholder="name@company.com" class="cyber-input !pl-9" />
            </div>
          </div>

          <div>
            <label class="text-[11.5px] font-semibold text-slate-300 block mb-1">Мастер-пароль</label>
            <div class="relative flex items-center">
              <KeyRound class="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <input v-model="masterPassword" type="password" required placeholder="••••••••••••••••" class="cyber-input !pl-9" />
            </div>
          </div>

          <div>
            <label class="text-[11.5px] font-semibold text-slate-300 block mb-1">Код восстановления (Recovery Code)</label>
            <div class="relative flex items-center">
              <LifeBuoy class="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <input
                v-model="recoveryCode"
                type="text"
                required
                placeholder="XXXX XXXX XXXX XXXX..."
                class="cyber-input !pl-9 font-mono uppercase tracking-wider"
              />
            </div>
          </div>

          <button type="submit" class="cyber-btn-primary w-full !h-10 mt-2" :disabled="submitting">
            {{ submitting ? 'Проверка и сброс 2FA...' : 'Сбросить 2FA и войти' }}
          </button>
        </form>
      </div>
    </main>

    <footer class="text-center text-[11px] text-slate-500">
      NovusWarden • System Generations Core Novus
    </footer>
  </div>
</template>

<style scoped>
.recover-card {
  width: 100%;
  max-width: 440px;
  padding: 28px;
  border-radius: 18px;
  background: var(--card-bg);
  border: 1px solid var(--card-border-strong);
  box-shadow: var(--card-shadow);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.emblem {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}
.err-box {
  width: 100%;
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(244, 63, 94, 0.12);
  border: 1px solid rgba(244, 63, 94, 0.35);
  color: #fda4af;
  font-size: 12px;
  margin-bottom: 14px;
}
</style>
