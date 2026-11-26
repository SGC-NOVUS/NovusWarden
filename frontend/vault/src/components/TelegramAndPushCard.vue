<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import QRCode from 'qrcode';
import { useAuthStore } from '../stores/auth.ts';
import { api } from '../api/client.ts';
import { copyTextToClipboard } from '@shared/clipboard.ts';
import { confirmDialog, notifyToast } from '@shared/dialogs.ts';
import {
  Send,
  Bell,
  CheckCircle2,
  ExternalLink,
  Copy,
  RefreshCw,
  Trash2,
  Smartphone,
} from 'lucide-vue-next';

const authStore = useAuthStore();

const loading = ref(true);
const status = ref<any>(null);

// Telegram linking state
const linking = ref(false);
const linkData = ref<{ token: string; botUsername: string; deepLink: string } | null>(null);
const linkQrSvg = ref<string>('');
let linkWatchTimer: any = null;

// Telegram editable preferences
const otpEnabled = ref(true);
const telegramOnlyOtp = ref(false);
const loginApprovalEnabled = ref(true);
const alertsEnabled = ref(true);
const autoEnableEmail2fa = ref(true);
const savingTg = ref(false);
const testingTg = ref(false);

// Browser Web Push state
const pushSupported = ref(
  typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
);
const subscribingPush = ref(false);
const testingPush = ref(false);

function stopLinkWatcher() {
  if (linkWatchTimer) {
    clearInterval(linkWatchTimer);
    linkWatchTimer = null;
  }
}

onUnmounted(() => {
  stopLinkWatcher();
});

async function loadStatus() {
  if (!authStore.token) return;
  loading.value = true;
  try {
    const res = await api.getNotificationsStatus(authStore.token);
    status.value = res;
    if (res.telegram) {
      otpEnabled.value = !!res.telegram.otpEnabled;
      telegramOnlyOtp.value = !!res.telegram.telegramOnlyOtp;
      loginApprovalEnabled.value = !!res.telegram.loginApprovalEnabled;
      alertsEnabled.value = !!res.telegram.alertsEnabled;
      linkData.value = null;
      stopLinkWatcher();
    }
  } catch (err: any) {
    notifyToast(err?.message || 'Ошибка загрузки настроек уведомлений', 'error');
  } finally {
    loading.value = false;
  }
}

async function handleGenerateTelegramLink() {
  if (!authStore.token) return;
  linking.value = true;
  try {
    const res = await api.createTelegramLinkToken(authStore.token);
    linkData.value = res;
    linkQrSvg.value = await QRCode.toString(res.deepLink, {
      type: 'svg',
      margin: 1,
      width: 156,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    stopLinkWatcher();
    linkWatchTimer = setInterval(async () => {
      if (!authStore.token) return;
      try {
        const next = await api.getNotificationsStatus(authStore.token);
        if (next.telegramLinked) {
          stopLinkWatcher();
          status.value = next;
          if (next.telegram) {
            otpEnabled.value = !!next.telegram.otpEnabled;
            telegramOnlyOtp.value = !!next.telegram.telegramOnlyOtp;
            loginApprovalEnabled.value = !!next.telegram.loginApprovalEnabled;
            alertsEnabled.value = !!next.telegram.alertsEnabled;
          }
          linkData.value = null;
          notifyToast('Telegram-бот успешно привязан к вашему сейфу!', 'success');
        }
      } catch {
        // Ignore background poll error
      }
    }, 3000);
  } catch (err: any) {
    notifyToast(err?.message || 'Не удалось сгенерировать ссылку Telegram', 'error');
  } finally {
    linking.value = false;
  }
}

async function copyDeepLink() {
  if (!linkData.value) return;
  const ok = await copyTextToClipboard(linkData.value.deepLink);
  if (ok) notifyToast('Ссылка привязки Telegram скопирована', 'success');
}

async function handleSaveTelegramPrefs() {
  if (!authStore.token) return;
  savingTg.value = true;
  try {
    await api.saveTelegramPreferences(authStore.token, {
      otpEnabled: otpEnabled.value,
      telegramOnlyOtp: telegramOnlyOtp.value,
      loginApprovalEnabled: loginApprovalEnabled.value,
      alertsEnabled: alertsEnabled.value,
      autoEnableEmail2fa: autoEnableEmail2fa.value && otpEnabled.value && !status.value?.email2faEnabled,
    });
    notifyToast('Настройки Telegram Guard сохранены', 'success');
    await loadStatus();
  } catch (err: any) {
    notifyToast(err?.message || 'Ошибка сохранения настроек Telegram', 'error');
  } finally {
    savingTg.value = false;
  }
}

async function handleTestTelegram() {
  if (!authStore.token) return;
  testingTg.value = true;
  try {
    await api.sendTelegramTest(authStore.token);
    notifyToast('Тестовое уведомление отправлено в Telegram!', 'success');
  } catch (err: any) {
    notifyToast(err?.message || 'Ошибка отправки теста в Telegram', 'error');
  } finally {
    testingTg.value = false;
  }
}

async function handleUnlinkTelegram() {
  if (!authStore.token) return;
  const ok = await confirmDialog({
    title: 'Отвязать Telegram-бота?',
    message: 'Доставка 2FA-кодов, кнопок подтверждения входа и уведомлений безопасности в Telegram будет остановлена.',
    confirmLabel: 'Отвязать чат',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.unlinkTelegram(authStore.token);
    notifyToast('Telegram-чат отвязан от аккаунта', 'info');
    await loadStatus();
  } catch (err: any) {
    notifyToast(err?.message || 'Не удалось отвязать Telegram', 'error');
  }
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function handleSubscribeBrowserPush() {
  if (!authStore.token || !status.value?.vapidPublicKey) return;
  if (!pushSupported.value) {
    notifyToast('Текущий браузер не поддерживает Web Push API', 'warning');
    return;
  }
  subscribingPush.value = true;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Разрешите уведомления в браузере для подключения Push');
    }
    const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    const appServerKey = base64UrlToUint8Array(status.value.vapidPublicKey);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey as BufferSource,
    });

    const p256dh = arrayBufferToBase64Url(sub.getKey('p256dh'));
    const auth = arrayBufferToBase64Url(sub.getKey('auth'));
    if (!p256dh || !auth) {
      throw new Error('Браузер не предоставил ключи шифрования ECDH P-256');
    }

    await api.subscribeWebPush(authStore.token, {
      endpoint: sub.endpoint,
      keys: { p256dh, auth },
      userAgent: navigator.userAgent.slice(0, 96),
    });
    notifyToast('Браузер успешно подключён к зашифрованным Web Push уведомлениям!', 'success');
    await loadStatus();
  } catch (err: any) {
    notifyToast(err?.message || 'Ошибка подписки на Web Push', 'error');
  } finally {
    subscribingPush.value = false;
  }
}

async function handleRemovePushSub(subId: string) {
  if (!authStore.token) return;
  try {
    await api.unsubscribeWebPush(authStore.token, subId);
    notifyToast('Подписка браузера удалена', 'info');
    await loadStatus();
  } catch (err: any) {
    notifyToast(err?.message || 'Ошибка удаления подписки', 'error');
  }
}

async function handleTestPush() {
  if (!authStore.token) return;
  testingPush.value = true;
  try {
    const res = await api.sendWebPushTest(authStore.token);
    notifyToast(`Отправлено Push-уведомлений: ${res.delivered} из ${res.total}`, 'success');
  } catch (err: any) {
    notifyToast(err?.message || 'Ошибка отправки тестового Push', 'error');
  } finally {
    testingPush.value = false;
  }
}

onMounted(loadStatus);
</script>

<template>
  <div class="space-y-6">
    <!-- CARD 1: TELEGRAM GUARD -->
    <div class="tg-card">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 class="text-sm font-bold flex items-center gap-2 m-0">
          <Send class="w-4 h-4 text-sky-400" />
          <span>Telegram Guard • OTP, Вход в 1 клик и Алерты</span>
        </h2>
        <div class="flex items-center gap-2">
          <span
            v-if="status?.telegramLinked"
            class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"
          >
            <CheckCircle2 class="w-3 h-3" />
            <span>Привязан {{ status.telegram?.username ? `@${status.telegram.username}` : status.telegram?.chatIdMasked }}</span>
          </span>
          <span
            v-else-if="status?.telegramEnabled"
            class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30"
          >
            Готов к привязке
          </span>
          <span
            v-else
            class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700"
          >
            Не настроен на сервере
          </span>
          <button type="button" class="cyber-btn-secondary h-7! px-2.5! text-[11px]!" :disabled="loading" @click="loadStatus">
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading }" />
          </button>
        </div>
      </div>

      <p class="text-xs text-slate-400 leading-relaxed mb-4">
        Получайте мгновенные 6-значные коды 2FA (совместимые со всеми расширениями и мобильными приложениями Bitwarden), подтверждайте вход одной кнопкой и отслеживайте безопасность сейфа в Telegram.
      </p>

      <div v-if="!status?.telegramEnabled && !loading" class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
        Администратор сервера ещё не активировал Telegram-бота. Укажите <code>TELEGRAM_ENABLED=true</code> и <code>TELEGRAM_BOT_TOKEN</code> в <strong>Control Plane → Настройки сервера → Telegram Bot</strong>.
      </div>

      <!-- Unlinked State -->
      <div v-else-if="!status?.telegramLinked && !loading" class="space-y-3">
        <div v-if="!linkData">
          <button
            type="button"
            class="cyber-btn-primary"
            :disabled="linking"
            @click="handleGenerateTelegramLink"
          >
            <Send class="w-3.5 h-3.5" />
            <span>{{ linking ? 'Подключение к боту...' : 'Подключить Telegram-бота' }}</span>
          </button>
        </div>

        <div v-else class="p-4 rounded-xl bg-black/25 border border-slate-800 grid grid-cols-1 sm:grid-cols-[168px_1fr] gap-4 items-center">
          <div class="flex flex-col items-center gap-1.5">
            <div v-if="linkQrSvg" class="bg-white p-2 rounded-xl border border-slate-300" v-html="linkQrSvg"></div>
            <span class="text-[10.5px] text-slate-400">Сканируйте с телефона</span>
          </div>

          <div class="space-y-2.5 min-w-0">
            <div class="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
              <RefreshCw class="w-3.5 h-3.5 animate-spin" />
              <span>Ожидание нажатия «Start» в боте @{{ linkData.botUsername }}...</span>
            </div>
            <p class="text-xs text-slate-400 m-0 leading-relaxed">
              Откройте бота по кнопке ниже и нажмите <strong>Запустить / Start</strong>. Страница обновится автоматически сразу после привязки.
            </p>
            <div class="flex flex-wrap gap-2">
              <a
                :href="linkData.deepLink"
                target="_blank"
                rel="noopener noreferrer"
                class="cyber-btn-primary no-underline"
              >
                <span>Открыть @{{ linkData.botUsername }}</span>
                <ExternalLink class="w-3.5 h-3.5" />
              </a>
              <button type="button" class="cyber-btn-secondary" @click="copyDeepLink">
                <Copy class="w-3.5 h-3.5" />
                <span>Скопировать ссылку</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Linked Preferences State -->
      <div v-else-if="status?.telegramLinked" class="space-y-3">
        <div class="p-3.5 rounded-xl bg-black/20 border border-slate-800 space-y-2.5 text-xs">
          <label class="flex items-start gap-2.5 cursor-pointer">
            <input v-model="otpEnabled" type="checkbox" class="mt-0.5 accent-sky-500" />
            <div>
              <div class="font-semibold text-slate-200">Доставлять 6-значные 2FA-коды в Telegram</div>
              <div class="text-[11px] text-slate-400">Работает во всех браузерных расширениях, десктопных и мобильных клиентах Bitwarden / NovusWarden</div>
            </div>
          </label>

          <label v-if="otpEnabled && !status?.email2faEnabled" class="flex items-start gap-2.5 cursor-pointer pl-5">
            <input v-model="autoEnableEmail2fa" type="checkbox" class="mt-0.5 accent-sky-500" />
            <div class="text-[11px] text-sky-300">
              Автоматически активировать канал 2FA-кодов для расширений и мобильных приложений
            </div>
          </label>

          <label v-if="otpEnabled" class="flex items-start gap-2.5 cursor-pointer pl-5">
            <input v-model="telegramOnlyOtp" type="checkbox" class="mt-0.5 accent-sky-500" />
            <div>
              <div class="font-semibold text-slate-200">Отправлять коды ТОЛЬКО в Telegram</div>
              <div class="text-[11px] text-slate-400">Не дублировать одноразовый код на электронную почту, если доставка в Telegram прошла успешно</div>
            </div>
          </label>

          <label class="flex items-start gap-2.5 cursor-pointer">
            <input v-model="loginApprovalEnabled" type="checkbox" class="mt-0.5 accent-sky-500" />
            <div>
              <div class="font-semibold text-slate-200">Подтверждение входа в Web Vault одной кнопкой (Push Approval)</div>
              <div class="text-[11px] text-slate-400">Кнопки «✅ Подтвердить» / «❌ Заблокировать» с антифишинговым пин-кодом без ввода цифр</div>
            </div>
          </label>

          <label class="flex items-start gap-2.5 cursor-pointer">
            <input v-model="alertsEnabled" type="checkbox" class="mt-0.5 accent-sky-500" />
            <div>
              <div class="font-semibold text-slate-200">Мгновенные уведомления безопасности</div>
              <div class="text-[11px] text-slate-400">Вход с нового устройства, незавершённый 2FA, сброс 2FA и отклонение чужих запросов входа</div>
            </div>
          </label>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="cyber-btn-primary" :disabled="savingTg" @click="handleSaveTelegramPrefs">
            <span>{{ savingTg ? 'Сохранение...' : 'Сохранить настройки Telegram' }}</span>
          </button>
          <button type="button" class="cyber-btn-secondary" :disabled="testingTg" @click="handleTestTelegram">
            <span>{{ testingTg ? 'Отправка...' : 'Тестовое сообщение' }}</span>
          </button>
          <button type="button" class="cyber-btn-danger" @click="handleUnlinkTelegram">
            <Trash2 class="w-3.5 h-3.5" />
            <span>Отвязать</span>
          </button>
        </div>
      </div>
    </div>

    <!-- CARD 2: BROWSER WEB PUSH (VAPID) & MOBILE PUSH -->
    <div class="tg-card">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 class="text-sm font-bold flex items-center gap-2 m-0">
          <Bell class="w-4 h-4 text-amber-400" />
          <span>Push-уведомления (Браузерный Web Push + Мобильный Relay)</span>
        </h2>
        <span
          class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
          :class="
            status?.webPushSubscriptions?.length
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          "
        >
          Активных браузеров: {{ status?.webPushSubscriptions?.length || 0 }}
        </span>
      </div>

      <p class="text-xs text-slate-400 leading-relaxed mb-3">
        Сквозное шифрование уведомлений по стандарту <strong>RFC 8291 (ECDH P-256 + AES-128-GCM)</strong> и <strong>VAPID ES256</strong>: получайте системные оповещения о новых входах и запросах доступа даже при закрытой вкладке сейфа.
      </p>

      <div class="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          class="cyber-btn-primary"
          :disabled="subscribingPush || !status?.webPushEnabled || !pushSupported"
          @click="handleSubscribeBrowserPush"
        >
          <Bell class="w-3.5 h-3.5" />
          <span>{{ subscribingPush ? 'Подключение...' : 'Подключить Push в этом браузере' }}</span>
        </button>
        <button
          v-if="status?.webPushSubscriptions?.length"
          type="button"
          class="cyber-btn-secondary"
          :disabled="testingPush"
          @click="handleTestPush"
        >
          <span>{{ testingPush ? 'Отправка...' : 'Отправить тестовый Push' }}</span>
        </button>
      </div>

      <div v-if="status?.webPushSubscriptions?.length" class="space-y-1.5 mb-3">
        <div
          v-for="sub in status.webPushSubscriptions"
          :key="sub.id"
          class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-black/20 border border-slate-800 text-xs"
        >
          <div class="min-w-0 truncate">
            <span class="font-semibold text-slate-200">{{ sub.endpointHost }}</span>
            <span class="text-slate-400 ml-2 text-[11px]">{{ sub.createdAt }}</span>
          </div>
          <button
            type="button"
            class="cyber-btn-danger h-7! px-2.5! text-[11px]! shrink-0"
            @click="handleRemovePushSub(sub.id)"
          >
            Удалить
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-slate-800 text-[11.5px] text-slate-400">
        <Smartphone class="w-4 h-4 shrink-0 text-sky-400" />
        <span>
          Мобильный Bitwarden Push Relay (iOS / Android):
          <strong :class="status?.mobilePushRelayEnabled ? 'text-emerald-400' : 'text-slate-300'">
            {{ status?.mobilePushRelayEnabled ? 'Активен' : 'Настраивается в Control Plane → Push (PUSH_ENABLED)' }}
          </strong>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tg-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--card-shadow);
}
</style>
