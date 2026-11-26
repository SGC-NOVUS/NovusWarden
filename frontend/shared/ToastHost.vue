<script setup lang="ts">
import { toasts, dismissToast } from './dialogs.ts';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next';
</script>

<template>
  <Teleport to="body">
    <div class="nw-toast-stack" aria-live="polite">
      <TransitionGroup name="nw-toast">
        <div
          v-for="item in toasts"
          :key="item.id"
          class="nw-toast-card"
          :class="`is-${item.type}`"
        >
          <CheckCircle2 v-if="item.type === 'success'" class="w-4 h-4 shrink-0 text-emerald-400" />
          <AlertCircle v-else-if="item.type === 'error'" class="w-4 h-4 shrink-0 text-rose-400" />
          <AlertTriangle v-else-if="item.type === 'warning'" class="w-4 h-4 shrink-0 text-amber-400" />
          <Info v-else class="w-4 h-4 shrink-0 text-sky-400" />
          <span class="nw-toast-text">{{ item.message }}</span>
          <button
            type="button"
            class="nw-toast-close"
            aria-label="Скрыть"
            @click="dismissToast(item.id)"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.nw-toast-stack {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 9995;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 380px;
  pointer-events: none;
}

.nw-toast-card {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #f8fafc;
  font-size: 12.5px;
  font-weight: 500;
  box-shadow: 0 14px 36px -8px rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(12px);
}

.nw-toast-card.is-success {
  border-color: rgba(16, 185, 129, 0.42);
}

.nw-toast-card.is-error {
  border-color: rgba(244, 63, 94, 0.48);
}

.nw-toast-card.is-warning {
  border-color: rgba(245, 158, 11, 0.45);
}

.nw-toast-text {
  flex: 1;
  line-height: 1.4;
}

.nw-toast-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
}

.nw-toast-close:hover {
  color: #ffffff;
}

.nw-toast-enter-active,
.nw-toast-leave-active {
  transition: all 0.2s ease;
}

.nw-toast-enter-from,
.nw-toast-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

:global(html.light) .nw-toast-card {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 14px 32px -10px rgba(15, 23, 42, 0.18);
}
</style>
