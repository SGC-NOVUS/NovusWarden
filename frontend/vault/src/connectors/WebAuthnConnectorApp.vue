<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  getQueryParam,
  base64DecodeUtf8,
  parseWebauthnRequestOptions,
  buildWebauthnAssertionJson,
  resolveConnectorPostMessageOrigin,
  resolveWebauthnCallbackUri,
} from '../crypto/webauthn.ts';
import { KeyRound } from 'lucide-vue-next';

const buttonLabel = ref('Считать ключ безопасности');
const isAwaiting = ref(false);
const returnUri = ref<string | null>(null);

let parsed = false;
let webauthnJson: any = null;
let parsedObj: PublicKeyCredentialRequestOptions | null = null;
let parentUrl: string | null = null;
let parentOrigin: string | null = null;
let postMessageOrigin: string | null = null;
let callbackUri: string | null = null;
let mobileResponse = false;
let sentSuccess = false;
let stopWebAuthn = false;

let btnText = 'Считать ключ безопасности';
let btnAwaitingText = 'Ожидание ключа безопасности...';
let btnReturnText = 'Вернуться в приложение';

function notifyInfo(message: string) {
  if (mobileResponse || !parentUrl || !postMessageOrigin) return;
  window.parent.postMessage(`info|${message}`, postMessageOrigin);
}

function notifyError(message: string) {
  isAwaiting.value = false;
  if (callbackUri) {
    const uri = `${callbackUri}?error=${encodeURIComponent(message)}`;
    returnUri.value = uri;
    buttonLabel.value = btnReturnText;
    document.location.replace(uri);
  } else if (parentUrl && postMessageOrigin) {
    window.parent.postMessage(`error|${message}`, postMessageOrigin);
    buttonLabel.value = btnText;
  }
}

function notifySuccess(cred: PublicKeyCredential) {
  if (sentSuccess) return;
  const dataString = buildWebauthnAssertionJson(cred);
  isAwaiting.value = false;
  if (callbackUri) {
    const uri = `${callbackUri}?data=${encodeURIComponent(dataString)}`;
    returnUri.value = uri;
    buttonLabel.value = btnReturnText;
    document.location.replace(uri);
  } else if (parentUrl && postMessageOrigin) {
    window.parent.postMessage(`success|${dataString}`, postMessageOrigin);
    sentSuccess = true;
  }
}

function parseParameters() {
  if (parsed) return;

  const rawParent = getQueryParam('parent');
  if (rawParent) {
    parentUrl = decodeURIComponent(rawParent);
    try {
      parentOrigin = new URL(parentUrl).origin;
    } catch {
      parentOrigin = null;
    }
  }
  postMessageOrigin = resolveConnectorPostMessageOrigin(parentUrl);

  const version = getQueryParam('v');
  const rawData = getQueryParam('data');
  if (!rawData) {
    notifyError('No data.');
    return;
  }

  if (version === '1') {
    try {
      webauthnJson = base64DecodeUtf8(rawData, true);
    } catch {
      notifyError('Cannot parse data.');
      return;
    }
    btnText = decodeURI(getQueryParam('btnText') || btnText);
    btnAwaitingText = decodeURI(getQueryParam('btnAwaitingInteractionText') || btnAwaitingText);
    btnReturnText = decodeURI(getQueryParam('btnReturnText') || btnReturnText);
  } else {
    try {
      const dataObj = JSON.parse(base64DecodeUtf8(rawData, true));
      callbackUri = resolveWebauthnCallbackUri(dataObj);
      mobileResponse = callbackUri != null;
      webauthnJson = dataObj.data;
      if (dataObj.btnText) btnText = decodeURI(dataObj.btnText);
      if (dataObj.btnAwaitingInteractionText) btnAwaitingText = decodeURI(dataObj.btnAwaitingInteractionText);
      if (dataObj.btnReturnText) btnReturnText = decodeURI(dataObj.btnReturnText);
    } catch {
      notifyError('Cannot parse data.');
      return;
    }
  }

  if (!parentUrl && !callbackUri) {
    notifyError('No return target provided.');
    return;
  }

  parsed = true;
}

async function executeWebAuthn() {
  if (returnUri.value) {
    document.location.replace(returnUri.value);
    return;
  }
  if (stopWebAuthn || !parsedObj) {
    buttonLabel.value = btnText;
    isAwaiting.value = false;
    return;
  }

  isAwaiting.value = true;
  buttonLabel.value = btnAwaitingText;
  try {
    const cred = (await navigator.credentials.get({ publicKey: parsedObj })) as PublicKeyCredential | null;
    if (!cred) {
      notifyError('Empty credential response.');
      return;
    }
    notifySuccess(cred);
  } catch (err: any) {
    notifyError(err?.message || String(err));
  }
}

function start() {
  sentSuccess = false;
  returnUri.value = null;

  if (!('credentials' in navigator)) {
    notifyError('WebAuthn is not supported in this browser.');
    return;
  }

  parseParameters();
  buttonLabel.value = btnText;

  if (!webauthnJson) {
    notifyError('No data.');
    return;
  }

  try {
    parsedObj = parseWebauthnRequestOptions(webauthnJson);
  } catch {
    notifyError('Cannot parse webauthn data.');
    return;
  }

  stopWebAuthn = false;
  const isSafari =
    navigator.userAgent.includes(' Safari/') && !navigator.userAgent.includes('Chrome');
  if (!mobileResponse && !isSafari) {
    void executeWebAuthn();
  }
}

function handleMessage(event: MessageEvent) {
  if (parentOrigin && (!event.origin || event.origin !== parentOrigin)) {
    return;
  }
  if (event.data === 'stop') {
    stopWebAuthn = true;
    isAwaiting.value = false;
    buttonLabel.value = btnText;
  } else if (event.data === 'start' && stopWebAuthn) {
    start();
  }
}

onMounted(() => {
  window.addEventListener('message', handleMessage, false);
  start();
  notifyInfo('ready');
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage, false);
});
</script>

<template>
  <div class="w-full h-full flex items-center justify-center p-1 bg-transparent">
    <button
      id="webauthn-button"
      type="button"
      class="iframe-btn"
      :disabled="isAwaiting"
      @click="executeWebAuthn"
    >
      <span v-if="isAwaiting" class="spinner"></span>
      <KeyRound v-else class="w-4 h-4 shrink-0" />
      <span>{{ buttonLabel }}</span>
    </button>
  </div>
</template>

<style scoped>
.iframe-btn {
  width: 100%;
  min-height: 38px;
  padding: 8px 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 10px;
  border: 1px solid rgba(56, 189, 248, 0.4);
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
  transition: all 0.2s ease;
}
.iframe-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}
.iframe-btn:disabled {
  opacity: 0.72;
  cursor: wait;
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
