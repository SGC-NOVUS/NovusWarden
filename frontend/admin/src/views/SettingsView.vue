<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api, type ConfigResponse, type ConfigGroup, type ConfigElement } from '../api/client.ts';

const loading = ref(true);
const saving = ref(false);
const resetting = ref(false);
const configData = ref<ConfigResponse | null>(null);
const values = ref<Record<string, any>>({});
const initialValues = ref<Record<string, any>>({});
const activeCategory = ref<string>('all');
const searchQuery = ref<string>('');
const showPasswords = ref<Record<string, boolean>>({});
const message = ref<{ text: string; error?: boolean } | null>(null);

// SMTP Test state
const showSmtpModal = ref(false);
const testEmail = ref('');
const smtpTesting = ref(false);
const smtpResult = ref<{ text: string; error?: boolean } | null>(null);

// Database backup
const backingUp = ref(false);

async function loadConfig() {
  loading.value = true;
  message.value = null;
  try {
    const res = await api.getConfig();
    configData.value = res;

    const map: Record<string, any> = {};
    for (const group of res.config) {
      for (const el of group.elements) {
        map[el.name] = el.value ?? (el.type === 'checkbox' ? false : '');
      }
    }
    values.value = { ...map };
    initialValues.value = { ...map };
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  } finally {
    loading.value = false;
  }
}

const modifiedCount = computed(() => {
  let count = 0;
  for (const key of Object.keys(values.value)) {
    if (values.value[key] !== initialValues.value[key]) {
      count++;
    }
  }
  return count;
});

const filteredGroups = computed(() => {
  if (!configData.value) return [];
  const q = searchQuery.value.toLowerCase().trim();

  return configData.value.config
    .filter(group => {
      if (activeCategory.value === 'all') return true;
      if (activeCategory.value === 'readonly') return group.elements.every(e => !e.editable);
      return group.group === activeCategory.value;
    })
    .map(group => {
      if (!q) return group;
      const matchingElements = group.elements.filter(el => {
        const name = (el.doc.name_localized || el.doc.name || '').toLowerCase();
        const desc = (el.doc.desc_localized || el.doc.description || '').toLowerCase();
        const code = el.name.toLowerCase();
        return name.includes(q) || desc.includes(q) || code.includes(q);
      });
      return {
        ...group,
        elements: matchingElements,
      };
    })
    .filter(group => group.elements.length > 0);
});

function getGroupName(group: ConfigGroup): string {
  if (group.groupdoc_localized) return group.groupdoc_localized;
  if (group.groupdoc) return group.groupdoc;
  switch (group.group) {
    case 'settings': return 'Основные параметры';
    case 'folders': return 'Папки и пути хранения (Только чтение)';
    case 'ws': return 'WebSockets уведомления';
    case 'push': return 'Push-уведомления';
    case 'jobs': return 'Планировщик фоновых задач';
    case 'client': return 'Параметры клиентских приложений';
    case 'advanced': return 'Расширенные серверные настройки';
    case 'sso': return 'Single Sign-On (SSO / OIDC)';
    default: return group.group;
  }
}

function getGroupIcon(group: string): string {
  switch (group) {
    case 'settings': return '⚙️';
    case 'folders': return '📁';
    case 'ws': return '⚡';
    case 'push': return '🔔';
    case 'jobs': return '⏱️';
    case 'client': return '💻';
    case 'advanced': return '🛡️';
    case 'sso': return '🔑';
    default: return '🔧';
  }
}

function togglePassword(name: string) {
  showPasswords.value[name] = !showPasswords.value[name];
}

async function handleSave() {
  saving.value = true;
  message.value = null;
  try {
    const payload: Record<string, any> = {};
    for (const group of configData.value?.config || []) {
      for (const el of group.elements) {
        if (!el.editable) continue;
        const val = values.value[el.name];
        if (el.type === 'checkbox') {
          payload[el.name] = !!val;
        } else if (el.type === 'number') {
          payload[el.name] = val !== '' && val !== null ? Number(val) : null;
        } else {
          payload[el.name] = val !== '' ? val : null;
        }
      }
    }
    await api.saveConfig(payload);
    message.value = { text: 'Конфигурация сервера успешно сохранена и применена!' };
    initialValues.value = { ...values.value };
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  } finally {
    saving.value = false;
  }
}

async function handleReset() {
  const answer = prompt(
    'ВНИМАНИЕ: Сброс настроек удалит все сохранённые переопределения config.json и вернёт параметры к переменным окружения.\n\nДля подтверждения введите слово "DELETE":'
  );
  if (answer !== 'DELETE') {
    if (answer !== null) alert('Неверное слово подтверждения. Сброс отменён.');
    return;
  }

  resetting.value = true;
  try {
    await api.resetConfig();
    alert('Конфигурация сброшена к значениям по умолчанию.');
    await loadConfig();
  } catch (err: any) {
    alert(err.message);
  } finally {
    resetting.value = false;
  }
}

async function handleBackup() {
  backingUp.value = true;
  try {
    const res = await api.backupDatabase();
    alert(res || 'Резервная копия базы данных успешно создана!');
  } catch (err: any) {
    alert(err.message);
  } finally {
    backingUp.value = false;
  }
}

async function handleSmtpTest() {
  if (!testEmail.value) return;
  smtpTesting.value = true;
  smtpResult.value = null;
  try {
    await api.testSmtp(testEmail.value);
    smtpResult.value = { text: `Тестовое письмо успешно отправлено на ${testEmail.value}!` };
  } catch (err: any) {
    smtpResult.value = { text: err.message, error: true };
  } finally {
    smtpTesting.value = false;
  }
}

onMounted(loadConfig);
</script>

<template>
  <div>
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
      <div>
        <h1 style="font-size: 24px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
          Параметры и конфигурация сервера
        </h1>
        <p style="font-size: 14px; color: #9ca3af; margin: 0;">
          Все runtime-настройки NovusWarden: сеть, SMTP, KDF, 2FA, сессии, домены и политики безопасности.
        </p>
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button
          @click="showSmtpModal = true"
          style="background-color: #1f2937; color: #38bdf8; border: 1px solid #374151; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;"
        >
          ✉️ Тест SMTP
        </button>
        <button
          v-if="configData?.can_backup"
          @click="handleBackup"
          :disabled="backingUp"
          style="background-color: #1f2937; color: #34d399; border: 1px solid #374151; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          💾 {{ backingUp ? 'Создание...' : 'Бэкап БД' }}
        </button>
        <button
          @click="handleReset"
          :disabled="resetting"
          style="background-color: #450a0a; color: #f87171; border: 1px solid #991b1b; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          Сброс к умолчанию
        </button>
        <button
          @click="handleSave"
          :disabled="saving"
          style="background-color: #2563eb; color: white; border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(37,99,235,0.3);"
        >
          {{ saving ? 'Сохранение...' : 'Сохранить изменения' }}
          <span v-if="modifiedCount > 0" style="background-color: #1d4ed8; padding: 1px 6px; border-radius: 999px; font-size: 11px;">
            {{ modifiedCount }}
          </span>
        </button>
      </div>
    </div>

    <!-- Alert Banner -->
    <div
      v-if="message"
      :style="{
        padding: '12px 16px',
        borderRadius: '6px',
        marginBottom: '20px',
        fontSize: '13px',
        fontWeight: 500,
        backgroundColor: message.error ? '#450a0a' : '#052e16',
        color: message.error ? '#fca5a5' : '#86efac',
        border: message.error ? '1px solid #991b1b' : '1px solid #166534',
      }"
    >
      {{ message.text }}
    </div>

    <!-- Filter & Category Bar -->
    <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 14px;">
      <div style="position: relative;">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Быстрый поиск среди 100+ параметров по имени, коду или описанию..."
          style="width: 100%; box-sizing: border-box; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 10px 14px; border-radius: 6px; font-size: 13px; outline: none;"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          style="position: absolute; right: 12px; top: 10px; background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 14px;"
        >
          ✕
        </button>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button
          @click="activeCategory = 'all'"
          :style="{
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeCategory === 'all' ? '1px solid #3b82f6' : '1px solid #374151',
            backgroundColor: activeCategory === 'all' ? '#1e3a8a' : '#1f2937',
            color: activeCategory === 'all' ? '#93c5fd' : '#9ca3af',
          }"
        >
          Все параметры
        </button>
        <button
          v-for="cat in [
            { id: 'settings', label: 'Основные', icon: '⚙️' },
            { id: 'ws', label: 'WebSockets', icon: '⚡' },
            { id: 'push', label: 'Push', icon: '🔔' },
            { id: 'jobs', label: 'Задачи', icon: '⏱️' },
            { id: 'client', label: 'Клиенты', icon: '💻' },
            { id: 'advanced', label: 'Продвинутые', icon: '🛡️' },
            { id: 'sso', label: 'SSO / OIDC', icon: '🔑' },
            { id: 'readonly', label: 'Только чтение', icon: '🔒' },
          ]"
          :key="cat.id"
          @click="activeCategory = cat.id"
          :style="{
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeCategory === cat.id ? '1px solid #3b82f6' : '1px solid #374151',
            backgroundColor: activeCategory === cat.id ? '#1e3a8a' : '#1f2937',
            color: activeCategory === cat.id ? '#93c5fd' : '#9ca3af',
          }"
        >
          {{ cat.icon }} {{ cat.label }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" style="padding: 40px; text-align: center; color: #9ca3af;">
      Загрузка дерева конфигурации NovusWarden...
    </div>

    <!-- Config Groups -->
    <div v-else style="display: grid; gap: 24px;">
      <div
        v-for="group in filteredGroups"
        :key="group.group"
        style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden;"
      >
        <!-- Group Header -->
        <div style="background-color: #1a2234; padding: 16px 20px; border-bottom: 1px solid #1f2937; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px;">{{ getGroupIcon(group.group) }}</span>
            <div>
              <div style="font-size: 15px; font-weight: 700; color: #f9fafb;">
                {{ getGroupName(group) }}
              </div>
              <div style="font-size: 11px; color: #9ca3af; font-family: monospace;">
                group: {{ group.group }} ({{ group.elements.length }} параметров)
              </div>
            </div>
          </div>
        </div>

        <!-- Elements List -->
        <div style="padding: 8px 20px;">
          <div
            v-for="el in group.elements"
            :key="el.name"
            :style="{
              padding: '16px 0',
              borderBottom: '1px solid #1f2937',
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1.2fr)',
              gap: '24px',
              alignItems: 'center',
              backgroundColor: el.overridden ? 'rgba(234, 179, 8, 0.05)' : 'transparent',
            }"
          >
            <!-- Label & Meta Column -->
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <label
                  :for="'input_' + el.name"
                  style="font-size: 13px; font-weight: 600; color: #f3f4f6; cursor: pointer;"
                >
                  {{ el.doc.name_localized || el.doc.name || el.name }}
                </label>
                <span
                  style="font-family: monospace; font-size: 11px; background-color: #1f2937; color: #94a3b8; padding: 2px 6px; border-radius: 4px;"
                >
                  {{ el.name }}
                </span>
                <span
                  v-if="el.overridden"
                  style="font-size: 10px; font-weight: 700; background-color: #854d0e; color: #fef08a; padding: 1px 6px; border-radius: 4px;"
                  title="Параметр переопределён переменными окружения"
                >
                  ⚡ Переопределено
                </span>
                <span
                  v-if="!el.editable"
                  style="font-size: 10px; font-weight: 600; background-color: #374151; color: #cbd5e1; padding: 1px 6px; border-radius: 4px;"
                >
                  🔒 Read-only
                </span>
                <span
                  v-if="values[el.name] !== initialValues[el.name]"
                  style="font-size: 10px; font-weight: 700; background-color: #1e3a8a; color: #93c5fd; padding: 1px 6px; border-radius: 4px;"
                >
                  ● Изменено
                </span>
              </div>

              <div
                v-if="el.doc.desc_localized || el.doc.description"
                style="font-size: 12px; color: #9ca3af; margin-top: 4px; line-height: 18px;"
              >
                {{ el.doc.desc_localized || el.doc.description }}
              </div>

              <div
                v-if="el.default !== undefined && el.default !== null && el.default !== ''"
                style="font-size: 11px; color: #64748b; margin-top: 4px;"
              >
                По умолчанию: <code style="color: #94a3b8;">{{ String(el.default) }}</code>
              </div>
            </div>

            <!-- Input Control Column -->
            <div>
              <!-- Checkbox -->
              <div v-if="el.type === 'checkbox'" style="display: flex; align-items: center; gap: 12px;">
                <label style="position: relative; display: inline-block; width: 44px; height: 24px; cursor: el.editable ? 'pointer' : 'not-allowed';">
                  <input
                    :id="'input_' + el.name"
                    type="checkbox"
                    v-model="values[el.name]"
                    :disabled="!el.editable"
                    style="opacity: 0; width: 0; height: 0;"
                  />
                  <span
                    :style="{
                      position: 'absolute',
                      cursor: el.editable ? 'pointer' : 'not-allowed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: values[el.name] ? '#2563eb' : '#374151',
                      transition: '.2s',
                      borderRadius: '24px',
                    }"
                  >
                    <span
                      :style="{
                        position: 'absolute',
                        content: '',
                        height: '18px',
                        width: '18px',
                        left: values[el.name] ? '22px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        transition: '.2s',
                        borderRadius: '50%',
                      }"
                    ></span>
                  </span>
                </label>
                <span style="font-size: 13px; font-weight: 500; color: values[el.name] ? '#93c5fd' : '#9ca3af';">
                  {{ values[el.name] ? 'Включено' : 'Отключено' }}
                </span>
              </div>

              <!-- Password -->
              <div v-else-if="el.type === 'password'" style="display: flex; gap: 6px;">
                <input
                  :id="'input_' + el.name"
                  :type="showPasswords[el.name] ? 'text' : 'password'"
                  v-model="values[el.name]"
                  :disabled="!el.editable"
                  :placeholder="el.default ? `По умолчанию: ${el.default}` : 'Не задано'"
                  style="flex: 1; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; font-family: monospace;"
                />
                <button
                  type="button"
                  @click="togglePassword(el.name)"
                  style="background-color: #1f2937; color: #9ca3af; border: 1px solid #374151; padding: 0 12px; border-radius: 6px; font-size: 12px; cursor: pointer;"
                >
                  {{ showPasswords[el.name] ? 'Скрыть' : 'Показать' }}
                </button>
              </div>

              <!-- Number -->
              <input
                v-else-if="el.type === 'number'"
                :id="'input_' + el.name"
                type="number"
                v-model="values[el.name]"
                :disabled="!el.editable"
                :placeholder="el.default !== null && el.default !== undefined ? `По умолчанию: ${el.default}` : ''"
                style="width: 100%; box-sizing: border-box; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none;"
              />

              <!-- Text -->
              <input
                v-else
                :id="'input_' + el.name"
                type="text"
                v-model="values[el.name]"
                :disabled="!el.editable"
                :placeholder="el.default ? `По умолчанию: ${el.default}` : ''"
                style="width: 100%; box-sizing: border-box; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none;"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SMTP Test Modal -->
    <div
      v-if="showSmtpModal"
      style="position: fixed; inset: 0; background-color: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100;"
    >
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; width: 100%; max-width: 480px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <h3 style="font-size: 18px; font-weight: 700; color: #f9fafb; margin: 0 0 12px 0;">
          ✉️ Проверка доставки SMTP-почты
        </h3>
        <p style="font-size: 13px; color: #9ca3af; margin: 0 0 16px 0;">
          Сервер отправит тестовое диагностическое сообщение на указанный email-адрес с использованием текущих настроек SMTP.
        </p>

        <div v-if="smtpResult" :style="{
          padding: '10px 14px',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '12px',
          backgroundColor: smtpResult.error ? '#450a0a' : '#052e16',
          color: smtpResult.error ? '#fca5a5' : '#86efac',
          border: smtpResult.error ? '1px solid #991b1b' : '1px solid #166534',
        }">
          {{ smtpResult.text }}
        </div>

        <form @submit.prevent="handleSmtpTest">
          <input
            v-model="testEmail"
            type="email"
            placeholder="admin@domain.com"
            required
            style="width: 100%; box-sizing: border-box; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 10px 14px; border-radius: 6px; font-size: 13px; outline: none; margin-bottom: 16px;"
          />

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button
              type="button"
              @click="showSmtpModal = false"
              style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer;"
            >
              Закрыть
            </button>
            <button
              type="submit"
              :disabled="smtpTesting"
              style="background-color: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
            >
              {{ smtpTesting ? 'Отправка...' : 'Отправить письмо' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
