<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth.ts';
import { useThemeStore } from '../stores/theme.ts';
import { api } from '../api/client.ts';
import { HelpCircle, Mail, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-vue-next';

const authStore = useAuthStore();
const themeStore = useThemeStore();

const email = ref(authStore.savedEmail || '');
const submitting = ref(false);
const sent = ref(false);
const feedback = ref('');
const errorMessage = ref('');

const brandBannerSrc = computed(() =>
  themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp'
);

async function handleRequestHint() {
  if (submitting.value || !email.value.trim()) return;
  submitting.value = true;
  errorMessage.value = '';
  feedback.value = '';
  try {
    await api.requestPasswordHint(email.value.trim().toLowerCase());
    sent.value = true;
    feedback.value =
      'Если для этого адреса задана подсказка мастер-пароля, мы отправили её на вашу электронную почту.';
  } catch (err: any) {
    errorMessage.value = err?.message || 'Не удалось запросить подсказку мастер-пароля';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col justify-between p-5 box-border">
    <header class="max-w-5xl w-full mx-auto flex justify-between items-center">
      <router-link to="/"><img :src="brandBannerSrc" alt="NovusWarden" class="h-9 object-contain" /></router-link>
      <router-link to="/login" class="cyber-btn-secondary h-8! px-3! no-underline">
        <ArrowLeft class="w-3.5 h-3.5" />
        <span>Назад ко входу</span>
      </router-link>
    </header>

    <main class="flex-1 flex items-center justify-center py-6">
      <div class="hint-card">
        <div class="emblem">
          <CheckCircle2 v-if="sent" class="w-7 h-7 text-emerald-400" />
          <HelpCircle v-else class="w-7 h-7 text-sky-400" />
        </div>
        <h1 class="text-xl font-bold m-0 mb-1.5">Подсказка мастер-пароля</h1>
        <p class="text-xs text-slate-400 leading-relaxed m-0 mb-5">
          В архитектуре Zero-Knowledge сервер не хранит ваш мастер-пароль, но может отправить на email сохранённую вами подсказку.
        </p>

        <div v-if="feedback" class="ok-box" role="status">
          <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          <span class="text-left">{{ feedback }}</span>
        </div>

        <div v-if="errorMessage" class="err-box" role="alert">
          <AlertCircle class="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <span class="text-left">{{ errorMessage }}</span>
        </div>

        <form class="w-full space-y-3 text-left" @submit.prevent="handleRequestHint">
          <div>
            <label class="text-[11.5px] font-semibold text-slate-300 block mb-1">Адрес электронной почты</label>
            <div class="relative flex items-center">
              <Mail class="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <input v-model="email" type="email" required placeholder="name@company.com" class="cyber-input pl-9!" />
            </div>
          </div>

          <button type="submit" class="cyber-btn-primary w-full h-10!" :disabled="submitting">
            {{ submitting ? 'Отправка...' : 'Отправить подсказку на Email' }}
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
.hint-card {
  width: 100%;
  max-width: 430px;
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
  background: var(--input-bg);
  border: 1px solid rgba(56, 189, 248, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}
.ok-box {
  width: 100%;
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #a7f3d0;
  font-size: 12px;
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
