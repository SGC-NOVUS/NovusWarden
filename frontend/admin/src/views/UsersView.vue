<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api, type UserSummary } from '../api/client.ts';

const users = ref<UserSummary[]>([]);
const search = ref('');
const loading = ref(true);
const inviteEmail = ref('');
const inviting = ref(false);
const message = ref<{ text: string; error?: boolean } | null>(null);

async function loadUsers() {
  loading.value = true;
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
  if (!q) return users.value;
  return users.value.filter(u => u.Email.toLowerCase().includes(q) || u.Name?.toLowerCase().includes(q));
});

async function handleInvite() {
  if (!inviteEmail.value) return;
  inviting.value = true;
  try {
    await api.inviteUser(inviteEmail.value);
    message.value = { text: `Invitation dispatched to ${inviteEmail.value} successfully.` };
    inviteEmail.value = '';
    await loadUsers();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  } finally {
    inviting.value = false;
  }
}

async function handleDeauth(uuid: string) {
  if (!confirm('Revoke all active sessions for this user?')) return;
  try {
    await api.deauthUser(uuid);
    message.value = { text: 'Sessions revoked successfully.' };
    await loadUsers();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  }
}

async function handleRemove2FA(uuid: string) {
  if (!confirm('Remove two-factor authentication for this user?')) return;
  try {
    await api.remove2FA(uuid);
    message.value = { text: 'Two-factor authentication disabled.' };
    await loadUsers();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  }
}

async function handleDelete(uuid: string, email: string) {
  if (!confirm(`Are you sure you want to permanently delete user ${email}?`)) return;
  try {
    await api.deleteUser(uuid);
    message.value = { text: `User ${email} deleted.` };
    await loadUsers();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  }
}

onMounted(loadUsers);
</script>

<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
      <div>
        <h1 style="font-size: 24px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
          Vault Users
        </h1>
        <p style="font-size: 14px; color: #9ca3af; margin: 0;">
          Manage registered accounts, invite users, revoke sessions, and reset credentials.
        </p>
      </div>

      <!-- Invite User Form -->
      <form @submit.prevent="handleInvite" style="display: flex; gap: 8px;">
        <input
          v-model="inviteEmail"
          type="email"
          placeholder="colleague@domain.com"
          required
          style="background-color: #111827; border: 1px solid #374151; color: white; padding: 8px 14px; border-radius: 6px; font-size: 13px; outline: none; width: 220px;"
        />
        <button
          type="submit"
          :disabled="inviting"
          style="background-color: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
        >
          {{ inviting ? 'Inviting...' : 'Invite' }}
        </button>
      </form>
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

    <!-- Filter input -->
    <div style="margin-bottom: 16px;">
      <input
        v-model="search"
        type="text"
        placeholder="Search users by name or email..."
        style="width: 100%; box-sizing: border-box; background-color: #111827; border: 1px solid #1f2937; color: white; padding: 10px 16px; border-radius: 8px; font-size: 14px;"
      />
    </div>

    <!-- Users Table -->
    <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 1px solid #1f2937; color: #9ca3af; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
            <th style="padding: 14px 18px;">User</th>
            <th style="padding: 14px 18px;">2FA</th>
            <th style="padding: 14px 18px;">Vault Items</th>
            <th style="padding: 14px 18px;">Organizations</th>
            <th style="padding: 14px 18px;">Created</th>
            <th style="padding: 14px 18px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" style="padding: 32px; text-align: center; color: #9ca3af;">
              Loading user accounts from NovusWarden...
            </td>
          </tr>
          <tr v-else-if="filteredUsers.length === 0">
            <td colspan="6" style="padding: 32px; text-align: center; color: #6b7280;">
              No users found matching query.
            </td>
          </tr>
          <tr
            v-for="user in filteredUsers"
            :key="user.Id"
            style="border-bottom: 1px solid #1f2937; transition: background-color 0.15s ease;"
          >
            <td style="padding: 14px 18px;">
              <div style="font-weight: 600; color: #f9fafb;">{{ user.Name || '—' }}</div>
              <div style="font-size: 12px; color: #9ca3af;">{{ user.Email }}</div>
            </td>
            <td style="padding: 14px 18px;">
              <span
                :style="{
                  display: 'inline-block',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: user.TwoFactorEnabled ? '#064e3b' : '#1f2937',
                  color: user.TwoFactorEnabled ? '#34d399' : '#9ca3af',
                }"
              >
                {{ user.TwoFactorEnabled ? 'Enabled' : 'Disabled' }}
              </span>
            </td>
            <td style="padding: 14px 18px; color: #cbd5e1;">{{ user.CiphersCount }}</td>
            <td style="padding: 14px 18px; color: #cbd5e1;">{{ user.OrganizationsCount }}</td>
            <td style="padding: 14px 18px; color: #9ca3af; font-size: 12px;">{{ user.CreatedAt }}</td>
            <td style="padding: 14px 18px; text-align: right;">
              <div style="display: flex; gap: 6px; justify-content: flex-end;">
                <button
                  @click="handleDeauth(user.Id)"
                  title="Revoke active sessions"
                  style="background: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 5px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;"
                >
                  Deauth
                </button>
                <button
                  v-if="user.TwoFactorEnabled"
                  @click="handleRemove2FA(user.Id)"
                  title="Remove 2FA"
                  style="background: #1f2937; color: #fbbf24; border: 1px solid #374151; padding: 5px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;"
                >
                  Reset 2FA
                </button>
                <button
                  @click="handleDelete(user.Id, user.Email)"
                  title="Delete user"
                  style="background: #450a0a; color: #f87171; border: 1px solid #991b1b; padding: 5px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

