<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useThemeStore } from '../stores/theme.ts';
import { api } from '../api/client.ts';
import { MailCheck, CheckCircle2, AlertCircle } from 'lucide-vue-next';

const route = useRoute();
const themeStore = useThemeStore();

const status = ref<'verifying' | 'success' | 'error'>('verifying');
const message = ref('Проверка токена подтверждения электронной почты...');

const brandBannerSrc = computed(() =>
  themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp'
);

onMounted(async () => {
  const userId = String(route.query.userId || '');
  const token = String(route.query.token || '');
  if (!userId || !token) {
    status.value = 'error';
    message.value = 'Неполная ссылка подтверждения email (отсутствует userId или token).';
    return;
  }

  try {
    await api.verifyEmailToken(userId, token);
    status.value = 'success';
    message.value = 'Ваш адрес электронной почты успешно подтверждён. Теперь вы можете войти в хранилище.';
  } catch (err: any) {
    status.value = 'error';
    message.value = err?.message || 'Не удалось подтвердить email — возможно, срок действия ссылки истёк.';
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col justify-between p-5 box-border">
    <header class="max-w-5xl w-full mx-auto flex justify-center">
      <router-link to="/"><img :src="brandBannerSrc" alt="NovusWarden" class="h-9 object-contain" /></router-link>
    </header>

    <main class="flex-1 flex items-center justify-center py-8">
      <div class="verify-card">
        <div class="emblem">
          <CheckCircle2 v-if="status === 'success'" class="w-8 h-8 text-emerald-400" />
          <AlertCircle v-else-if="status === 'error'" class="w-8 h-8 text-rose-400" />
          <MailCheck v-else class="w-8 h-8 text-sky-400 animate-pulse" />
        </div>
        <h1 class="text-xl font-bold m-0 mb-2">
          {{
            status === 'success'
              ? 'Email подтверждён'
              : status === 'error'
              ? 'Ошибка подтверждения'
              : 'Подтверждение Email...'
          }}
        </h1>
        <p class="text-xs text-slate-400 leading-relaxed m-0 mb-5">{{ message }}</p>
        <router-link to="/login" class="cyber-btn-primary w-full no-underline">
          Перейти ко входу
        </router-link>
      </div>
    </main>

    <footer class="text-center text-[11px] text-slate-500">
      NovusWarden • System Generations Core Novus
    </footer>
  </div>
</template>

<style scoped>
.verify-card {
  width: 100%;
  max-width: 420px;
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
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--input-bg);
  border: 1px solid rgba(56, 189, 248, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}
</style>
