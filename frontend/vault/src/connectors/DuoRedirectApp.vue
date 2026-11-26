<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useThemeStore } from '../stores/theme.ts';
import { getQueryParam, buildMobileDeeplinkUri } from '../crypto/webauthn.ts';
import { ShieldCheck, CheckCircle2, AlertCircle, X } from 'lucide-vue-next';

const themeStore = useThemeStore();

const stateMode = ref<'loading' | 'done' | 'error'>('loading');
const title = ref('Проверка Duo Security...');
const subtitle = ref('Передача результата подтверждения...');
const countdown = ref<number | null>(null);
const showCloseBtn = ref(false);
let timer: any = null;

const brandBannerSrc = computed(() =>
  themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp'
);

function redirectToDuoFrameless(redirectUrl: string) {
  const duoHostRegex = /^api-[a-zA-Z0-9]+\.(duosecurity|duofederal)\.com$/;
  const parsed = new URL(redirectUrl);
  if (parsed.username || parsed.password) {
    throw new Error('Недопустимый URL Duo: встроенные учётные данные запрещены');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Недопустимый URL Duo: требуется HTTPS');
  }
  if (parsed.port && parsed.port !== '443') {
    throw new Error('Недопустимый URL Duo: нестандартный порт запрещён');
  }
  if (parsed.pathname !== '/oauth/v1/authorize') {
    throw new Error('Недопустимый путь авторизации Duo');
  }
  if (!duoHostRegex.test(parsed.hostname)) {
    throw new Error('Недопустимый домен Duo Security');
  }
  window.location.href = redirectUrl;
}

function showHandoff(client: string) {
  stateMode.value = 'done';
  title.value = 'Вход через Duo Security подтверждён';
  if (client === 'web') {
    countdown.value = 5;
    showCloseBtn.value = true;
    subtitle.value = 'Это окно закроется автоматически через 5 сек.';
    timer = setInterval(() => {
      if (countdown.value && countdown.value > 1) {
        countdown.value -= 1;
        subtitle.value = `Это окно закроется автоматически через ${countdown.value} сек.`;
      } else {
        if (timer) clearInterval(timer);
        window.close();
      }
    }, 1000);
  } else {
    subtitle.value = 'Авторизация передана в клиент — вы можете закрыть эту вкладку.';
  }
}

onMounted(() => {
  try {
    const redirectUrl = getQueryParam('duoFramelessUrl');
    if (redirectUrl) {
      redirectToDuoFrameless(redirectUrl);
      return;
    }

    const client = getQueryParam('client');
    const code = getQueryParam('code');
    const state = getQueryParam('state');

    if (!client || !code || !state) {
      throw new Error('Отсутствуют обязательные параметры Duo (client / code / state).');
    }

    if (client === 'web') {
      const channel = new BroadcastChannel('duoResult');
      channel.postMessage({ code, state });
      channel.close();
      showHandoff(client);
    } else if (client === 'browser') {
      window.postMessage({ command: 'duoResult', code, state }, window.location.origin);
      showHandoff(client);
    } else if (client === 'mobile') {
      const uri = `${buildMobileDeeplinkUri('duo')}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      document.location.replace(uri);
      showHandoff(client);
    } else if (client === 'desktop') {
      showHandoff(client);
      document.location.replace(
        `bitwarden://duo-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
      );
    } else {
      throw new Error(`Неизвестный тип клиента Duo: ${client}`);
    }
  } catch (err: any) {
    stateMode.value = 'error';
    title.value = 'Ошибка Duo Security';
    subtitle.value = err?.message || 'Не удалось завершить подтверждение Duo.';
  }
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function closeWindow() {
  window.close();
}
</script>

<template>
  <div class="min-h-screen flex flex-col justify-between p-5 box-border">
    <header class="max-w-5xl w-full mx-auto flex justify-center">
      <a href="/"><img :src="brandBannerSrc" alt="NovusWarden" class="h-9 object-contain" /></a>
    </header>

    <main class="flex-1 flex items-center justify-center py-8">
      <div class="duo-card">
        <div class="emblem">
          <CheckCircle2 v-if="stateMode === 'done'" class="w-8 h-8 text-emerald-400" />
          <AlertCircle v-else-if="stateMode === 'error'" class="w-8 h-8 text-rose-400" />
          <ShieldCheck v-else class="w-8 h-8 text-sky-400 animate-pulse" />
        </div>
        <h1 class="text-lg font-bold m-0 mb-2">{{ title }}</h1>
        <p id="content" class="text-xs text-slate-400 leading-relaxed m-0 mb-5">{{ subtitle }}</p>
        <button v-if="showCloseBtn" type="button" class="cyber-btn-primary" @click="closeWindow">
          <X class="w-4 h-4" />
          <span>Закрыть окно</span>
        </button>
      </div>
    </main>

    <footer class="text-center text-[11px] text-slate-500">
      NovusWarden • System Generations Core Novus
    </footer>
  </div>
</template>

<style scoped>
.duo-card {
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
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: var(--input-bg);
  border: 1px solid rgba(56, 189, 248, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}
</style>
