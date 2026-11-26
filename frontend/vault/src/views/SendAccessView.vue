<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, RawSend } from '../api/client.ts';
import { base64ToBytes } from '../crypto/utils.ts';
import { deriveSendKey, decrypt, decryptBytes, hashSendPassword } from '../crypto/symmetric.ts';
import { copyTextToClipboard } from '@shared/clipboard.ts';
import { ShieldCheck, FileText, Download, Lock, AlertTriangle, Copy, Check } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const sendId = String(route.params.sendId || '');
const rawKeyParam = String(route.params.key || '');

const loading = ref(true);
const needsPassword = ref(false);
const passwordInput = ref('');
const errorMsg = ref('');
const sendData = ref<RawSend | null>(null);
const decryptedName = ref('');
const decryptedNotes = ref('');
const decryptedText = ref('');
const decryptedFileName = ref('');
const sendSymKeyRef = ref<Uint8Array | null>(null);
const accessTokenRef = ref('');
const copied = ref(false);
const downloading = ref(false);

async function loadSend(password?: string) {
  loading.value = true;
  errorMsg.value = '';
  try {
    if (!sendId || !rawKeyParam) {
      throw new Error('Неполная ссылка на защищённую передачу (отсутствует ID или ключ расшифровки)');
    }
    const rawSendKey = base64ToBytes(rawKeyParam);
    const symKey = await deriveSendKey(rawSendKey);
    sendSymKeyRef.value = symKey;

    const pwHash = password ? await hashSendPassword(password) : undefined;
    const token = await api.getSendAccessToken(sendId, pwHash);
    accessTokenRef.value = token;

    const raw = await api.accessSend(token);
    sendData.value = raw;
    needsPassword.value = false;

    decryptedName.value = await decrypt(raw.name, symKey).catch(() => raw.name);
    if (raw.notes) {
      decryptedNotes.value = await decrypt(raw.notes, symKey).catch(() => raw.notes || '');
    }
    if (raw.type === 0 && raw.text?.text) {
      decryptedText.value = await decrypt(raw.text.text, symKey);
    } else if (raw.type === 1 && raw.file?.fileName) {
      decryptedFileName.value = await decrypt(raw.file.fileName, symKey).catch(() => raw.file?.fileName || 'file');
    }
  } catch (err: any) {
    if (err?.requiresPassword) {
      needsPassword.value = true;
      if (password) {
        errorMsg.value = 'Неверный пароль доступа';
      }
    } else {
      errorMsg.value = err?.message || 'Отправление не найдено или срок его действия истёк';
    }
  } finally {
    loading.value = false;
  }
}

async function copyText() {
  if (!decryptedText.value) return;
  const ok = await copyTextToClipboard(decryptedText.value);
  if (!ok) {
    errorMsg.value = 'Не удалось скопировать текст автоматически — выделите его вручную (Ctrl+C)';
    return;
  }
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

async function downloadFile() {
  if (!sendData.value?.file?.id || !sendSymKeyRef.value || !accessTokenRef.value) return;
  downloading.value = true;
  try {
    const dl = await api.accessSendFileUrl(accessTokenRef.value, sendData.value.file.id);
    const resp = await fetch(dl.url);
    if (!resp.ok) throw new Error('Ошибка скачивания зашифрованного файла');
    const encBuf = new Uint8Array(await resp.arrayBuffer());
    const plain = await decryptBytes(encBuf, sendSymKeyRef.value);
    const blob = new Blob([plain as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = decryptedFileName.value || 'download.bin';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    errorMsg.value = err?.message || 'Ошибка расшифровки файла';
  } finally {
    downloading.value = false;
  }
}

onMounted(() => loadSend());
</script>

<template>
  <div class="min-h-screen bg-[#010811] text-slate-100 flex items-center justify-center p-4">
    <div class="w-full max-w-lg rounded-2xl bg-[#0b1329] border border-sky-500/25 p-6 shadow-2xl">
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div class="flex items-center gap-2.5">
          <ShieldCheck class="w-6 h-6 text-teal-400" />
          <div>
            <h1 class="text-base font-bold">Novus Send</h1>
            <p class="text-[11px] text-slate-400">End-to-End защищённая передача данных</p>
          </div>
        </div>
        <button
          type="button"
          class="text-xs text-sky-400 hover:text-sky-300"
          @click="router.push('/login')"
        >
          Вход в Vault
        </button>
      </div>

      <div v-if="loading" class="py-12 text-center text-sm text-slate-400">
        Загрузка и проверка ключей...
      </div>

      <form v-else-if="needsPassword" @submit.prevent="loadSend(passwordInput)" class="space-y-4">
        <div class="flex items-center gap-2 text-amber-400 text-sm font-semibold">
          <Lock class="w-4 h-4" />
          <span>Эта передача защищена паролем</span>
        </div>
        <div v-if="errorMsg" class="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5">
          {{ errorMsg }}
        </div>
        <input
          v-model="passwordInput"
          type="password"
          required
          placeholder="Введите пароль доступа..."
          class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none"
        />
        <button
          type="submit"
          class="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold"
        >
          Разблокировать
        </button>
      </form>

      <div v-else-if="errorMsg" class="text-center py-8 space-y-3">
        <AlertTriangle class="w-10 h-10 text-rose-400 mx-auto" />
        <p class="text-sm text-rose-300">{{ errorMsg }}</p>
      </div>

      <div v-else-if="sendData" class="space-y-4">
        <div>
          <div class="text-xs text-slate-400">Название</div>
          <div class="text-lg font-bold">{{ decryptedName }}</div>
        </div>

        <div v-if="decryptedNotes" class="p-3 rounded-lg bg-slate-900/70 border border-slate-800 text-xs text-slate-300">
          {{ decryptedNotes }}
        </div>

        <div v-if="sendData.type === 0" class="space-y-2">
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span class="flex items-center gap-1"><FileText class="w-3.5 h-3.5" /> Конфиденциальный текст</span>
            <button type="button" class="text-sky-400 hover:text-sky-300 flex items-center gap-1" @click="copyText">
              <component :is="copied ? Check : Copy" class="w-3.5 h-3.5" />
              <span>{{ copied ? 'Скопировано' : 'Копировать' }}</span>
            </button>
          </div>
          <pre class="p-3.5 rounded-xl bg-black/50 border border-slate-800 font-mono text-xs whitespace-pre-wrap break-all select-all">{{ decryptedText }}</pre>
        </div>

        <div v-else-if="sendData.type === 1 && sendData.file" class="p-4 rounded-xl bg-black/30 border border-slate-800 flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold">{{ decryptedFileName }}</div>
            <div class="text-xs text-slate-400">{{ sendData.file.sizeName || `${sendData.file.size} B` }}</div>
          </div>
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5"
            :disabled="downloading"
            @click="downloadFile"
          >
            <Download class="w-4 h-4" />
            <span>{{ downloading ? 'Расшифровка...' : 'Скачать' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
