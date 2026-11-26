<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useThemeStore } from '../stores/theme.ts';
import { getQueryParam } from '../crypto/webauthn.ts';
import { Building2, CheckCircle2, AlertCircle, X } from 'lucide-vue-next';

const themeStore = useThemeStore();

const status = ref<'loading' | 'handoff' | 'error'>('loading');
const message = ref('Завершение корпоративной авторизации SSO...');

const brandBannerSrc = computed(() =>
  themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp'
);

function extractReturnUri(state: string | null): string | null {
  if (!state) return null;
  const match = state.match(/_returnUri='([^']+)'/);
  return match ? match[1] : null;
}

function initiateBrowserSso(code: string | null, state: string | null, lastpass: boolean) {
  window.postMessage({ command: 'authResult', code, state, lastpass }, window.location.origin);
  const cookieVal = (`; ${document.cookie}`)
    .split('; ssoHandOffMessage=')
    .pop()
    ?.split(';')
    .shift();
  document.cookie = 'ssoHandOffMessage=;SameSite=strict;max-age=0';
  status.value = 'handoff';
  message.value =
    cookieVal && cookieVal.trim().length > 0
      ? decodeURIComponent(cookieVal)
      : 'Авторизация SSO передана в расширение браузера. Вы можете закрыть эту вкладку.';
}

function initiateWebAppSso(code: string | null, state: string | null) {
  const baseUrl = window.location.href.replace(/\/sso-connector\.html.*$/, '');
  const returnUri = extractReturnUri(state);
  if (returnUri) {
    window.location.href = `${baseUrl}/#${returnUri}`;
    return;
  }
  if (!code && !state) {
    const identifier = getQueryParam('identifier');
    if (identifier) {
      window.location.href = `${baseUrl}/identity/connect/authorize?ssoIdentifier=${encodeURIComponent(identifier)}`;
      return;
    }
    status.value = 'error';
    message.value = 'Отсутствуют параметры авторизации SSO (code / state).';
    return;
  }
  window.location.href = `${baseUrl}/#/login?ssoCode=${encodeURIComponent(code || '')}&ssoState=${encodeURIComponent(state || '')}`;
}

function closeTab() {
  window.close();
}

onMounted(() => {
  const code = getQueryParam('code');
  const state = getQueryParam('state');
  const lastpass = getQueryParam('lp');

  if (lastpass === '1') {
    initiateBrowserSso(code, state, true);
  } else if (state != null && state.includes(':clientId=browser')) {
    initiateBrowserSso(code, state, false);
  } else {
    initiateWebAppSso(code, state);
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col justify-between p-5 box-border">
    <header class="max-w-5xl w-full mx-auto flex justify-between items-center">
      <a href="/"><img :src="brandBannerSrc" alt="NovusWarden" class="h-9 object-contain" /></a>
    </header>

    <main class="flex-1 flex items-center justify-center py-8">
      <div class="sso-card">
        <div class="emblem">
          <CheckCircle2 v-if="status === 'handoff'" class="w-8 h-8 text-emerald-400" />
          <AlertCircle v-else-if="status === 'error'" class="w-8 h-8 text-rose-400" />
          <Building2 v-else class="w-8 h-8 text-sky-400 animate-pulse" />
        </div>
        <h1 class="text-lg font-bold m-0 mb-2">Единый вход (SSO)</h1>
        <p id="content" class="text-xs text-slate-400 leading-relaxed m-0 mb-5">{{ message }}</p>
        <div class="flex gap-2 justify-center">
          <button v-if="status === 'handoff'" type="button" class="cyber-btn-secondary" @click="closeTab">
            <X class="w-4 h-4" />
            <span>Закрыть вкладку</span>
          </button>
          <a v-if="status === 'error'" href="/#/login" class="cyber-btn-primary no-underline">
            Вернуться ко входу
          </a>
        </div>
      </div>
    </main>

    <footer class="text-center text-[11px] text-slate-500">
      NovusWarden • System Generations Core Novus
    </footer>
  </div>
</template>

<style scoped>
.sso-card {
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
