<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { X } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    subtitle?: string;
    maxWidth?: string;
    accent?: 'sky' | 'indigo' | 'amber' | 'teal';
  }>(),
  {
    subtitle: '',
    maxWidth: '880px',
    accent: 'sky',
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    emit('close');
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <teleport to="body">
    <transition name="nw-modal">
      <div
        v-if="open"
        class="nw-modal-backdrop"
        role="dialog"
        aria-modal="true"
        @click.self="emit('close')"
      >
        <div class="nw-modal-shell" :class="`accent-${accent}`" :style="{ maxWidth }">
          <!-- Sticky Header -->
          <div class="nw-modal-header">
            <div class="nw-modal-heading">
              <div class="nw-modal-icon" :class="`icon-${accent}`">
                <slot name="icon" />
              </div>
              <div class="min-w-0">
                <h2 class="nw-modal-title truncate">{{ title }}</h2>
                <p v-if="subtitle" class="nw-modal-subtitle truncate">{{ subtitle }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <slot name="header-actions" />
              <button
                type="button"
                class="nw-modal-close"
                aria-label="Закрыть"
                title="Закрыть (Esc)"
                @click="emit('close')"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Independently Scrollable Body -->
          <div class="nw-modal-body">
            <slot />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.nw-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(2, 6, 18, 0.76);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

html.light .nw-modal-backdrop {
  background: rgba(15, 23, 42, 0.45);
}

.nw-modal-shell {
  width: 100%;
  max-height: min(90vh, 880px);
  display: flex;
  flex-direction: column;
  background: var(--card-elevated, rgba(13, 22, 41, 0.97));
  border: 1px solid var(--card-border-strong, rgba(56, 189, 248, 0.3));
  border-radius: 18px;
  box-shadow:
    0 28px 70px -16px rgba(0, 0, 0, 0.78),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  overflow: hidden;
  color: var(--text-primary, #f8fafc);
}

html.light .nw-modal-shell {
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.14);
  box-shadow: 0 28px 64px -14px rgba(15, 23, 42, 0.22);
}

.nw-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--card-border, rgba(56, 189, 248, 0.18));
  background: var(--header-bg, rgba(8, 15, 30, 0.9));
  flex-shrink: 0;
}

html.light .nw-modal-header {
  background: #f8fafc;
  border-bottom-color: #e2e8f0;
}

.nw-modal-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.nw-modal-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nw-modal-icon.icon-sky {
  background: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.32);
  color: #38bdf8;
}

.nw-modal-icon.icon-indigo {
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(129, 140, 248, 0.32);
  color: #818cf8;
}

.nw-modal-icon.icon-amber {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.32);
  color: #fbbf24;
}

.nw-modal-icon.icon-teal {
  background: rgba(20, 184, 166, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.32);
  color: #2dd4bf;
}

html.light .nw-modal-icon.icon-sky {
  color: #0284c7;
  background: rgba(2, 132, 199, 0.1);
}

html.light .nw-modal-icon.icon-indigo {
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.1);
}

html.light .nw-modal-icon.icon-amber {
  color: #d97706;
  background: rgba(217, 119, 6, 0.1);
}

html.light .nw-modal-icon.icon-teal {
  color: #0d9488;
  background: rgba(13, 148, 136, 0.1);
}

.nw-modal-title {
  font-size: 15.5px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.015em;
  color: var(--text-primary, #f8fafc);
}

.nw-modal-subtitle {
  font-size: 11.5px;
  color: var(--text-secondary, #94a3b8);
  margin: 2px 0 0 0;
}

.nw-modal-close {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  border: 1px solid var(--card-border, rgba(148, 163, 184, 0.22));
  background: rgba(148, 163, 184, 0.08);
  color: var(--text-secondary, #94a3b8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nw-modal-close:hover {
  background: rgba(244, 63, 94, 0.16);
  border-color: rgba(244, 63, 94, 0.4);
  color: #fb7185;
}

.nw-modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px 20px 22px 20px;
}

/* Smooth Modal Transition */
.nw-modal-enter-active,
.nw-modal-leave-active {
  transition: opacity 0.18s ease;
}

.nw-modal-enter-active .nw-modal-shell,
.nw-modal-leave-active .nw-modal-shell {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease;
}

.nw-modal-enter-from,
.nw-modal-leave-to {
  opacity: 0;
}

.nw-modal-enter-from .nw-modal-shell,
.nw-modal-leave-to .nw-modal-shell {
  transform: scale(0.97) translateY(8px);
  opacity: 0;
}
</style>
