<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api, adminUrl, type DiagnosticsData } from '../api/client.ts';
import { copyTextToClipboard } from '@shared/clipboard.ts';
import { notifyToast } from '@shared/dialogs.ts';

const loading = ref(true);
const diag = ref<DiagnosticsData | null>(null);
const error = ref<string | null>(null);
const supportJson = ref<string | null>(null);
const generatingSupport = ref(false);
const copied = ref(false);

const browserTime = ref<string>('');
const timeDifferenceSeconds = ref<number | null>(null);
const domainMatches = ref<boolean>(true);
const isHttps = ref<boolean>(typeof window !== 'undefined' && window.location.protocol === 'https:');
const wsStatus = ref<'checking' | 'ok' | 'error' | 'disabled'>('checking');
const httpCheckStatus = ref<'checking' | 'ok' | 'error'>('checking');

const hasEnvWarnings = computed(() => {
  const d = diag.value;
  if (!d) return false;
  const badConfigStatus =
    !!d.config_file_status &&
    d.config_file_status !== 'Loaded' &&
    d.config_file_status !== 'No config file';
  return badConfigStatus || !!d.invalid_env_vars || Boolean(d.invalid_feature_flags?.length);
});

function runWsCheck(enabled: boolean) {
  if (!enabled) {
    wsStatus.value = 'disabled';
    return;
  }
  wsStatus.value = 'checking';
  try {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}${adminUrl('/notifications/anonymous-hub?token=admin-diagnostics')}`);
    const timer = setTimeout(() => {
      if (wsStatus.value === 'checking') {
        wsStatus.value = 'error';
        ws.close();
      }
    }, 4500);
    ws.onopen = () => {
      clearTimeout(timer);
      wsStatus.value = 'ok';
      ws.close();
    };
    ws.onerror = () => {
      clearTimeout(timer);
      wsStatus.value = 'error';
    };
  } catch {
    wsStatus.value = 'error';
  }
}

async function runHttpCheck() {
  httpCheckStatus.value = 'checking';
  try {
    const status = await api.testHttpCode(404);
    httpCheckStatus.value = status === 404 ? 'ok' : 'error';
  } catch {
    httpCheckStatus.value = 'error';
  }
}

async function loadDiagnostics() {
  loading.value = true;
  error.value = null;
  try {
    const data = await api.getDiagnosticsData();
    diag.value = data;

    // Check browser time diff
    const now = new Date();
    browserTime.value = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

    if (data.server_time) {
      const serverDate = new Date(data.server_time);
      const diffMs = Math.abs(now.getTime() - serverDate.getTime());
      timeDifferenceSeconds.value = Math.round(diffMs / 1000);
    }

    // Check domain match
    if (data.admin_url) {
      const browserOrigin = window.location.origin.toLowerCase();
      domainMatches.value = data.admin_url.toLowerCase().startsWith(browserOrigin);
    }

    runWsCheck(!!data.enable_websocket);
    runHttpCheck();
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function handleGenerateSupport() {
  generatingSupport.value = true;
  try {
    const cfg = await api.getDiagnosticsConfig();
    const d = diag.value;
    const summary = [
      '### NovusWarden Diagnostics Support Report',
      `- **Server Version:** ${d?.current_release || 'unknown'} (upstream: ${d?.latest_release || 'n/a'})`,
      `- **Web Vault:** ${d?.web_vault_enabled ? (d?.active_web_release || 'enabled') : 'disabled'}`,
      `- **OS / Arch:** ${d?.host_os || '?'} / ${d?.host_arch || '?'} (Container: ${d?.running_within_container ? d?.container_base_image || 'Yes' : 'No'})`,
      `- **Database:** ${d?.db_type || '?'} (${d?.db_version || '?'})`,
      `- **Domain Match / HTTPS:** ${domainMatches.value ? 'Match' : 'Mismatch'} / ${isHttps.value ? 'HTTPS' : 'HTTP'}`,
      `- **DNS / HTTP / WS:** ${d?.dns_resolved || '?'} | HTTP=${httpCheckStatus.value} | WS=${wsStatus.value}`,
      `- **Time Drift:** ${timeDifferenceSeconds.value ?? '?'}s (NTP: ${d?.ntp_time || 'n/a'})`,
      `- **Config Status:** ${d?.config_file_status || 'ok'} | Invalid Env: ${d?.invalid_env_vars || 'none'}`,
      '',
      '<details><summary>Anonymized Config JSON</summary>',
      '',
      '```json',
      JSON.stringify(cfg, null, 2),
      '```',
      '',
      '</details>',
    ].join('\n');
    supportJson.value = summary;
  } catch (err: any) {
    notifyToast(err?.message || 'Ошибка формирования отчёта поддержки', 'error');
  } finally {
    generatingSupport.value = false;
  }
}

async function copySupport() {
  if (!supportJson.value) return;
  const ok = await copyTextToClipboard(supportJson.value);
  if (!ok) return;
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

onMounted(loadDiagnostics);
</script>

<template>
  <div>
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
      <div>
        <h1 style="font-size: 24px; font-weight: 700; color: var(--admin-text-main, #f9fafb); margin: 0 0 6px 0;">
          Диагностика и телеметрия системы
        </h1>
        <p style="font-size: 14px; color: var(--admin-text-secondary, #9ca3af); margin: 0;">
          Проверка версий ядра, целостности сетевых протоколов, времени NTP, базы данных и HTTP-заголовков.
        </p>
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button
          @click="loadDiagnostics"
          style="background-color: var(--admin-surface-bg, #1f2937); color: var(--admin-text-main, #e5e7eb); border: 1px solid var(--admin-input-border, #374151); padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          Обновить тесты
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" style="padding: 40px; text-align: center; color: var(--admin-text-secondary, #9ca3af);">
      Выполнение диагностических проверок сервера...
    </div>

    <div v-else-if="error" style="background-color: var(--admin-badge-red-bg); border: 1px solid var(--admin-badge-red-border); color: var(--admin-badge-red-text); padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      {{ error }}
    </div>

    <div v-else style="display: grid; gap: 24px;">
      <!-- Version & Software Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
        <!-- Server Version Card -->
        <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">
            Версия сервера NovusWarden
          </div>
          <div style="font-size: 20px; font-weight: 700; color: var(--admin-sky, #38bdf8); margin-top: 8px;">
            {{ diag?.current_release }}
          </div>
          <div style="font-size: 12px; color: var(--admin-text-muted, #64748b); margin-top: 4px;">
            Последняя upstream-версия: <span style="color: var(--admin-text-subtle, #cbd5e1);">{{ diag?.latest_release || 'Актуальная' }}</span>
          </div>
        </div>

        <!-- Web Vault Card -->
        <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">
            Web Vault Интерфейс
          </div>
          <div style="font-size: 20px; font-weight: 700; color: var(--admin-purple, #a78bfa); margin-top: 8px;">
            {{ diag?.web_vault_enabled ? (diag?.active_web_release || 'Включен') : 'Отключен' }}
          </div>
          <div style="font-size: 12px; color: var(--admin-text-muted, #64748b); margin-top: 4px;">
            Upstream Web: <span style="color: var(--admin-text-subtle, #cbd5e1);">{{ diag?.latest_web_release || 'v2026.11.0' }}</span>
          </div>
        </div>

        <!-- Database Card -->
        <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">
            База данных
          </div>
          <div style="font-size: 20px; font-weight: 700; color: var(--admin-emerald, #34d399); margin-top: 8px;">
            {{ diag?.db_type }}
          </div>
          <div style="font-size: 12px; color: var(--admin-text-muted, #64748b); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="diag?.db_version">
            {{ diag?.db_version }}
          </div>
        </div>

        <!-- Environment Card -->
        <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">
            Окружение и ОС
          </div>
          <div style="font-size: 20px; font-weight: 700; color: var(--admin-amber, #fbbf24); margin-top: 8px;">
            {{ diag?.host_os }} / {{ diag?.host_arch }}
          </div>
          <div style="font-size: 12px; color: var(--admin-text-muted, #64748b); margin-top: 4px;">
            Docker: <span style="color: var(--admin-text-subtle, #cbd5e1);">{{ diag?.running_within_container ? (diag?.container_base_image || 'Да (Alpine/Debian)') : 'Нативная среда' }}</span>
          </div>
        </div>
      </div>

      <!-- Network & Security Status Checks -->
      <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: var(--admin-text-main, #f9fafb); margin: 0 0 16px 0;">
          Сетевые тесты и безопасность
        </h2>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
          <!-- DNS Check -->
          <div style="background-color: var(--admin-surface-alt, #0b0f19); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: var(--admin-text-main, #e5e7eb);">Разрешение имён DNS</span>
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: !diag?.dns_resolved?.includes('Unable') ? 'var(--admin-badge-green-bg)' : 'var(--admin-badge-red-bg)',
                  color: !diag?.dns_resolved?.includes('Unable') ? 'var(--admin-badge-green-text)' : 'var(--admin-badge-red-text)',
                  border: !diag?.dns_resolved?.includes('Unable') ? '1px solid var(--admin-badge-green-border)' : '1px solid var(--admin-badge-red-border)',
                }"
              >
                {{ !diag?.dns_resolved?.includes('Unable') ? 'Успешно' : 'Ошибка' }}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); margin-top: 6px;">
              github.com -> <code style="color: var(--admin-sky, #38bdf8);">{{ diag?.dns_resolved }}</code>
            </div>
          </div>

          <!-- HTTP Access -->
          <div style="background-color: var(--admin-surface-alt, #0b0f19); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: var(--admin-text-main, #e5e7eb);">Исходящий интернет-доступ</span>
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: diag?.has_http_access ? 'var(--admin-badge-green-bg)' : 'var(--admin-badge-red-bg)',
                  color: diag?.has_http_access ? 'var(--admin-badge-green-text)' : 'var(--admin-badge-red-text)',
                  border: diag?.has_http_access ? '1px solid var(--admin-badge-green-border)' : '1px solid var(--admin-badge-red-border)',
                }"
              >
                {{ diag?.has_http_access ? 'Доступен' : 'Ограничен' }}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); margin-top: 6px;">
              Прокси: {{ diag?.uses_proxy ? 'Используется HTTP(S)_PROXY' : 'Прямое сетевое соединение' }}
            </div>
          </div>

          <!-- WebSockets Live Check -->
          <div style="background-color: var(--admin-surface-alt, #0b0f19); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: var(--admin-text-main, #e5e7eb);">WebSocket уведомления</span>
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: wsStatus === 'ok' ? 'var(--admin-badge-green-bg)' : wsStatus === 'error' ? 'var(--admin-badge-red-bg)' : 'var(--admin-badge-neutral-bg)',
                  color: wsStatus === 'ok' ? 'var(--admin-badge-green-text)' : wsStatus === 'error' ? 'var(--admin-badge-red-text)' : 'var(--admin-badge-neutral-text)',
                  border: wsStatus === 'ok' ? '1px solid var(--admin-badge-green-border)' : wsStatus === 'error' ? '1px solid var(--admin-badge-red-border)' : '1px solid var(--admin-badge-neutral-border)',
                }"
              >
                {{ wsStatus === 'ok' ? 'Подключено (Live)' : wsStatus === 'error' ? 'Ошибка WS' : wsStatus === 'checking' ? 'Проверка...' : 'Отключены' }}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); margin-top: 6px;">
              Соединение <code style="color: var(--admin-sky, #38bdf8);">/notifications/anonymous-hub</code> | HTTP-тест 404:
              <span :style="{ color: httpCheckStatus === 'ok' ? 'var(--admin-emerald)' : 'var(--admin-rose)', fontWeight: 600 }">{{ httpCheckStatus.toUpperCase() }}</span>
            </div>
          </div>

          <!-- Domain & HTTPS Match -->
          <div style="background-color: var(--admin-surface-alt, #0b0f19); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: var(--admin-text-main, #e5e7eb);">Домен и HTTPS</span>
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: domainMatches && isHttps ? 'var(--admin-badge-green-bg)' : 'var(--admin-badge-amber-bg)',
                  color: domainMatches && isHttps ? 'var(--admin-badge-green-text)' : 'var(--admin-badge-amber-text)',
                  border: domainMatches && isHttps ? '1px solid var(--admin-badge-green-border)' : '1px solid var(--admin-badge-amber-border)',
                }"
              >
                {{ domainMatches ? 'Совпадает' : 'Несовпадение' }} • {{ isHttps ? 'HTTPS' : 'HTTP' }}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); margin-top: 6px;">
              DOMAIN: <code style="color: var(--admin-sky, #38bdf8);">{{ diag?.admin_url || '—' }}</code>
            </div>
          </div>

          <!-- Config & Env Diagnostics -->
          <div
            v-if="diag?.config_file_status || diag?.invalid_env_vars || (diag?.invalid_feature_flags?.length)"
            :style="{
              backgroundColor: 'var(--admin-surface-alt, #0b0f19)',
              border: hasEnvWarnings ? '1px solid var(--admin-badge-red-border)' : '1px solid var(--admin-card-border)',
              borderRadius: '8px',
              padding: '14px',
            }"
          >
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span :style="{ fontSize: '13px', fontWeight: 600, color: hasEnvWarnings ? 'var(--admin-badge-red-text)' : 'var(--admin-text-main)' }">
                {{ hasEnvWarnings ? 'Предупреждения окружения' : 'Конфигурация окружения' }}
              </span>
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: hasEnvWarnings ? 'var(--admin-badge-red-bg)' : 'var(--admin-badge-green-bg)',
                  color: hasEnvWarnings ? 'var(--admin-badge-red-text)' : 'var(--admin-badge-green-text)',
                  border: hasEnvWarnings ? '1px solid var(--admin-badge-red-border)' : '1px solid var(--admin-badge-green-border)',
                }"
              >
                {{ hasEnvWarnings ? 'Требует внимания' : (diag?.config_file_status || 'OK') }}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); margin-top: 6px;">
              <div v-if="diag?.config_file_status">Конфиг: <code :style="{ color: hasEnvWarnings ? 'var(--admin-amber)' : 'var(--admin-emerald)', fontWeight: 600 }">{{ diag.config_file_status }}</code></div>
              <div v-if="diag?.invalid_env_vars">Неверные ENV: <code style="color: var(--admin-rose);">{{ diag.invalid_env_vars }}</code></div>
              <div v-if="diag?.invalid_feature_flags?.length">Неизвестные флаги: <code style="color: var(--admin-rose);">{{ diag.invalid_feature_flags.join(', ') }}</code></div>
            </div>
          </div>

          <!-- IP Header Match -->
          <div style="background-color: var(--admin-surface-alt, #0b0f19); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: var(--admin-text-main, #e5e7eb);">Заголовок реального IP клиента</span>
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: diag?.ip_header_exists ? 'var(--admin-badge-green-bg)' : 'var(--admin-badge-amber-bg)',
                  color: diag?.ip_header_exists ? 'var(--admin-badge-green-text)' : 'var(--admin-badge-amber-text)',
                  border: diag?.ip_header_exists ? '1px solid var(--admin-badge-green-border)' : '1px solid var(--admin-badge-amber-border)',
                }"
              >
                {{ diag?.ip_header_exists ? (diag?.ip_header_name || 'Определён') : 'Прямой IP' }}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); margin-top: 6px;">
              Конфигурация IP_HEADER: <code style="color: var(--admin-sky, #38bdf8);">{{ diag?.ip_header_config || 'X-Real-IP / CF-Connecting-IP' }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- Time & Clock Synchronization -->
      <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: var(--admin-text-main, #f9fafb); margin: 0 0 16px 0;">
          Синхронизация часов и времени (NTP / Server / Browser)
        </h2>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
          <div>
            <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af);">Серверное время (UTC)</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--admin-text-subtle, #cbd5e1); margin-top: 4px; font-family: monospace;">
              {{ diag?.server_time }}
            </div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af);">Локальное время сервера</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--admin-text-subtle, #cbd5e1); margin-top: 4px; font-family: monospace;">
              {{ diag?.server_time_local }}
            </div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af);">Сетевое время NTP</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--admin-emerald, #34d399); margin-top: 4px; font-family: monospace;">
              {{ diag?.ntp_time || 'NTP доступен' }}
            </div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af);">Разница времени сервера и браузера</div>
            <div :style="{ fontSize: '14px', fontWeight: 600, color: (timeDifferenceSeconds || 0) <= 15 ? 'var(--admin-emerald)' : 'var(--admin-rose)', marginTop: '4px' }">
              {{ timeDifferenceSeconds !== null ? `${timeDifferenceSeconds} сек.` : 'Синхронизировано' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Support Report Generator -->
      <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="font-size: 16px; font-weight: 600; color: var(--admin-text-main, #f9fafb); margin: 0 0 4px 0;">
              Анонимизированный отчёт для поддержки
            </h2>
            <p style="font-size: 13px; color: var(--admin-text-secondary, #9ca3af); margin: 0;">
              Генерирует JSON-отчёт с маскированными паролями и секретами для публикации на GitHub Issues или форуме поддержки SGC-NOVUS.
            </p>
          </div>

          <button
            @click="handleGenerateSupport"
            :disabled="generatingSupport"
            style="background-color: #2563eb; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
          >
            {{ generatingSupport ? 'Генерация...' : 'Сгенерировать отчёт' }}
          </button>
        </div>

        <div v-if="supportJson" style="margin-top: 16px;">
          <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
            <button
              @click="copySupport"
              style="background-color: var(--admin-surface-bg, #1f2937); color: var(--admin-sky, #38bdf8); border: 1px solid var(--admin-input-border, #374151); padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;"
            >
              {{ copied ? 'Скопировано в буфер!' : 'Копировать в буфер' }}
            </button>
          </div>
          <pre style="background-color: var(--admin-surface-alt, #0b0f19); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 6px; padding: 14px; color: var(--admin-text-subtle, #cbd5e1); font-size: 12px; max-height: 280px; overflow-y: auto; font-family: monospace;">{{ supportJson }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
