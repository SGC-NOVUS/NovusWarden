import { ref } from 'vue';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  countdownSec?: number;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** When set, user must type this exact text to unlock confirmation */
  requireText?: string;
  requirePlaceholder?: string;
}

export interface PromptOptions {
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ActiveDialogState {
  mode: 'confirm' | 'prompt';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  requireText?: string;
  placeholder?: string;
  inputValue: string;
  resolve: (result: any) => void;
}

let toastIdSeq = 1;
export const toasts = ref<ToastItem[]>([]);
export const activeDialog = ref<ActiveDialogState | null>(null);

export function notifyToast(
  message: string,
  type: ToastType = 'info',
  durationMs = 3400,
  countdownSec?: number
) {
  const id = toastIdSeq++;
  toasts.value = [...toasts.value.slice(-4), { id, message, type, countdownSec }];
  setTimeout(() => {
    dismissToast(id);
  }, durationMs);
}

export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((item) => item.id !== id);
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    activeDialog.value = {
      mode: 'confirm',
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel || (options.danger ? 'Удалить' : 'Подтвердить'),
      cancelLabel: options.cancelLabel || 'Отмена',
      danger: !!options.danger,
      requireText: options.requireText,
      placeholder: options.requirePlaceholder || options.requireText || '',
      inputValue: '',
      resolve,
    };
  });
}

export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    activeDialog.value = {
      mode: 'prompt',
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel || 'Сохранить',
      cancelLabel: options.cancelLabel || 'Отмена',
      danger: false,
      placeholder: options.placeholder || '',
      inputValue: options.defaultValue || '',
      resolve,
    };
  });
}

export function resolveActiveDialog(accepted: boolean) {
  const dlg = activeDialog.value;
  if (!dlg) return;
  if (accepted && dlg.requireText && dlg.inputValue.trim() !== dlg.requireText) {
    return;
  }
  activeDialog.value = null;
  if (dlg.mode === 'prompt') {
    dlg.resolve(accepted ? dlg.inputValue : null);
  } else {
    dlg.resolve(accepted);
  }
}
