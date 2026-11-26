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
  List,
} from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    modal?: boolean;
  }>(),
  { modal: false }
);

const router = useRouter();
const vaultStore = useVaultStore();

const activePanel = ref<'list' | 'create'>('list');
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
    errorMsg.value = err?.message || 'Ошибка обновления Send';
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
    activePanel.value = 'list';
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
    errorMsg.value = err?.message || 'Ошибка удаления Send';
  }
}
</script>

<template>
  <div :class="props.modal ? 'send-modal-root' : 'send-page'">
    <div :class="props.modal ? 'send-modal-inner' : 'send-container'">
      <!-- Standalone Header -->
      <div v-if="!props.modal" class="flex items-center justify-between gap-3 mb-5">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="cyber-btn-secondary !p-2 !h-9 !w-9"
            @click="router.push('/vault')"
            title="Назад"
          >
            <ArrowLeft class="w-4 h-4" />
          </button>
          <div>
            <h1 class="text-lg font-bold flex items-center gap-2 m-0">
              <Send class="w-5 h-5 text-teal-400" />
              <span>Novus Send • Защищённая передача</span>
            </h1>
            <p class="text-xs text-slate-400 m-0 mt-0.5">
              Сквозное шифрование текстов и файлов с автоудалением
            </p>
          </div>
        </div>
      </div>

      <!-- Segmented Switcher: Active Sends vs Create Send (no nested modal!) -->
      <div class="mode-tabs mb-4">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activePanel === 'list' }"
          @click="activePanel = 'list'; errorMsg = ''"
        >
          <List class="w-3.5 h-3.5" />
          <span>Мои отправления ({{ vaultStore.sends.length }})</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activePanel === 'create' }"
          @click="activePanel = 'create'; errorMsg = ''"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Создать новый Send</span>
        </button>
      </div>

      <div v-if="errorMsg" class="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 mb-4">
        {{ errorMsg }}
      </div>

      <!-- PANEL 1: SENDS LIST -->
      <template v-if="activePanel === 'list'">
        <div v-if="vaultStore.sends.length === 0" class="empty-card">
          <div class="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center mb-3">
            <Send class="w-5 h-5 text-teal-400" />
          </div>
          <h3 class="text-sm font-bold mb-1">Нет активных отправлений</h3>
          <p class="text-xs text-slate-400 max-w-sm mb-4">
            Делитесь конфиденциальными текстами и файлами с коллегами и клиентами. Ключ шифрования передаётся только во фрагменте ссылки.
          </p>
          <button
            type="button"
            class="cyber-btn-primary"
            @click="activePanel = 'create'"
          >
            <Plus class="w-4 h-4" />
            <span>Создать первый Send</span>
          </button>
        </div>

        <div v-else class="sends-list">
          <div
            v-for="item in vaultStore.sends"
            :key="item.id"
            class="send-item"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-xl bg-teal-500/12 border border-teal-500/25 flex items-center justify-center shrink-0">
                <FileIcon v-if="item.type === 1" class="w-4 h-4 text-sky-400" />
                <FileText v-else class="w-4 h-4 text-teal-400" />
              </div>
              <div class="min-w-0">
                <div class="text-xs font-semibold flex flex-wrap items-center gap-1.5">
                  <span class="truncate">{{ item.name }}</span>
                  <span v-if="item.type === 1" class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">Файл</span>
                  <span v-if="item.hasPassword || item.password" class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 inline-flex items-center gap-0.5">
                    <Lock class="w-2.5 h-2.5" /> Пароль
                  </span>
                  <span v-if="item.disabled" class="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400">Отключён</span>
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5">
                  Просмотров: {{ item.accessCount || 0 }} / {{ item.maxAccessCount || '∞' }}
                  <span v-if="item.file?.sizeName"> • {{ item.file.sizeName }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                class="text-xs text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-500/12 border border-teal-500/25 font-semibold"
                @click="copyShareLink(item)"
                title="Копировать ссылку с ключом расшифровки"
              >
                <component :is="copiedId === item.id ? Check : Copy" class="w-3.5 h-3.5" />
                <span>{{ copiedId === item.id ? 'Скопировано' : 'Ссылка' }}</span>
              </button>
              <button
                type="button"
                class="icon-action text-sky-400"
                @click="openSend(item)"
                title="Открыть Send"
              >
                <ExternalLink class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                class="icon-action text-amber-400"
                @click="handleToggleDisable(item)"
                :title="item.disabled ? 'Включить Send' : 'Приостановить Send'"
              >
                <component :is="item.disabled ? PlayCircle : PauseCircle" class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                class="icon-action text-rose-400"
                @click="handleDeleteSend(item.id)"
                title="Удалить Send"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- PANEL 2: CREATE SEND FORM -->
      <div v-else class="create-card">
        <div class="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            class="type-btn"
            :class="{ active: sendMode === 'text' }"
            @click="sendMode = 'text'"
          >
            <FileText class="w-4 h-4 text-teal-400" />
            <span>Текстовый секрет</span>
          </button>
          <button
            type="button"
            class="type-btn"
            :class="{ active: sendMode === 'file' }"
            @click="sendMode = 'file'"
          >
            <Upload class="w-4 h-4 text-sky-400" />
            <span>Зашифрованный файл</span>
          </button>
        </div>

        <form @submit.prevent="handleCreateSend" class="space-y-3.5">
          <div>
            <label class="field-lbl">Название *</label>
            <input
              v-model="sendName"
              type="text"
              placeholder="Например: Ключ API или архив конфига"
              required
              class="cyber-input"
            />
          </div>

          <div v-if="sendMode === 'text'">
            <label class="field-lbl">Конфиденциальный текст *</label>
            <textarea
              v-model="sendText"
              rows="4"
              placeholder="Введите секретный текст..."
              class="cyber-textarea"
            ></textarea>
          </div>

          <div v-else>
            <label class="field-lbl">Файл (до 500 МБ) *</label>
            <label class="flex items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-slate-600 hover:border-sky-400 cursor-pointer text-xs text-slate-300 bg-black/20 transition">
              <Upload class="w-4 h-4 text-sky-400" />
              <span>{{ sendFile ? `${sendFile.name} (${Math.max(1, Math.round(sendFile.size / 1024))} КБ)` : 'Нажмите для выбора файла' }}</span>
              <input type="file" class="hidden" @change="handleFileSelect" />
            </label>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="field-lbl">Удалить через</label>
              <select v-model.number="expirationDays" class="cyber-input">
                <option :value="1">1 день</option>
                <option :value="3">3 дня</option>
                <option :value="7">7 дней</option>
                <option :value="30">30 дней</option>
              </select>
            </div>
            <div>
              <label class="field-lbl">Макс. просмотров</label>
              <input
                v-model.number="maxAccessCount"
                type="number"
                min="1"
                placeholder="Без ограничений"
                class="cyber-input"
              />
            </div>
            <div>
              <label class="field-lbl">Пароль доступа</label>
              <input
                v-model="sendPassword"
                type="password"
                placeholder="Необязательно"
                class="cyber-input"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label class="field-lbl">Заметка для получателя</label>
              <input
                v-model="sendNotes"
                type="text"
                placeholder="Дополнительный комментарий..."
                class="cyber-input"
              />
            </div>
            <label class="flex items-center gap-2 h-9 px-3 rounded-lg bg-black/20 border border-slate-800 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" v-model="sendHideEmail" class="accent-sky-500" />
              <span>Скрыть мой email от получателя</span>
            </label>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-slate-800/70">
            <button type="button" class="cyber-btn-secondary" @click="activePanel = 'list'">
              Отмена
            </button>
            <button type="submit" class="cyber-btn-primary" :disabled="isSubmitting">
              <Send class="w-3.5 h-3.5" />
              <span>{{ isSubmitting ? 'Шифрование...' : 'Создать защищённый Send' }}</span>
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
  background-color: var(--page-bg, #030712);
  background-image: var(--page-gradient);
  color: var(--text-primary, #f8fafc);
  display: flex;
  justify-content: center;
  padding: 28px 20px 60px 20px;
}

.send-container {
  width: 100%;
  max-width: 720px;
}

.send-modal-root {
  color: var(--text-primary, #f8fafc);
}

.send-modal-inner {
  width: 100%;
}

.mode-tabs {
  display: flex;
  background: var(--input-bg, rgba(4, 9, 21, 0.8));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.2));
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary, #94a3b8);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.tab-btn.active {
  background: var(--active-bg, rgba(20, 184, 166, 0.16));
  border-color: var(--active-border, rgba(45, 212, 191, 0.35));
  color: #2dd4bf;
}

:global(html.light) .tab-btn.active {
  color: #0d9488;
}

.empty-card,
.create-card {
  background: var(--card-bg, rgba(13, 22, 41, 0.85));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.2));
  border-radius: 14px;
  padding: 20px;
}

.empty-card {
  padding: 36px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.sends-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.send-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--card-bg, rgba(13, 22, 41, 0.85));
  border: 1px solid var(--card-border, rgba(56, 189, 248, 0.2));
}

.icon-action {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--hover-bg, rgba(255, 255, 255, 0.06));
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-action:hover {
  border-color: var(--card-border-strong, rgba(56, 189, 248, 0.35));
}

.type-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 600;
  background: var(--input-bg, rgba(4, 9, 21, 0.65));
  border: 1px solid var(--input-border, #334155);
  color: var(--text-secondary, #94a3b8);
  cursor: pointer;
  transition: all 0.15s ease;
}

.type-btn.active {
  background: var(--active-bg, rgba(14, 165, 233, 0.14));
  border-color: #38bdf8;
  color: var(--text-primary, #f8fafc);
}

.field-lbl {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 5px;
}

.cyber-textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--input-bg, rgba(4, 9, 21, 0.88));
  border: 1px solid var(--input-border, #334155);
  border-radius: 8px;
  color: var(--text-primary, #f8fafc);
  padding: 10px 12px;
  font-size: 13px;
  outline: none;
  resize: vertical;
}

.cyber-textarea:focus {
  border-color: var(--input-focus, #38bdf8);
}
</style>
