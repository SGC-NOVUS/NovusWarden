<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth.ts';
import { api, getDeviceIdentifier } from '../api/client.ts';
import { useI18n } from '@shared/i18n.ts';
import { confirmDialog, notifyToast } from '@shared/dialogs.ts';
import { Monitor, Smartphone, Globe, ShieldCheck, ShieldOff, RefreshCw } from 'lucide-vue-next';

interface DeviceItem {
  id: string;
  name: string;
  type: number;
  identifier: string;
  creationDate?: string;
  lastActivityDate?: string;
  twoFactorRemember?: boolean;
  isTrusted?: boolean;
}

const authStore = useAuthStore();
const { locale } = useI18n();

const devices = ref<DeviceItem[]>([]);
const loading = ref(false);
const revokingId = ref<string | null>(null);
const currentDeviceId = getDeviceIdentifier();

function deviceTypeLabel(type: number): string {
  const map: Record<number, string> = {
    0: 'Android',
    1: 'iOS',
    2: 'Chrome Extension',
    3: 'Firefox Extension',
    4: 'Opera Extension',
    5: 'Edge Extension',
    6: 'Windows Desktop',
    7: 'macOS Desktop',
    8: 'Linux Desktop',
    9: 'Web Vault',
    10: 'Safari Extension',
    11: 'Vivaldi Extension',
    12: 'Brave Extension',
    21: 'SDK / CLI',
  };
  return map[type] || `Клиент #${type}`;
}

function isMobileType(type: number): boolean {
  return type === 0 || type === 1;
}

function formatDateLocal(raw?: string): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const tag = locale.value === 'uk' ? 'uk-UA' : locale.value === 'en' ? 'en-US' : 'ru-RU';
  return new Intl.DateTimeFormat(tag, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

async function loadDevices() {
  if (!authStore.token) return;
  loading.value = true;
  try {
    devices.value = await api.getDevices(authStore.token);
  } catch {
    devices.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleRevokeTrust(dev: DeviceItem) {
  if (!authStore.token) return;
  const ok = await confirmDialog({
    title: 'Отозвать 30-дневное доверие 2FA?',
    message: `Устройство «${dev.name}» (${deviceTypeLabel(dev.type)}) снова запросит второй фактор при следующем входе.`,
    confirmLabel: 'Отозвать доверие',
    danger: true,
  });
  if (!ok) return;

  revokingId.value = dev.identifier;
  try {
    await api.revokeDeviceTrust(authStore.token, dev.identifier);
    if (dev.identifier === currentDeviceId && authStore.savedEmail) {
      localStorage.removeItem(`novus_2fa_remember_${authStore.savedEmail.trim().toLowerCase()}`);
    }
    dev.twoFactorRemember = false;
    dev.isTrusted = false;
    notifyToast(`Доверие 2FA для «${dev.name}» отозвано`, 'success');
  } catch (err: any) {
    notifyToast(err?.message || 'Не удалось отозвать доверие устройства', 'error');
  } finally {
    revokingId.value = null;
  }
}

onMounted(loadDevices);
</script>

<template>
  <section class="settings-card">
    <div class="flex items-center justify-between gap-2 mb-2">
      <h2 class="card-heading mb-0!">
        <Monitor class="w-4 h-4 text-sky-400" />
        <span>Активные устройства и доверенные 2FA-сессии</span>
      </h2>
      <button type="button" class="cyber-btn-secondary h-7! px-2.5! text-[11px]!" :disabled="loading" @click="loadDevices">
        <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading }" />
        <span>Обновить</span>
      </button>
    </div>

    <p class="card-desc">
      Все клиенты (Web Vault, браузерные расширения, мобильные приложения), подключавшиеся к вашему аккаунту. Можно точечно сбросить 30-дневный токен 2FA для любого устройства.
    </p>

    <div v-if="loading && devices.length === 0" class="text-xs text-slate-400 py-3">
      Загрузка списка устройств...
    </div>

    <div v-else-if="devices.length === 0" class="text-xs text-slate-400 py-2">
      Нет зарегистрированных устройств.
    </div>

    <div v-else class="space-y-2 max-h-64 overflow-y-auto pr-1">
      <div
        v-for="dev in devices"
        :key="dev.id"
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-black/25 border"
        :class="dev.identifier === currentDeviceId ? 'border-sky-500/40' : 'border-slate-800/80'"
      >
        <div class="flex items-start gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/70 flex items-center justify-center shrink-0 mt-0.5">
            <Smartphone v-if="isMobileType(dev.type)" class="w-4 h-4 text-indigo-400" />
            <Globe v-else-if="dev.type === 9" class="w-4 h-4 text-sky-400" />
            <Monitor v-else class="w-4 h-4 text-emerald-400" />
          </div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-slate-100 flex flex-wrap items-center gap-1.5">
              <span class="truncate">{{ dev.name || deviceTypeLabel(dev.type) }}</span>
              <span
                v-if="dev.identifier === currentDeviceId"
                class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30"
              >
                Текущий браузер
              </span>
              <span
                v-if="dev.twoFactorRemember || dev.isTrusted"
                class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1"
              >
                <ShieldCheck class="w-3 h-3" /> 2FA · 30 дней
              </span>
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5">
              {{ deviceTypeLabel(dev.type) }} · Последняя активность: {{ formatDateLocal(dev.lastActivityDate || dev.creationDate) }}
            </div>
          </div>
        </div>

        <button
          v-if="dev.twoFactorRemember || dev.isTrusted"
          type="button"
          class="cyber-btn-danger h-7! px-2.5! text-[11px]! shrink-0 self-end sm:self-center"
          :disabled="revokingId === dev.identifier"
          @click="handleRevokeTrust(dev)"
        >
          <ShieldOff class="w-3 h-3" />
          <span>Отозвать 2FA</span>
        </button>
      </div>
    </div>
  </section>
</template>
