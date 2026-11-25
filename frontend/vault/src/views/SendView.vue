<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useVaultStore } from '../stores/vault.ts';
import {
  Send,
  ArrowLeft,
  Plus,
  FileText,
  Trash2,
  ExternalLink,
  Upload,
  File as FileIcon,
  Copy,
  Check,
  Lock,
  PauseCircle,
  PlayCircle,
} from 'lucide-vue-next';

const router = useRouter();
const vaultStore = useVaultStore();

const showCreateModal = ref(false);
const sendMode = ref<'text' | 'file'>('text');
const sendName = ref('');
const sendText = ref('');
const sendNotes = ref('');
const sendPassword = ref('');
const sendHideEmail = ref(false);
const sendFile = ref<File | null>(null);
const maxAccessCount = ref<number | null>(null);
const expirationDays = ref(7);
const isSubmitting = ref(false);
const errorMsg = ref('');
const copiedId = ref<string | null>(null);

function openSend(item: any) {
  const target = item.shareUrl ? item.shareUrl.replace(window.location.origin, '') : `/#/send/${item.accessId || item.id}`;
  window.open(target, '_blank');
}

async function copyShareLink(item: any) {
  const link = item.shareUrl || `${window.location.origin}/#/send/${item.accessId || item.id}`;
  await navigator.clipboard.writeText(link);
  copiedId.value = item.id;
  setTimeout(() => { copiedId.value = null; }, 2000);
}

async function handleToggleDisable(item: any) {
  try {
    await vaultStore.toggleSendDisabled(item);
  } catch (err: any) {
    alert(err?.message || 'Ошибка обновления Send');
  }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const f = input.files?.[0] || null;
  sendFile.value = f;
  if (f && !sendName.value.trim()) {
    sendName.value = f.name;
  }
}

async function handleCreateSend() {
  if (!sendName.value.trim()) {
    errorMsg.value = 'Укажите название для передачи';
    return;
  }
  if (sendMode.value === 'text' && !sendText.value.trim()) {
    errorMsg.value = 'Введите текст для передачи';
    return;
  }
  if (sendMode.value === 'file') {
    if (!sendFile.value) {
      errorMsg.value = 'Выберите файл для отправки';
      return;
    }
    if (sendFile.value.size > 500 * 1024 * 1024) {
      errorMsg.value = 'Размер файла не должен превышать 500 МБ';
      return;
    }
  }

  errorMsg.value = '';
  isSubmitting.value = true;
  try {
    if (sendMode.value === 'file' && sendFile.value) {
      await vaultStore.createFileSend({
        name: sendName.value,
        file: sendFile.value,
        notes: sendNotes.value || undefined,
        password: sendPassword.value || undefined,
        hideEmail: sendHideEmail.value,
        deletionDays: expirationDays.value,
        maxAccessCount: maxAccessCount.value || null,
      });
    } else {
      await vaultStore.createTextSend({
        name: sendName.value,
        text: sendText.value,
        notes: sendNotes.value || undefined,
        password: sendPassword.value || undefined,
        hideEmail: sendHideEmail.value,
        deletionDays: expirationDays.value,
        maxAccessCount: maxAccessCount.value || null,
      });
    }
    showCreateModal.value = false;
    sendName.value = '';
    sendText.value = '';
    sendNotes.value = '';
    sendPassword.value = '';
    sendHideEmail.value = false;
    sendFile.value = null;
    maxAccessCount.value = null;
  } catch (err: any) {
    errorMsg.value = err?.message || 'Не удалось создать Send';
  } finally {
    isSubmitting.value = false;
  }
}

async function handleDeleteSend(id: string) {
  if (!confirm('Удалить это защищённое отправление?')) return;
  try {
    await vaultStore.deleteSend(id);
  } catch (err: any) {
    alert(err?.message || 'Ошибка удаления Send');
  }
}
</script>

<template>
  <div class="send-page">
    <div class="send-container">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
            @click="router.back()"
            title="Назад"
          >
            <ArrowLeft class="w-4 h-4" />
          </button>
          <div>
            <h1 class="text-xl font-bold flex items-center gap-2">
              <Send class="w-5 h-5 text-teal-400" />
              <span>Novus Send • Защищённая передача</span>
            </h1>
            <p class="text-xs text-slate-400">
              Сквозное шифрование текстов и файлов с самоуничтожением по времени или количеству просмотров
            </p>
          </div>
        </div>

        <button
          type="button"
          class="cyber-btn-primary"
          @click="showCreateModal = true"
        >
          <Plus class="w-4 h-4" />
          <span>Новый Send</span>
        </button>
      </div>

      <!-- Sends List -->
      <div v-if="vaultStore.sends.length === 0" class="empty-card">
        <div class="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center mb-3">
          <Send class="w-6 h-6 text-teal-400" />
        </div>
        <h3 class="text-sm font-bold mb-1">Нет активных отправлений</h3>
        <p class="text-xs text-slate-400 max-w-sm mb-4">
          Делитесь конфиденциальными текстами и файлами с клиентами и коллегами. Данные защищены сквозным шифрованием.
        </p>
        <button
          type="button"
          class="cyber-btn-subtle"
          @click="showCreateModal = true"
        >
          Создать Send
        </button>
      </div>

      <div v-else class="sends-list">
        <div
          v-for="item in vaultStore.sends"
          :key="item.id"
          class="send-item"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <FileIcon v-if="item.type === 1" class="w-4 h-4 text-sky-400" />
              <FileText v-else class="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <div class="text-xs font-semibold flex items-center gap-2">
                <span>{{ item.name }}</span>
                <span v-if="item.type === 1" class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">Файл</span>
                <span v-if="item.hasPassword || item.password" class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 flex items-center gap-0.5"><Lock class="w-2.5 h-2.5" /> Пароль</span>
                <span v-if="item.disabled" class="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400">Отключён</span>
              </div>
              <div class="text-[11px] text-slate-400">
                Просмотров: {{ item.accessCount || 0 }} / {{ item.maxAccessCount || '∞' }}
                <span v-if="item.file?.sizeName"> • {{ item.file.sizeName }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 px-2 py-1 rounded bg-teal-500/10"
              @click="copyShareLink(item)"
              title="Копировать ссылку с ключом расшифровки"
            >
              <component :is="copiedId === item.id ? Check : Copy" class="w-3.5 h-3.5" />
              <span>{{ copiedId === item.id ? 'Скопировано' : 'Ссылка' }}</span>
            </button>
            <button
              type="button"
              class="text-xs text-sky-400 hover:text-sky-300 p-1"
              @click="openSend(item)"
              title="Открыть Send"
            >
              <ExternalLink class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="text-xs text-amber-400 hover:text-amber-300 p-1"
              @click="handleToggleDisable(item)"
              :title="item.disabled ? 'Включить Send' : 'Приостановить Send'"
            >
              <component :is="item.disabled ? PlayCircle : PauseCircle" class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="text-xs text-rose-400 hover:text-rose-300 p-1"
              @click="handleDeleteSend(item.id)"
              title="Удалить Send"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Send Modal (Text / File) -->
    <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
      <div class="modal-card">
        <h3 class="text-base font-bold mb-1">Новый Novus Send</h3>
        <p class="text-xs text-slate-400 mb-3">
          Данные или файл шифруются в браузере уникальным ключом перед отправкой на сервер.
        </p>

        <div class="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            class="py-1.5 px-3 rounded-lg text-xs font-semibold border transition"
            :class="sendMode === 'text' ? 'bg-teal-600/20 border-teal-500 text-teal-300' : 'bg-slate-900/50 border-slate-700 text-slate-400'"
            @click="sendMode = 'text'"
          >
            Текст
          </button>
          <button
            type="button"
            class="py-1.5 px-3 rounded-lg text-xs font-semibold border transition"
            :class="sendMode === 'file' ? 'bg-sky-600/20 border-sky-500 text-sky-300' : 'bg-slate-900/50 border-slate-700 text-slate-400'"
            @click="sendMode = 'file'"
          >
            Файл
          </button>
        </div>

        <div v-if="errorMsg" class="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 mb-3">
          {{ errorMsg }}
        </div>

        <form @submit.prevent="handleCreateSend" class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Название *</label>
            <input
              v-model="sendName"
              type="text"
              placeholder="Например: Ключ API или архив конфига"
              required
              class="send-input"
            />
          </div>

          <div v-if="sendMode === 'text'">
            <label class="block text-xs font-semibold text-slate-300 mb-1">Конфиденциальный текст *</label>
            <textarea
              v-model="sendText"
              rows="4"
              placeholder="Введите секретный текст..."
              class="send-input"
            ></textarea>
          </div>

          <div v-else>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Файл (до 500 МБ) *</label>
            <label class="flex items-center justify-center gap-2 p-4 rounded-lg border border-dashed border-slate-600 hover:border-sky-400 cursor-pointer text-xs text-slate-300 bg-black/20">
              <Upload class="w-4 h-4 text-sky-400" />
              <span>{{ sendFile ? `${sendFile.name} (${Math.max(1, Math.round(sendFile.size / 1024))} КБ)` : 'Нажмите для выбора файла' }}</span>
              <input type="file" class="hidden" @change="handleFileSelect" />
            </label>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Удалить через</label>
              <select v-model.number="expirationDays" class="send-input">
                <option :value="1">1 день</option>
                <option :value="3">3 дня</option>
                <option :value="7">7 дней</option>
                <option :value="30">30 дней</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Макс. просмотров</label>
              <input
                v-model.number="maxAccessCount"
                type="number"
                min="1"
                placeholder="Без ограничений"
                class="send-input"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Пароль доступа (опционально)</label>
              <input
                v-model="sendPassword"
                type="password"
                placeholder="Без пароля"
                class="send-input"
              />
            </div>
            <div class="flex items-end pb-1.5">
              <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" v-model="sendHideEmail" />
                <span>Скрыть мой email</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Заметка (необязательно)</label>
            <input
              v-model="sendNotes"
              type="text"
              placeholder="Дополнительный комментарий для получателя..."
              class="send-input"
            />
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="cyber-btn-subtle" @click="showCreateModal = false">
              Отмена
            </button>
            <button type="submit" class="cyber-btn-primary" :disabled="isSubmitting">
              {{ isSubmitting ? 'Шифрование...' : 'Создать Send' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.send-page {
  min-height: 100vh;
  background-color: var(--page-bg, #010811);
  color: var(--text-primary, #f8fafc);
  display: flex;
  justify-content: center;
  padding: 30px 20px;
}

.send-container {
  width: 100%;
  max-width: 680px;
}

.cyber-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 36px;
  background: #0d9488;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.cyber-btn-primary:hover {
  background: #0f766e;
}

.empty-card {
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.2));
  border-radius: 14px;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.cyber-btn-subtle {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #f8fafc;
  font-size: 12px;
  cursor: pointer;
}

.sends-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.send-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.2));
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 460px;
  background: var(--card-bg, #0b1329);
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.3));
  border-radius: 14px;
  padding: 22px;
}

.send-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--input-bg, rgba(3, 7, 18, 0.85));
  border: 1px solid var(--input-border, #334155);
  border-radius: 8px;
  color: var(--text-primary, #f8fafc);
  padding: 8px 10px;
  font-size: 12.5px;
  outline: none;
}
</style>

