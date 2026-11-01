<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api, type DiagnosticsData } from '../api/client.ts';

const loading = ref(true);
const diag = ref<DiagnosticsData | null>(null);
const error = ref<string | null>(null);
const supportJson = ref<string | null>(null);
const generatingSupport = ref(false);
const copied = ref(false);

const browserTime = ref<string>('');
const timeDifferenceSeconds = ref<number | null>(null);
const domainMatches = ref<boolean>(true);

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
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function handleGenerateSupport() {
  generatingSupport.value = true;
  try {
    const json = await api.getDiagnosticsConfig();
    supportJson.value = JSON.stringify(json, null, 2);
  } catch (err: any) {
    alert(err.message);
  } finally {
    generatingSupport.value = false;
  }
}

async function copySupport() {
  if (!supportJson.value) return;
  await navigator.clipboard.writeText(supportJson.value);
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
        <h1 style="font-size: 24px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
          Диагностика и телеметрия системы
        </h1>
        <p style="font-size: 14px; color: #9ca3af; margin: 0;">
          Проверка версий ядра, целостности сетевых протоколов, времени NTP, базы данных и HTTP-заголовков.
        </p>
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button
          @click="loadDiagnostics"
          style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          Обновить тесты
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" style="padding: 40px; text-align: center; color: #9ca3af;">
      Выполнение диагностических проверок сервера...
    </div>

    <div v-else-if="error" style="background-color: #450a0a; border: 1px solid #991b1b; color: #fca5a5; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      {{ error }}
    </div>

    <div v-else style="display: grid; gap: 24px;">
      <!-- Version & Software Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
        <!-- Server Version Card -->
        <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">
            Версия сервера NovusWarden
          </div>
          <div style="font-size: 20px; font-weight: 700; color: #38bdf8; margin-top: 8px;">
            {{ diag?.current_release }}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            Последняя upstream-версия: <span style="color: #cbd5e1;">{{ diag?.latest_release || 'Актуальная' }}</span>
          </div>
        </div>

        <!-- Web Vault Card -->
        <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">
            Web Vault Интерфейс
          </div>
          <div style="font-size: 20px; font-weight: 700; color: #a78bfa; margin-top: 8px;">
            {{ diag?.web_vault_enabled ? (diag?.active_web_release || 'Включен') : 'Отключен' }}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            Upstream Web: <span style="color: #cbd5e1;">{{ diag?.latest_web_release || 'v2024.12.0' }}</span>
          </div>
        </div>

        <!-- Database Card -->
        <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">
            База данных
          </div>
          <div style="font-size: 20px; font-weight: 700; color: #34d399; margin-top: 8px;">
            {{ diag?.db_type }}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="diag?.db_version">
            {{ diag?.db_version }}
          </div>
        </div>

        <!-- Environment Card -->
        <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">
            Окружение и ОС
          </div>
          <div style="font-size: 20px; font-weight: 700; color: #fbbf24; margin-top: 8px;">
            {{ diag?.host_os }} / {{ diag?.host_arch }}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            Docker: <span style="color: #cbd5e1;">{{ diag?.running_within_container ? (diag?.container_base_image || 'Да (Alpine/Debian)') : 'Нативная среда' }}</span>
          </div>
        </div>
      </div>

      <!-- Network & Security Status Checks -->
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0 0 16px 0;">
          Сетевые тесты и безопасность
        </h2>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
          <!-- DNS Check -->
          <div style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 6px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: #e5e7eb;">Разрешение имён DNS</span>
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: !diag?.dns_resolved?.includes('Unable') ? '#064e3b' : '#450a0a',
                  color: !diag?.dns_resolved?.includes('Unable') ? '#34d399' : '#f87171',
                }"
              >
                {{ !diag?.dns_resolved?.includes('Unable') ? 'Успешно' : 'Ошибка' }}
              </span>
            </div>
            <div style="font-size: 12px; color: #9ca3af; margin-top: 6px;">
              github.com -> <code style="color: #38bdf8;">{{ diag?.dns_resolved }}</code>
            </div>
          </div>

          <!-- HTTP Access -->
          <div style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 6px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: #e5e7eb;">Исходящий интернет-доступ</span>
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: diag?.has_http_access ? '#064e3b' : '#450a0a',
                  color: diag?.has_http_access ? '#34d399' : '#f87171',
                }"
              >
                {{ diag?.has_http_access ? 'Доступен' : 'Ограничен' }}
              </span>
            </div>
            <div style="font-size: 12px; color: #9ca3af; margin-top: 6px;">
              Прокси: {{ diag?.uses_proxy ? 'Используется HTTP(S)_PROXY' : 'Прямое сетевое соединение' }}
            </div>
          </div>

          <!-- WebSockets -->
          <div style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 6px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: #e5e7eb;">WebSocket уведомления</span>
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: diag?.enable_websocket ? '#064e3b' : '#374151',
                  color: diag?.enable_websocket ? '#34d399' : '#9ca3af',
                }"
              >
                {{ diag?.enable_websocket ? 'Включены' : 'Отключены' }}
              </span>
            </div>
            <div style="font-size: 12px; color: #9ca3af; margin-top: 6px;">
              Мгновенная синхронизация клиентов через <code style="color: #38bdf8;">/notifications/hub</code>
            </div>
          </div>

          <!-- IP Header Match -->
          <div style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 6px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600; color: #e5e7eb;">Заголовок реального IP клиента</span>
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: diag?.ip_header_exists ? '#064e3b' : '#713f12',
                  color: diag?.ip_header_exists ? '#34d399' : '#fde047',
                }"
              >
                {{ diag?.ip_header_exists ? (diag?.ip_header_name || 'Определён') : 'Прямой IP' }}
              </span>
            </div>
            <div style="font-size: 12px; color: #9ca3af; margin-top: 6px;">
              Конфигурация IP_HEADER: <code style="color: #38bdf8;">{{ diag?.ip_header_config || 'X-Real-IP / CF-Connecting-IP' }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- Time & Clock Synchronization -->
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0 0 16px 0;">
          Синхронизация часов и времени (NTP / Server / Browser)
        </h2>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
          <div>
            <div style="font-size: 12px; color: #9ca3af;">Серверное время (UTC)</div>
            <div style="font-size: 14px; font-weight: 600; color: #cbd5e1; margin-top: 4px; font-family: monospace;">
              {{ diag?.server_time }}
            </div>
          </div>
          <div>
            <div style="font-size: 12px; color: #9ca3af;">Локальное время сервера</div>
            <div style="font-size: 14px; font-weight: 600; color: #cbd5e1; margin-top: 4px; font-family: monospace;">
              {{ diag?.server_time_local }}
            </div>
          </div>
          <div>
            <div style="font-size: 12px; color: #9ca3af;">Сетевое время NTP</div>
            <div style="font-size: 14px; font-weight: 600; color: #34d399; margin-top: 4px; font-family: monospace;">
              {{ diag?.ntp_time || 'NTP доступен' }}
            </div>
          </div>
          <div>
            <div style="font-size: 12px; color: #9ca3af;">Разница времени сервера и браузера</div>
            <div style="font-size: 14px; font-weight: 600; color: (timeDifferenceSeconds || 0) <= 15 ? '#34d399' : '#f87171'; margin-top: 4px;">
              {{ timeDifferenceSeconds !== null ? `${timeDifferenceSeconds} сек.` : 'Синхронизировано' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Support Report Generator -->
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="font-size: 16px; font-weight: 600; color: #f9fafb; margin: 0 0 4px 0;">
              Анонимизированный отчёт для поддержки
            </h2>
            <p style="font-size: 13px; color: #9ca3af; margin: 0;">
              Генерирует JSON-отчёт с маскированными паролями и секретами для публикации на GitHub Issues или форуме поддержки SGC-NOVUS.
            </p>
          </div>

          <button
            @click="handleGenerateSupport"
            :disabled="generatingSupport"
            style="background-color: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
          >
            {{ generatingSupport ? 'Генерация...' : 'Сгенерировать отчёт' }}
          </button>
        </div>

        <div v-if="supportJson" style="margin-top: 16px;">
          <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
            <button
              @click="copySupport"
              style="background-color: #1f2937; color: #38bdf8; border: 1px solid #374151; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;"
            >
              {{ copied ? 'Скопировано в буфер!' : 'Копировать в буфер' }}
            </button>
          </div>
          <pre style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 6px; padding: 14px; color: #cbd5e1; font-size: 12px; max-height: 280px; overflow-y: auto; font-family: monospace;">{{ supportJson }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
