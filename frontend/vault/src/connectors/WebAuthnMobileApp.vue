<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useThemeStore } from '../stores/theme.ts';
import { useI18n } from '@shared/i18n.ts';
import {
  getQueryParam,
  base64DecodeUtf8,
  parseWebauthnRequestOptions,
  buildWebauthnAssertionJson,
  resolveWebauthnCallbackUri,
  formatWebauthnError,
} from '../crypto/webauthn.ts';
import { KeyRound, Fingerprint, CheckCircle2, AlertCircle, ShieldCheck, ArrowUpRight } from 'lucide-vue-next';

const themeStore = useThemeStore();
const { locale } = useI18n();

const headerText = ref('Подтвердите вход ключом безопасности');
const btnText = ref('Считать ключ безопасности');
const btnReturnText = ref('Вернуться в приложение');
const isReading = ref(false);
const errorMessage = ref('');
const returnUri = ref<string | null>(null);
const hasPayload = ref(false);

let parsedObj: PublicKeyCredentialRequestOptions | null = null;
let callbackUri: string | null = null;

const brandBannerSrc = computed(() =>
  themeStore.isDark
    ? '/vw_static/novuswarden_banner_black_trans.webp'
    : '/vw_static/novuswarden_banner_white_trans.webp'
);

function parseParams() {
  const rawData = getQueryParam('data');
  if (!rawData) {
    errorMessage.value = 'Отсутствуют данные WebAuthn (data). Повторите вход из мобильного приложения.';
    return;
  }

  const version = getQueryParam('v');
  try {
    if (version === '1') {
      const jsonStr = base64DecodeUtf8(rawData, true);
      parsedObj = parseWebauthnRequestOptions(jsonStr);
      const h = getQueryParam('headerText');
      const b = getQueryParam('btnText');
      const r = getQueryParam('btnReturnText');
      if (h) headerText.value = decodeURI(h);
      if (b) btnText.value = decodeURI(b);
      if (r) btnReturnText.value = decodeURI(r);
      callbackUri = 'bitwarden://webauthn-callback';
    } else {
      const dataObj = JSON.parse(base64DecodeUtf8(rawData, true));
      callbackUri = resolveWebauthnCallbackUri(dataObj) || 'bitwarden://webauthn-callback';
      parsedObj = parseWebauthnRequestOptions(dataObj.data);
      if (dataObj.headerText) headerText.value = decodeURI(dataObj.headerText);
      if (dataObj.btnText) btnText.value = decodeURI(dataObj.btnText);
      if (dataObj.btnReturnText) btnReturnText.value = decodeURI(dataObj.btnReturnText);
    }
    hasPayload.value = true;
  } catch {
    errorMessage.value = 'Не удалось разобрать параметры вызова WebAuthn.';
  }
}

async function handleAction() {
  if (returnUri.value) {
    document.location.replace(returnUri.value);
    return;
  }
  if (!parsedObj || isReading.value) return;
  if (!('credentials' in navigator)) {
    errorMessage.value = 'WebAuthn не поддерживается в этом браузере.';
    return;
  }

  errorMessage.value = '';
  isReading.value = true;
  try {
    const cred = (await navigator.credentials.get({ publicKey: parsedObj })) as PublicKeyCredential | null;
    if (!cred) throw new Error('Пустой ответ от ключа безопасности');
    const dataString = buildWebauthnAssertionJson(cred);
    const uri = `${callbackUri}?data=${encodeURIComponent(dataString)}`;
    returnUri.value = uri;
    document.location.replace(uri);
  } catch (err) {
    errorMessage.value = formatWebauthnError(err, locale.value);
    if (callbackUri) {
      returnUri.value = `${callbackUri}?error=${encodeURIComponent(errorMessage.value)}`;
    }
  } finally {
    isReading.value = false;
  }
}

onMounted(parseParams);
</script>

<template>
  <div class="min-h-screen flex flex-col justify-between p-5 box-border">
    <header class="flex justify-center pt-2">
      <img :src="brandBannerSrc" alt="NovusWarden" class="h-9 object-contain" />
    </header>

    <main class="flex-1 flex items-center justify-center py-6">
      <div class="mobile-card">
        <div class="emblem">
          <CheckCircle2 v-if="returnUri && !errorMessage" class="w-8 h-8 text-emerald-400" />
          <Fingerprint v-else-if="isReading" class="w-8 h-8 text-sky-300 animate-pulse" />
          <KeyRound v-else class="w-8 h-8 text-sky-400" />
        </div>

        <span class="badge">
          <ShieldCheck class="w-3.5 h-3.5 text-sky-400" />
          <span>Mobile FIDO2 / Passkey</span>
        </span>

        <h1 id="webauthn-header" class="text-lg font-bold m-0 mt-2 mb-4 leading-snug">
          {{ headerText }}
        </h1>

        <div v-if="errorMessage" class="err-box" role="alert">
          <AlertCircle class="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <span class="text-left">{{ errorMessage }}</span>
        </div>

        <button
          id="webauthn-button"
          type="button"
          class="cyber-btn-primary w-full h-11! text-sm!"
          :disabled="isReading || (!hasPayload && !returnUri)"
          @click="handleAction"
        >
          <ArrowUpRight v-if="returnUri" class="w-4 h-4" />
          <KeyRound v-else class="w-4 h-4" />
          <span>{{ returnUri ? btnReturnText : isReading ? 'Ожидание ключа...' : btnText }}</span>
        </button>
      </div>
    </main>

    <footer class="text-center text-[11px] text-slate-500 pb-2">
      NovusWarden • System Generations Core Novus
    </footer>
  </div>
</template>

<style scoped>
.mobile-card {
  width: 100%;
  max-width: 390px;
  padding: 28px 24px;
  border-radius: 18px;
  background: var(--card-bg, rgba(13, 22, 41, 0.9));
  border: 1px solid var(--card-border-strong, rgba(56, 189, 248, 0.3));
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
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  background: rgba(14, 165, 233, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.25);
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
