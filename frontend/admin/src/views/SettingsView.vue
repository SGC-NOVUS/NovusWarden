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

const isPlaintextAdminToken = computed(() => {
  if (values.value['disable_admin_token']) return false;
  const tok = values.value['admin_token'];
  return typeof tok === 'string' && tok.trim().length > 0 && !tok.trim().startsWith('$argon2');
});

function hasRiskWarning(el: ConfigElement): boolean {
  const txt = `${el.doc.name || ''} ${el.doc.description || ''} ${el.doc.name_localized || ''}`;
  return txt.includes('(Know the risks!)');
}

const filteredGroups = computed(() => {
  if (!configData.value) return [];
  const q = searchQuery.value.toLowerCase().trim();

  const byCategory =
    activeCategory.value === 'all'
      ? configData.value.config
      : activeCategory.value === 'readonly'
        ? configData.value.config
            .map(group => ({
              ...group,
              elements: group.elements.filter(e => !e.editable),
            }))
            .filter(group => group.elements.length > 0)
        : configData.value.config.filter(group => group.group === activeCategory.value);

  return byCategory
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

function isElementDisabled(group: ConfigGroup, el: ConfigElement): boolean {
  if (!el.editable) return true;
  if (group.grouptoggle && el.name !== group.grouptoggle) {
    return !values.value[group.grouptoggle];
  }
  return false;
}

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
    case 'smtp': return 'Почтовый сервер (SMTP / Resend)';
    case 'email_2fa': return 'Email 2FA';
    case 'yubico': return 'Yubico YubiKey OTP';
    case 'duo': return 'Duo Security 2FA';
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
    case 'smtp': return '✉️';
    case 'email_2fa': return '📧';
    case 'yubico': return '🔐';
    case 'duo': return '📱';
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
    await loadConfig();
    message.value = { text: 'Конфигурация сервера успешно сохранена и применена!' };
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
        <h1 style="font-size: 24px; font-weight: 700; color: var(--admin-text-main, #f9fafb); margin: 0 0 6px 0;">
          Параметры и конфигурация сервера
        </h1>
        <p style="font-size: 14px; color: var(--admin-text-secondary, #9ca3af); margin: 0;">
          Все runtime-настройки NovusWarden: сеть, SMTP, KDF, 2FA, сессии, домены и политики безопасности.
        </p>
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button
          @click="showSmtpModal = true"
          style="background-color: var(--admin-surface-bg, #1f2937); color: #38bdf8; border: 1px solid var(--admin-input-border, #374151); padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;"
        >
          ✉️ Тест SMTP
        </button>
        <button
          v-if="configData?.can_backup"
          @click="handleBackup"
          :disabled="backingUp"
          style="background-color: var(--admin-surface-bg, #1f2937); color: #34d399; border: 1px solid var(--admin-input-border, #374151); padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
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
          style="background-color: #2563eb; color: #ffffff; border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(37,99,235,0.3);"
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

    <!-- Plaintext ADMIN_TOKEN security warning -->
    <div
      v-if="isPlaintextAdminToken"
      style="padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; background-color: #451a03; color: #fde68a; border: 1px solid #d97706;"
    >
      <strong>⚠️ Незащищённый ADMIN_TOKEN:</strong> используется открытый токен вместо PHC-хэша Argon2id (<code>$argon2id$...</code>). Сгенерируйте хэш командой <code>vaultwarden hash</code>.
    </div>

    <!-- Filter & Category Bar -->
    <div style="background-color: var(--admin-card-bg); border: 1px solid var(--admin-card-border); border-radius: 14px; padding: 16px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--admin-card-shadow);">
      <div style="position: relative;">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Быстрый поиск среди 100+ параметров по имени, коду или описанию..."
          style="width: 100%; box-sizing: border-box; background-color: var(--admin-input-bg); border: 1px solid var(--admin-input-border); color: var(--admin-text-main); padding: 10px 14px; border-radius: 10px; font-size: 13px; outline: none;"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          style="position: absolute; right: 12px; top: 10px; background: none; border: none; color: var(--admin-text-secondary); cursor: pointer; font-size: 14px;"
        >
          ✕
        </button>
      </div>

      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        <button
          @click="activeCategory = 'all'"
          :style="{
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeCategory === 'all' ? '1px solid var(--admin-accent, #38bdf8)' : '1px solid var(--admin-input-border)',
            backgroundColor: activeCategory === 'all' ? 'rgba(14, 165, 233, 0.16)' : 'var(--admin-surface-bg)',
            color: activeCategory === 'all' ? 'var(--admin-accent, #38bdf8)' : 'var(--admin-text-secondary)',
          }"
        >
          Все параметры
        </button>
        <button
          v-for="cat in [
            { id: 'settings', label: 'Основные', icon: '⚙️' },
            { id: 'folders', label: 'Папки', icon: '📁' },
            { id: 'smtp', label: 'Почта SMTP / Resend', icon: '✉️' },
            { id: 'email_2fa', label: 'Email 2FA', icon: '📧' },
            { id: 'yubico', label: 'Yubico', icon: '🔐' },
            { id: 'duo', label: 'Duo 2FA', icon: '📱' },
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
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeCategory === cat.id ? '1px solid var(--admin-accent, #38bdf8)' : '1px solid var(--admin-input-border)',
            backgroundColor: activeCategory === cat.id ? 'rgba(14, 165, 233, 0.16)' : 'var(--admin-surface-bg)',
            color: activeCategory === cat.id ? 'var(--admin-accent, #38bdf8)' : 'var(--admin-text-secondary)',
          }"
        >
          {{ cat.icon }} {{ cat.label }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" style="padding: 40px; text-align: center; color: var(--admin-text-secondary, #9ca3af);">
      Загрузка дерева конфигурации NovusWarden...
    </div>

    <!-- Config Groups -->
    <div v-else style="display: grid; gap: 24px;">
      <div
        v-for="group in filteredGroups"
        :key="group.group"
        style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; overflow: hidden;"
      >
        <!-- Group Header -->
        <div style="background-color: var(--admin-table-head, #1a2234); padding: 16px 20px; border-bottom: 1px solid var(--admin-card-border, #1f2937); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px;">{{ getGroupIcon(group.group) }}</span>
            <div>
              <div style="font-size: 15px; font-weight: 700; color: var(--admin-text-main, #f9fafb);">
                {{ getGroupName(group) }}
              </div>
              <div style="font-size: 11px; color: var(--admin-text-secondary, #9ca3af); font-family: monospace;">
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
              paddingLeft: hasRiskWarning(el) ? '12px' : '0',
              borderBottom: '1px solid var(--admin-card-border, #1f2937)',
              borderLeft: hasRiskWarning(el) ? '3px solid #f59e0b' : 'none',
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1.2fr)',
              gap: '24px',
              alignItems: 'center',
              backgroundColor: el.overridden ? 'rgba(234, 179, 8, 0.05)' : hasRiskWarning(el) ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
            }"
          >
            <!-- Label & Meta Column -->
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <label
                  :for="'input_' + el.name"
                  style="font-size: 13px; font-weight: 600; color: var(--admin-text-main, #f3f4f6); cursor: pointer;"
                >
                  {{ el.doc.name_localized || el.doc.name || el.name }}
                </label>
                <span
                  v-if="hasRiskWarning(el)"
                  style="font-size: 10px; font-weight: 700; background-color: #78350f; color: #fde68a; padding: 1px 6px; border-radius: 4px;"
                >
                  ⚠️ Риск безопасности
                </span>
                <span
                  style="font-family: monospace; font-size: 11px; background-color: var(--admin-surface-bg, #1f2937); color: var(--admin-text-secondary, #94a3b8); padding: 2px 6px; border-radius: 4px;"
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
                  style="font-size: 10px; font-weight: 600; background-color: #374151; color: var(--admin-text-subtle, #cbd5e1); padding: 1px 6px; border-radius: 4px;"
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
                style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); margin-top: 4px; line-height: 18px;"
              >
                {{ el.doc.desc_localized || el.doc.description }}
              </div>

              <div
                v-if="el.default !== undefined && el.default !== null && el.default !== ''"
                style="font-size: 11px; color: #64748b; margin-top: 4px;"
              >
                По умолчанию: <code style="color: var(--admin-text-secondary, #94a3b8);">{{ String(el.default) }}</code>
              </div>
            </div>

            <!-- Input Control Column -->
            <div>
              <!-- Checkbox -->
              <div v-if="el.type === 'checkbox'" style="display: flex; align-items: center; gap: 12px;">
                <label :style="{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: isElementDisabled(group, el) ? 'not-allowed' : 'pointer' }">
                  <input
                    :id="'input_' + el.name"
                    type="checkbox"
                    v-model="values[el.name]"
                    :disabled="isElementDisabled(group, el)"
                    style="opacity: 0; width: 0; height: 0;"
                  />
                  <span
                    :style="{
                      position: 'absolute',
                      cursor: isElementDisabled(group, el) ? 'not-allowed' : 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: values[el.name] ? '#2563eb' : 'var(--admin-input-border, #374151)',
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
                <span :style="{ fontSize: '13px', fontWeight: 500, color: values[el.name] ? '#0284c7' : 'var(--admin-text-secondary, #9ca3af)' }">
                  {{ values[el.name] ? 'Включено' : 'Отключено' }}
                </span>
              </div>

              <!-- Password / Secret (including database_url) -->
              <div v-else-if="el.type === 'password' || el.name === 'database_url'" style="display: flex; gap: 6px;">
                <input
                  :id="'input_' + el.name"
                  :type="showPasswords[el.name] ? 'text' : 'password'"
                  v-model="values[el.name]"
                  :disabled="isElementDisabled(group, el)"
                  :placeholder="el.default ? `По умолчанию: ${el.default}` : 'Не задано'"
                  style="flex: 1; background-color: var(--admin-input-bg, #0b0f19); border: 1px solid var(--admin-input-border, #374151); color: var(--admin-text-main, #f9fafb); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; font-family: monospace;"
                />
                <button
                  type="button"
                  @click="togglePassword(el.name)"
                  style="background-color: var(--admin-surface-bg, #1f2937); color: var(--admin-text-secondary, #9ca3af); border: 1px solid var(--admin-input-border, #374151); padding: 0 12px; border-radius: 6px; font-size: 12px; cursor: pointer;"
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
                :disabled="isElementDisabled(group, el)"
                :placeholder="el.default !== null && el.default !== undefined ? `По умолчанию: ${el.default}` : ''"
                style="width: 100%; box-sizing: border-box; background-color: var(--admin-input-bg, #0b0f19); border: 1px solid var(--admin-input-border, #374151); color: var(--admin-text-main, #f9fafb); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none;"
              />

              <!-- Text -->
              <input
                v-else
                :id="'input_' + el.name"
                type="text"
                v-model="values[el.name]"
                :disabled="isElementDisabled(group, el)"
                :placeholder="el.default ? `По умолчанию: ${el.default}` : ''"
                style="width: 100%; box-sizing: border-box; background-color: var(--admin-input-bg, #0b0f19); border: 1px solid var(--admin-input-border, #374151); color: var(--admin-text-main, #f9fafb); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none;"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sticky Unsaved Changes Save Bar -->
    <div
      v-if="modifiedCount > 0"
      style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 90; display: flex; align-items: center; gap: 14px; padding: 10px 18px; border-radius: 14px; background: var(--admin-card-bg); border: 1px solid var(--admin-accent, #38bdf8); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55); backdrop-filter: blur(14px);"
    >
      <span style="font-size: 13px; font-weight: 600; color: var(--admin-text-main);">
        Несохранённых изменений: <strong style="color: var(--admin-accent, #38bdf8);">{{ modifiedCount }}</strong>
      </span>
      <button
        type="button"
        @click="loadConfig"
        style="background: var(--admin-surface-bg); color: var(--admin-text-main); border: 1px solid var(--admin-input-border); padding: 7px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer;"
      >
        Отменить
      </button>
      <button
        type="button"
        :disabled="saving"
        @click="handleSave"
        style="background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; border: none; padding: 7px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);"
      >
        {{ saving ? 'Сохранение...' : 'Сохранить конфигурацию' }}
      </button>
    </div>

    <!-- SMTP Test Modal -->
    <div
      v-if="showSmtpModal"
      @click.self="showSmtpModal = false"
      style="position: fixed; inset: 0; background-color: rgba(2, 6, 18, 0.72); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px;"
    >
      <div style="background-color: var(--admin-card-bg); border: 1px solid var(--admin-card-border); border-radius: 16px; width: 100%; max-width: 480px; padding: 24px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);">
        <h3 style="font-size: 17px; font-weight: 700; color: var(--admin-text-main); margin: 0 0 8px 0;">
          ✉️ Проверка доставки почты (SMTP / Resend)
        </h3>
        <p style="font-size: 13px; color: var(--admin-text-secondary); margin: 0 0 16px 0; line-height: 1.5;">
          Сервер отправит тестовое диагностическое письмо на указанный email с использованием сохранённого транспорта (Resend API или SMTP).
        </p>
        <div
          v-if="modifiedCount > 0"
          style="padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; background-color: #713f12; color: #fde68a; border: 1px solid #a16207;"
        >
          ⚠️ У вас есть несохранённые изменения ({{ modifiedCount }}). Тест использует ранее сохранённые настройки — сначала сохраните конфигурацию!
        </div>

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
            style="width: 100%; box-sizing: border-box; background-color: var(--admin-input-bg, #0b0f19); border: 1px solid var(--admin-input-border, #374151); color: var(--admin-text-main, #f9fafb); padding: 10px 14px; border-radius: 6px; font-size: 13px; outline: none; margin-bottom: 16px;"
          />

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button
              type="button"
              @click="showSmtpModal = false"
              style="background-color: var(--admin-surface-bg, #1f2937); color: var(--admin-text-main, #e5e7eb); border: 1px solid var(--admin-input-border, #374151); padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer;"
            >
              Закрыть
            </button>
            <button
              type="submit"
              :disabled="smtpTesting"
              style="background-color: #2563eb; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
            >
              {{ smtpTesting ? 'Отправка...' : 'Отправить письмо' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
