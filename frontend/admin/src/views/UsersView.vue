<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api, type UserSummary } from '../api/client.ts';

const users = ref<UserSummary[]>([]);
const search = ref('');
const statusFilter = ref<string>('all');
const loading = ref(true);
const inviteEmail = ref('');
const inviting = ref(false);
const resyncing = ref(false);
const message = ref<{ text: string; error?: boolean } | null>(null);

// Role change modal
const selectedUser = ref<UserSummary | null>(null);
const selectedOrg = ref<{ id: string; name: string; type: number } | null>(null);
const selectedRole = ref<number>(2);
const showRoleModal = ref(false);
const updatingRole = ref(false);

async function loadUsers() {
  loading.value = true;
  message.value = null;
  try {
    users.value = await api.getUsers();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  } finally {
    loading.value = false;
  }
}

const filteredUsers = computed(() => {
  const q = search.value.toLowerCase().trim();
  return users.value.filter(u => {
    // Status filter
    if (statusFilter.value === 'active' && (!u.userEnabled || u.status === 1)) return false;
    if (statusFilter.value === 'disabled' && u.userEnabled) return false;
    if (statusFilter.value === 'invited' && u.status !== 1) return false;
    if (statusFilter.value === '2fa' && !u.twoFactorEnabled) return false;

    // Search query
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.ssoIdentifier && u.ssoIdentifier.toLowerCase().includes(q))
    );
  });
});

async function handleInvite() {
  if (!inviteEmail.value) return;
  inviting.value = true;
  message.value = null;
  try {
    await api.inviteUser(inviteEmail.value);
    message.value = { text: `Приглашение успешно отправлено на ${inviteEmail.value}!` };
    inviteEmail.value = '';
    await loadUsers();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  } finally {
    inviting.value = false;
  }
}

async function handleForceResync() {
  if (!confirm('Принудительно обновить ревизии всех пользователей? Это заставит все подключённые клиенты (расширения, мобильные и десктоп приложения) заново синхронизировать хранилище.')) return;
  resyncing.value = true;
  try {
    await api.updateRevision();
    message.value = { text: 'Ревизии успешно обновлены! Клиенты синхронизируют данные.' };
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  } finally {
    resyncing.value = false;
  }
}

async function handleDeauth(uuid: string) {
  if (!confirm('Отозвать все активные сессии для этого пользователя?')) return;
  try {
    await api.deauthUser(uuid);
    message.value = { text: 'Все активные сессии пользователя аннулированы.' };
    await loadUsers();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  }
}

async function handleRemove2FA(uuid: string) {
  if (!confirm('Сбросить двухфакторную аутентификацию (2FA) для этого пользователя?')) return;
  try {
    await api.remove2FA(uuid);
    message.value = { text: 'Двухфакторная аутентификация пользователя отключена.' };
    await loadUsers();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  }
}

async function handleToggleUser(user: UserSummary) {
  const action = user.userEnabled ? 'отключить' : 'активировать';
  if (!confirm(`Вы действительно хотите ${action} учётную запись ${user.email}?`)) return;
  try {
    if (user.userEnabled) {
      await api.disableUser(user.id);
      message.value = { text: `Учётная запись ${user.email} отключена.` };
    } else {
      await api.enableUser(user.id);
      message.value = { text: `Учётная запись ${user.email} активирована.` };
    }
    await loadUsers();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  }
}

async function handleResendInvite(uuid: string, email: string) {
  try {
    await api.resendInvite(uuid);
    message.value = { text: `Приглашение повторно отправлено на ${email}.` };
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  }
}

async function handleDeleteSSO(uuid: string, email: string) {
  if (!confirm(`Удалить привязку SSO для пользователя ${email}?`)) return;
  try {
    await api.deleteSSO(uuid);
    message.value = { text: `Связь с SSO для пользователя ${email} удалена.` };
    await loadUsers();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  }
}

async function handleDelete(uuid: string, email: string) {
  if (!confirm(`ВНИМАНИЕ: Вы действительно хотите безвозвратно удалить пользователя ${email}? Все зашифрованные данные пользователя будут стёрты.`)) return;
  try {
    await api.deleteUser(uuid);
    message.value = { text: `Пользователь ${email} безвозвратно удалён.` };
    await loadUsers();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  }
}

function openRoleModal(user: UserSummary, org: { id: string; name: string; type: number }) {
  selectedUser.value = user;
  selectedOrg.value = org;
  selectedRole.value = org.type;
  showRoleModal.value = true;
}

async function saveUserRole() {
  if (!selectedUser.value || !selectedOrg.value) return;
  updatingRole.value = true;
  try {
    await api.updateMembershipType(selectedUser.value.id, selectedOrg.value.id, selectedRole.value);
    message.value = { text: `Роль пользователя ${selectedUser.value.email} в организации "${selectedOrg.value.name}" обновлена!` };
    showRoleModal.value = false;
    await loadUsers();
  } catch (err: any) {
    alert(err.message);
  } finally {
    updatingRole.value = false;
  }
}

function getRoleLabel(type: number): string {
  switch (type) {
    case 0: return 'Владелец';
    case 1: return 'Администратор';
    case 2: return 'Пользователь';
    case 3: return 'Менеджер';
    default: return 'Участник';
  }
}

function getRoleBadgeStyle(type: number) {
  switch (type) {
    case 0: return { backgroundColor: '#701a75', color: '#f5d0fe', border: '1px solid #a21caf' };
    case 1: return { backgroundColor: '#1e3a8a', color: '#93c5fd', border: '1px solid #2563eb' };
    case 3: return { backgroundColor: '#14532d', color: '#86efac', border: '1px solid #16a34a' };
    default: return { backgroundColor: '#1f2937', color: '#cbd5e1', border: '1px solid #374151' };
  }
}

function handleExportUsers() {
  window.open('/admin/users/export', '_blank');
}

onMounted(loadUsers);
</script>

<template>
  <div>
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
      <div>
        <h1 style="font-size: 24px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
          Пользователи хранилища
        </h1>
        <p style="font-size: 14px; color: #9ca3af; margin: 0;">
          Управление учётными записями, двухфакторной аутентификацией, ролями в организациях и сессиями.
        </p>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button
          @click="handleForceResync"
          :disabled="resyncing"
          style="background-color: #1f2937; color: #fbbf24; border: 1px solid #b45309; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          🔄 {{ resyncing ? 'Синхронизация...' : 'Синхронизировать клиентов' }}
        </button>
        <button
          @click="handleExportUsers"
          style="background-color: #1f2937; color: #34d399; border: 1px solid #374151; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          📥 Экспорт JSON
        </button>
        <button
          @click="loadUsers"
          style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          Обновить
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

    <!-- Top Bar: Invite User & Filters -->
    <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 18px; margin-bottom: 24px; display: grid; gap: 16px;">
      <!-- Invite user form -->
      <form @submit.prevent="handleInvite" style="display: flex; gap: 10px; flex-wrap: wrap;">
        <input
          v-model="inviteEmail"
          type="email"
          placeholder="colleague@domain.com (введите email для приглашения)"
          required
          style="flex: 1; min-width: 260px; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 10px 14px; border-radius: 6px; font-size: 13px; outline: none;"
        />
        <button
          type="submit"
          :disabled="inviting"
          style="background-color: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          {{ inviting ? 'Отправка...' : 'Пригласить пользователя' }}
        </button>
      </form>

      <!-- Search and filter pills -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <input
          v-model="search"
          type="text"
          placeholder="Поиск пользователей по имени, email или SSO..."
          style="min-width: 280px; max-width: 400px; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none;"
        />

        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button
            v-for="pill in [
              { id: 'all', label: `Все (${users.length})` },
              { id: 'active', label: 'Активные' },
              { id: 'disabled', label: 'Отключенные' },
              { id: 'invited', label: 'Приглашённые' },
              { id: '2fa', label: 'С 2FA' },
            ]"
            :key="pill.id"
            @click="statusFilter = pill.id"
            :style="{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: statusFilter === pill.id ? '1px solid #3b82f6' : '1px solid #374151',
              backgroundColor: statusFilter === pill.id ? '#1e3a8a' : '#1f2937',
              color: statusFilter === pill.id ? '#93c5fd' : '#9ca3af',
            }"
          >
            {{ pill.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Users Table -->
    <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 1px solid #1f2937; color: #9ca3af; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; background-color: #161e2e;">
            <th style="padding: 14px 18px;">Пользователь</th>
            <th style="padding: 14px 18px;">Статус / 2FA</th>
            <th style="padding: 14px 18px;">SSO</th>
            <th style="padding: 14px 18px;">Записи</th>
            <th style="padding: 14px 18px;">Вложения</th>
            <th style="padding: 14px 18px;">Организации</th>
            <th style="padding: 14px 18px;">Активность</th>
            <th style="padding: 14px 18px; text-align: right;">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" style="padding: 36px; text-align: center; color: #9ca3af;">
              Загрузка учётных записей пользователей из базы данных...
            </td>
          </tr>
          <tr v-else-if="filteredUsers.length === 0">
            <td colspan="8" style="padding: 36px; text-align: center; color: #6b7280;">
              Пользователи не найдены по заданным критериям фильтрации.
            </td>
          </tr>
          <tr
            v-for="user in filteredUsers"
            :key="user.id"
            style="border-bottom: 1px solid #1f2937; transition: background-color 0.15s ease;"
          >
            <!-- User Info Column -->
            <td style="padding: 14px 18px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background-color: #1e3a8a; color: #93c5fd; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">
                  {{ (user.name || user.email || 'U').charAt(0).toUpperCase() }}
                </div>
                <div>
                  <div style="font-weight: 600; color: #f9fafb;">
                    {{ user.name || user.email }}
                  </div>
                  <div style="font-size: 12px; color: #9ca3af;">
                    {{ user.email }}
                  </div>
                </div>
              </div>
            </td>

            <!-- Badges Column -->
            <td style="padding: 14px 18px;">
              <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                <span
                  v-if="!user.userEnabled"
                  style="font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 4px; background-color: #450a0a; color: #f87171; border: 1px solid #991b1b;"
                >
                  Отключен
                </span>
                <span
                  v-else-if="user.status === 1"
                  style="font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 4px; background-color: #713f12; color: #fde047; border: 1px solid #a16207;"
                >
                  Приглашён
                </span>
                <span
                  v-else
                  style="font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 4px; background-color: #064e3b; color: #34d399; border: 1px solid #059669;"
                >
                  Активен
                </span>

                <span
                  v-if="user.twoFactorEnabled"
                  style="font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background-color: #064e3b; color: #86efac;"
                >
                  🛡️ 2FA
                </span>
              </div>
            </td>

            <!-- SSO Column -->
            <td style="padding: 14px 18px; font-size: 12px; color: #cbd5e1;">
              <div v-if="user.ssoIdentifier" style="font-family: monospace; font-size: 11px; color: #38bdf8;">
                {{ user.ssoIdentifier }}
              </div>
              <span v-else style="color: #64748b;">—</span>
            </td>

            <!-- Ciphers Column -->
            <td style="padding: 14px 18px; color: #cbd5e1; font-weight: 600;">
              {{ user.ciphersCount }}
            </td>

            <!-- Attachments Column -->
            <td style="padding: 14px 18px; color: #9ca3af; font-size: 12px;">
              {{ user.attachmentsCount }}
              <span v-if="user.attachmentsCount > 0" style="color: #64748b;">
                ({{ user.attachmentsSize }})
              </span>
            </td>

            <!-- Organizations Column -->
            <td style="padding: 14px 18px;">
              <div v-if="user.organizations.length > 0" style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button
                  v-for="org in user.organizations"
                  :key="org.id"
                  @click="openRoleModal(user, org)"
                  :style="{
                    ...getRoleBadgeStyle(org.type),
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }"
                  :title="`Изменить роль в организации ${org.name}`"
                >
                  {{ org.name }} ({{ getRoleLabel(org.type) }})
                </button>
              </div>
              <span v-else style="color: #64748b; font-size: 12px;">—</span>
            </td>

            <!-- Dates Column -->
            <td style="padding: 14px 18px; font-size: 12px; color: #9ca3af;">
              <div>Создан: <span style="color: #cbd5e1;">{{ user.createdAt }}</span></div>
              <div v-if="user.lastActive" style="margin-top: 2px;">Активен: <span style="color: #cbd5e1;">{{ user.lastActive }}</span></div>
            </td>

            <!-- Actions Column -->
            <td style="padding: 14px 18px; text-align: right;">
              <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
                <button
                  @click="handleDeauth(user.id)"
                  title="Отозвать все активные сессии"
                  style="background: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;"
                >
                  Сброс сессий
                </button>
                <button
                  v-if="user.twoFactorEnabled"
                  @click="handleRemove2FA(user.id)"
                  title="Сбросить 2FA"
                  style="background: #1f2937; color: #fbbf24; border: 1px solid #374151; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;"
                >
                  Сброс 2FA
                </button>
                <button
                  @click="handleToggleUser(user)"
                  :title="user.userEnabled ? 'Отключить учётную запись' : 'Активировать учётную запись'"
                  style="background: #1f2937; color: #38bdf8; border: 1px solid #374151; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;"
                >
                  {{ user.userEnabled ? 'Отключить' : 'Включить' }}
                </button>
                <button
                  v-if="user.status === 1"
                  @click="handleResendInvite(user.id, user.email)"
                  title="Отправить приглашение повторно"
                  style="background: #1f2937; color: #34d399; border: 1px solid #374151; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;"
                >
                  Повторить инвайт
                </button>
                <button
                  v-if="user.ssoIdentifier"
                  @click="handleDeleteSSO(user.id, user.email)"
                  title="Удалить SSO связь"
                  style="background: #1f2937; color: #f59e0b; border: 1px solid #374151; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;"
                >
                  Удалить SSO
                </button>
                <button
                  @click="handleDelete(user.id, user.email)"
                  title="Безвозвратно удалить пользователя"
                  style="background: #450a0a; color: #f87171; border: 1px solid #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;"
                >
                  Удалить
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Role Edit Modal -->
    <div
      v-if="showRoleModal"
      style="position: fixed; inset: 0; background-color: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100;"
    >
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; width: 100%; max-width: 440px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <h3 style="font-size: 18px; font-weight: 700; color: #f9fafb; margin: 0 0 12px 0;">
          Роль в организации
        </h3>
        <p style="font-size: 13px; color: #9ca3af; margin: 0 0 16px 0;">
          Организация: <strong style="color: white;">{{ selectedOrg?.name }}</strong><br />
          Пользователь: <strong style="color: white;">{{ selectedUser?.email }}</strong>
        </p>

        <div style="display: grid; gap: 10px; margin-bottom: 20px;">
          <label
            v-for="role in [
              { type: 2, label: 'Пользователь (User)', desc: 'Стандартный доступ к назначенным коллекциям' },
              { type: 3, label: 'Менеджер (Manager)', desc: 'Управление коллекциями и записями' },
              { type: 1, label: 'Администратор (Admin)', desc: 'Управление пользователями и правами' },
              { type: 0, label: 'Владелец (Owner)', desc: 'Полный контроль над организацией' },
            ]"
            :key="role.type"
            :style="{
              padding: '10px 14px',
              borderRadius: '6px',
              border: selectedRole === role.type ? '1px solid #3b82f6' : '1px solid #374151',
              backgroundColor: selectedRole === role.type ? '#1e3a8a' : '#1f2937',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }"
          >
            <input type="radio" :value="role.type" v-model="selectedRole" style="margin-top: 3px;" />
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #f9fafb;">{{ role.label }}</div>
              <div style="font-size: 11px; color: #9ca3af;">{{ role.desc }}</div>
            </div>
          </label>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button
            type="button"
            @click="showRoleModal = false"
            style="background-color: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer;"
          >
            Отмена
          </button>
          <button
            type="button"
            @click="saveUserRole"
            :disabled="updatingRole"
            style="background-color: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
          >
            {{ updatingRole ? 'Сохранение...' : 'Сохранить роль' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
