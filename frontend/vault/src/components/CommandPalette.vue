<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { DecryptedCipher } from '../stores/vault.ts';
import { copyTextToClipboard, copySecretToClipboard } from '@shared/clipboard.ts';
import { notifyToast } from '@shared/dialogs.ts';
import {
  Search,
  Key,
  CreditCard,
  FileText,
  User,
  Terminal,
  Plus,
  Wand2,
  ShieldAlert,
  Send,
  Settings,
  Building2,
  Lock,
  Copy,
  X,
  CornerDownLeft,
} from 'lucide-vue-next';

const props = defineProps<{
  open: boolean;
  ciphers: DecryptedCipher[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select-cipher', id: string): void;
  (e: 'action', name: string): void;
}>();

const query = ref('');
const selectedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

interface QuickAction {
  id: string;
  label: string;
  hint: string;
  icon: any;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'new-login', label: 'Создать новый логин', hint: 'Быстрое добавление записи', icon: Plus },
  { id: 'generator', label: 'Открыть генератор паролей', hint: 'CSPRNG · пароли и парольные фразы', icon: Wand2 },
  { id: 'sentinel', label: 'Открыть Novus Sentinel Аудит', hint: 'Проверка слабых и повторяющихся паролей', icon: ShieldAlert },
  { id: 'send', label: 'Открыть Novus Send', hint: 'Защищённая одноразовая передача', icon: Send },
  { id: 'settings', label: 'Открыть настройки и 2FA', hint: 'Argon2id, TOTP, FIDO2, устройства', icon: Settings },
  { id: 'organizations', label: 'Консоль организаций', hint: 'Коллекции, участники, политики', icon: Building2 },
  { id: 'lock', label: 'Заблокировать хранилище', hint: 'Очистить ключи шифрования из памяти', icon: Lock },
];

const matchedCiphers = computed(() => {
  const q = query.value.trim().toLowerCase();
  const active = props.ciphers.filter((c) => !c.deletedDate);
  if (!q) return active.slice(0, 8);
  return active
    .filter((c) => {
      const hay = [
        c.name,
        c.login?.username,
        c.card?.brand,
        c.notes,
        ...(c.login?.uris?.map((u) => u.uri) || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 10);
});

const matchedActions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return QUICK_ACTIONS;
  return QUICK_ACTIONS.filter(
    (a) => a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q)
  );
});

const flatItems = computed(() => [
  ...matchedCiphers.value.map((c) => ({ kind: 'cipher' as const, cipher: c })),
  ...matchedActions.value.map((a) => ({ kind: 'action' as const, action: a })),
]);

watch(
  () => props.open,
  async (val) => {
    if (val) {
      query.value = '';
      selectedIndex.value = 0;
      await nextTick();
      inputRef.value?.focus();
    }
  }
);

watch(flatItems, () => {
  selectedIndex.value = 0;
});

function cipherIcon(type: number) {
  if (type === 2) return FileText;
  if (type === 3) return CreditCard;
  if (type === 4) return User;
  if (type === 5) return Terminal;
  return Key;
}

function triggerCurrent() {
  const item = flatItems.value[selectedIndex.value];
  if (!item) return;
  if (item.kind === 'cipher') {
    emit('select-cipher', item.cipher.id);
    emit('close');
  } else {
    emit('action', item.action.id);
    emit('close');
  }
}

async function quickCopyUser(cipher: DecryptedCipher) {
  if (!cipher.login?.username) return;
  const ok = await copyTextToClipboard(cipher.login.username);
  notifyToast(ok ? `Логин «${cipher.name}» скопирован` : 'Не удалось скопировать логин', ok ? 'success' : 'warning');
  emit('close');
}

async function quickCopyPass(cipher: DecryptedCipher) {
  if (!cipher.login?.password) return;
  const { ok, clearAfterSec } = await copySecretToClipboard(cipher.login.password);
  notifyToast(
    ok
      ? clearAfterSec > 0
        ? `Пароль «${cipher.name}» скопирован (очистка через ${clearAfterSec} с)`
        : `Пароль «${cipher.name}» скопирован`
      : 'Не удалось скопировать пароль',
    ok ? 'success' : 'warning'
  );
  emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (flatItems.value.length > 0) {
      selectedIndex.value = (selectedIndex.value + 1) % flatItems.value.length;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (flatItems.value.length > 0) {
      selectedIndex.value = (selectedIndex.value - 1 + flatItems.value.length) % flatItems.value.length;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    triggerCurrent();
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="cmd-fade">
      <div v-if="open" class="cmd-backdrop" @click.self="emit('close')">
        <div class="cmd-shell" role="dialog" aria-modal="true" aria-label="Палитра команд NovusWarden">
          <!-- Search Bar -->
          <div class="cmd-search-row">
            <Search class="w-4 h-4 text-sky-400 shrink-0" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              placeholder="Поиск записей, логинов, доменов или команд..."
              class="cmd-input"
            />
            <kbd class="cmd-kbd">ESC</kbd>
            <button type="button" class="cmd-close" @click="emit('close')">
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Results List -->
          <div class="cmd-list">
            <div v-if="flatItems.length === 0" class="cmd-empty">
              Ничего не найдено по запросу «{{ query }}»
            </div>

            <template v-else>
              <div v-if="matchedCiphers.length > 0" class="cmd-section-title">
                Записи хранилища ({{ matchedCiphers.length }})
              </div>
              <div
                v-for="(c, idx) in matchedCiphers"
                :key="c.id"
                class="cmd-row"
                :class="{ active: selectedIndex === idx }"
                @mouseenter="selectedIndex = idx"
                @click="emit('select-cipher', c.id); emit('close')"
              >
                <div class="cmd-row-icon">
                  <component :is="cipherIcon(c.type)" class="w-4 h-4 text-sky-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="cmd-row-title truncate">{{ c.name }}</div>
                  <div class="cmd-row-sub truncate">
                    {{ c.login?.username || c.card?.brand || 'Запись хранилища' }}
                  </div>
                </div>
                <div v-if="c.type === 1 && c.reprompt !== 1" class="flex items-center gap-1 shrink-0" @click.stop>
                  <button
                    v-if="c.login?.username"
                    type="button"
                    class="cmd-quick-btn"
                    title="Копировать логин"
                    @click="quickCopyUser(c)"
                  >
                    <User class="w-3 h-3" />
                  </button>
                  <button
                    v-if="c.login?.password"
                    type="button"
                    class="cmd-quick-btn"
                    title="Копировать пароль"
                    @click="quickCopyPass(c)"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div v-if="matchedActions.length > 0" class="cmd-section-title mt-2">
                Быстрые команды
              </div>
              <div
                v-for="(act, aIdx) in matchedActions"
                :key="act.id"
                class="cmd-row"
                :class="{ active: selectedIndex === matchedCiphers.length + aIdx }"
                @mouseenter="selectedIndex = matchedCiphers.length + aIdx"
                @click="emit('action', act.id); emit('close')"
              >
                <div class="cmd-row-icon is-action">
                  <component :is="act.icon" class="w-4 h-4 text-indigo-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="cmd-row-title truncate">{{ act.label }}</div>
                  <div class="cmd-row-sub truncate">{{ act.hint }}</div>
                </div>
                <CornerDownLeft class="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </div>
            </template>
          </div>

          <!-- Footer hints -->
          <div class="cmd-footer">
            <span><kbd>↑↓</kbd> навигация</span>
            <span><kbd>Enter</kbd> открыть</span>
            <span><kbd>Ctrl+K</kbd> палитра команд</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cmd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9980;
  background: rgba(2, 6, 23, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 10vh 16px 24px;
}

.cmd-shell {
  width: 100%;
  max-width: 600px;
  border-radius: 16px;
  background: var(--card-elevated, rgba(13, 22, 41, 0.98));
  border: 1px solid var(--card-border-strong, rgba(56, 189, 248, 0.38));
  box-shadow: 0 28px 64px -12px rgba(0, 0, 0, 0.8);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cmd-search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--card-border, rgba(56, 189, 248, 0.16));
}

.cmd-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary, #f8fafc);
  font-size: 14px;
}

.cmd-kbd {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 5px;
  background: rgba(148, 163, 184, 0.14);
  color: var(--text-secondary, #94a3b8);
  font-family: ui-monospace, monospace;
}

.cmd-close {
  background: transparent;
  border: none;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  padding: 2px;
}

.cmd-list {
  max-height: 410px;
  overflow-y: auto;
  padding: 8px;
}

.cmd-empty {
  padding: 28px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted, #64748b);
}

.cmd-section-title {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted, #64748b);
  padding: 6px 10px 4px;
}

.cmd-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.cmd-row.active {
  background: var(--active-bg, rgba(14, 165, 233, 0.16));
}

.cmd-row-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cmd-row-icon.is-action {
  background: rgba(99, 102, 241, 0.12);
  border-color: rgba(129, 140, 248, 0.25);
}

.cmd-row-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.cmd-row-sub {
  font-size: 11px;
  color: var(--text-secondary);
}

.cmd-quick-btn {
  height: 26px;
  width: 26px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.22);
  color: var(--text-secondary);
  cursor: pointer;
}

.cmd-quick-btn:hover {
  border-color: #38bdf8;
  color: #38bdf8;
}

.cmd-footer {
  display: flex;
  gap: 16px;
  padding: 8px 14px;
  border-top: 1px solid var(--card-border, rgba(56, 189, 248, 0.14));
  font-size: 11px;
  color: var(--text-muted);
}

.cmd-footer kbd {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.14);
  font-family: ui-monospace, monospace;
  font-size: 10px;
}

.cmd-fade-enter-active,
.cmd-fade-leave-active {
  transition: opacity 0.15s ease;
}

.cmd-fade-enter-from,
.cmd-fade-leave-to {
  opacity: 0;
}
</style>
