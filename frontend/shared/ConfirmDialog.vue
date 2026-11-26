<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { activeDialog, resolveActiveDialog } from './dialogs.ts';
import { AlertTriangle, ShieldQuestion, X } from 'lucide-vue-next';

const canConfirm = computed(() => {
  const dlg = activeDialog.value;
  if (!dlg) return false;
  if (dlg.requireText) {
    return dlg.inputValue.trim() === dlg.requireText;
  }
  return true;
});

function handleKeydown(e: KeyboardEvent) {
  if (!activeDialog.value) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    resolveActiveDialog(false);
  } else if (e.key === 'Enter' && canConfirm.value) {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag !== 'textarea') {
      e.preventDefault();
      resolveActiveDialog(true);
    }
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="nw-dialog-fade">
      <div
        v-if="activeDialog"
        class="nw-dialog-backdrop"
        role="dialog"
        aria-modal="true"
        @click.self="resolveActiveDialog(false)"
      >
        <div class="nw-dialog-card" :class="{ 'nw-dialog-danger': activeDialog.danger }">
          <div class="nw-dialog-header">
            <div class="nw-dialog-icon" :class="{ 'is-danger': activeDialog.danger }">
              <AlertTriangle v-if="activeDialog.danger" class="w-5 h-5" />
              <ShieldQuestion v-else class="w-5 h-5" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="nw-dialog-title">{{ activeDialog.title }}</h3>
              <p class="nw-dialog-message">{{ activeDialog.message }}</p>
            </div>
            <button
              type="button"
              class="nw-dialog-close"
              aria-label="Закрыть"
              @click="resolveActiveDialog(false)"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div v-if="activeDialog.mode === 'prompt' || activeDialog.requireText" class="nw-dialog-input-wrap">
            <label v-if="activeDialog.requireText" class="nw-dialog-require-hint">
              Для подтверждения введите:
              <code>{{ activeDialog.requireText }}</code>
            </label>
            <input
              v-model="activeDialog.inputValue"
              type="text"
              class="nw-dialog-input"
              :placeholder="activeDialog.placeholder"
              autofocus
            />
          </div>

          <div class="nw-dialog-actions">
            <button type="button" class="nw-btn-cancel" @click="resolveActiveDialog(false)">
              {{ activeDialog.cancelLabel }}
            </button>
            <button
              type="button"
              :class="activeDialog.danger ? 'nw-btn-danger' : 'nw-btn-primary'"
              :disabled="!canConfirm"
              @click="resolveActiveDialog(true)"
            >
              {{ activeDialog.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nw-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9990;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.nw-dialog-card {
  width: 100%;
  max-width: 440px;
  background: var(--card-elevated, rgba(15, 23, 42, 0.98));
  border: 1px solid var(--card-border-strong, rgba(56, 189, 248, 0.35));
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.75);
  color: var(--text-primary, #f8fafc);
}

.nw-dialog-danger {
  border-color: rgba(244, 63, 94, 0.45);
}

.nw-dialog-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.nw-dialog-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(14, 165, 233, 0.14);
  border: 1px solid rgba(56, 189, 248, 0.32);
  color: #38bdf8;
}

.nw-dialog-icon.is-danger {
  background: rgba(244, 63, 94, 0.14);
  border-color: rgba(244, 63, 94, 0.38);
  color: #fb7185;
}

.nw-dialog-title {
  margin: 0 0 6px 0;
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.3;
}

.nw-dialog-message {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-secondary, #94a3b8);
  white-space: pre-line;
}

.nw-dialog-close {
  background: transparent;
  border: none;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.nw-dialog-close:hover {
  color: var(--text-primary, #f8fafc);
  background: rgba(148, 163, 184, 0.12);
}

.nw-dialog-input-wrap {
  margin-top: 16px;
}

.nw-dialog-require-hint {
  display: block;
  font-size: 11.5px;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 6px;
}

.nw-dialog-require-hint code {
  color: #fb7185;
  background: rgba(244, 63, 94, 0.12);
  padding: 2px 6px;
  border-radius: 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.nw-dialog-input {
  width: 100%;
  box-sizing: border-box;
  height: 38px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--input-bg, rgba(3, 7, 18, 0.9));
  border: 1px solid var(--input-border, #334155);
  color: var(--text-primary, #f8fafc);
  font-size: 13px;
  outline: none;
}

.nw-dialog-input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.22);
}

.nw-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.nw-btn-cancel,
.nw-btn-primary,
.nw-btn-danger {
  height: 36px;
  padding: 0 16px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.16s ease;
}

.nw-btn-cancel {
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: var(--text-primary, #e2e8f0);
}

.nw-btn-cancel:hover {
  background: rgba(148, 163, 184, 0.2);
}

.nw-btn-primary {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  border: none;
  color: #ffffff;
}

.nw-btn-danger {
  background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
  border: none;
  color: #ffffff;
}

.nw-btn-primary:disabled,
.nw-btn-danger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.nw-dialog-fade-enter-active,
.nw-dialog-fade-leave-active {
  transition: opacity 0.16s ease;
}

.nw-dialog-fade-enter-from,
.nw-dialog-fade-leave-to {
  opacity: 0;
}

:global(html.light) .nw-dialog-card {
  background: #ffffff;
  color: #0f172a;
  border-color: #cbd5e1;
}
:global(html.light) .nw-dialog-input {
  background: #f8fafc;
  color: #0f172a;
  border-color: #cbd5e1;
}
:global(html.light) .nw-btn-cancel {
  color: #0f172a;
}
</style>
