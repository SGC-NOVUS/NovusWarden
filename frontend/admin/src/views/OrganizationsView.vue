<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api, type OrgSummary, type OrgDetail } from '../api/client.ts';
import { confirmDialog, notifyToast } from '@shared/dialogs.ts';

const organizations = ref<OrgSummary[]>([]);
const search = ref('');
const loading = ref(true);
const message = ref<{ text: string; error?: boolean } | null>(null);

// Organization Details Modal
const showOrgModal = ref(false);
const orgLoading = ref(false);
const orgDetail = ref<OrgDetail | null>(null);

async function openOrgDetails(org: OrgSummary) {
  showOrgModal.value = true;
  orgLoading.value = true;
  orgDetail.value = null;
  try {
    orgDetail.value = await api.getOrganization(org.id);
  } catch (err: any) {
    message.value = { text: err.message || 'Ошибка загрузки деталей организации', error: true };
    showOrgModal.value = false;
  } finally {
    orgLoading.value = false;
  }
}

function roleLabel(type: number) {
  switch (type) {
    case 0: return 'Owner';
    case 1: return 'Admin';
    case 3: return 'Custom';
    case 4: return 'Manager';
    default: return 'User';
  }
}

function memberStatusLabel(status: number) {
  switch (status) {
    case 2: return 'Подтверждён';
    case 1: return 'Принят';
    case 0: return 'Приглашён';
    default: return 'Отозван';
  }
}

async function loadOrganizations() {
  loading.value = true;
  message.value = null;
  try {
    organizations.value = await api.getOrganizations();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  } finally {
    loading.value = false;
  }
}

const filteredOrgs = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return organizations.value;
  return organizations.value.filter(
    o => o.name.toLowerCase().includes(q) || o.billingEmail.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)
  );
});

async function handleDeleteOrg(org: OrgSummary) {
  const ok = await confirmDialog({
    title: 'Удалить организацию безвозвратно?',
    message: `Все общие коллекции, записи и членства организации «${org.name}» (${org.billingEmail}) будут стёрты.`,
    confirmLabel: 'Удалить организацию',
    danger: true,
    requireText: org.name,
    requirePlaceholder: org.name,
  });
  if (!ok) return;

  try {
    await api.deleteOrganization(org.id);
    message.value = { text: `Организация "${org.name}" успешно удалена.` };
    await loadOrganizations();
  } catch (err: any) {
    message.value = { text: err.message, error: true };
  }
}

onMounted(loadOrganizations);
</script>

<template>
  <div>
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
      <div>
        <h1 style="font-size: 24px; font-weight: 700; color: var(--admin-text-main, #f9fafb); margin: 0 0 6px 0;">
          Организации и корпоративные хранилища
        </h1>
        <p style="font-size: 14px; color: var(--admin-text-secondary, #9ca3af); margin: 0;">
          Управление общими пространствами, коллекциями, дисковыми квотами и корпоративными членами.
        </p>
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <router-link
          to="/subscriptions"
          style="background-color: var(--admin-badge-amber-bg); color: var(--admin-badge-amber-text); border: 1px solid var(--admin-badge-amber-border); padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 6px;"
        >
          💎 Тарифы B2B для организаций
        </router-link>
        <button
          @click="loadOrganizations"
          style="background-color: var(--admin-surface-bg, #1f2937); color: var(--admin-text-main, #e5e7eb); border: 1px solid var(--admin-input-border, #374151); padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
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
        borderRadius: '8px',
        marginBottom: '20px',
        fontSize: '13px',
        fontWeight: 500,
        backgroundColor: message.error ? 'var(--admin-badge-red-bg)' : 'var(--admin-badge-green-bg)',
        color: message.error ? 'var(--admin-badge-red-text)' : 'var(--admin-badge-green-text)',
        border: message.error ? '1px solid var(--admin-badge-red-border)' : '1px solid var(--admin-badge-green-border)',
      }"
    >
      {{ message.text }}
    </div>

    <!-- Filter input -->
    <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <input
        v-model="search"
        type="text"
        placeholder="Поиск по названию организации, billing email или UUID..."
        style="width: 100%; box-sizing: border-box; background-color: var(--admin-input-bg, #0b0f19); border: 1px solid var(--admin-input-border, #374151); color: var(--admin-text-main, #f9fafb); padding: 10px 14px; border-radius: 6px; font-size: 13px; outline: none;"
      />
    </div>

    <!-- Organizations Table -->
    <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 8px; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 1px solid var(--admin-card-border, #1f2937); color: var(--admin-text-secondary, #9ca3af); text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; background-color: var(--admin-table-head, #161e2e);">
            <th style="padding: 14px 18px;">Организация</th>
            <th style="padding: 14px 18px;">Участники</th>
            <th style="padding: 14px 18px;">Записи</th>
            <th style="padding: 14px 18px;">Вложения</th>
            <th style="padding: 14px 18px;">Коллекции & Группы</th>
            <th style="padding: 14px 18px; text-align: right;">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" style="padding: 36px; text-align: center; color: var(--admin-text-secondary, #9ca3af);">
              Загрузка списка организаций из базы NovusWarden...
            </td>
          </tr>
          <tr v-else-if="filteredOrgs.length === 0">
            <td colspan="6" style="padding: 36px; text-align: center; color: #6b7280;">
              Организаций не найдено.
            </td>
          </tr>
          <tr
            v-for="org in filteredOrgs"
            :key="org.id"
            style="border-bottom: 1px solid var(--admin-card-border, #1f2937); transition: background-color 0.15s ease;"
          >
            <!-- Org details -->
            <td style="padding: 14px 18px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 38px; height: 38px; border-radius: 8px; background-color: var(--admin-badge-purple-bg); color: var(--admin-badge-purple-text); border: 1px solid var(--admin-badge-purple-border); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">
                  {{ org.name.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <div style="font-weight: 600; color: var(--admin-text-main, #f9fafb); font-size: 14px;">
                    {{ org.name }}
                  </div>
                  <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af);">
                    {{ org.billingEmail || 'Email не указан' }}
                  </div>
                  <div style="font-family: monospace; font-size: 11px; color: #64748b; margin-top: 2px;">
                    {{ org.id }}
                  </div>
                </div>
              </div>
            </td>

            <!-- Members -->
            <td style="padding: 14px 18px; color: var(--admin-text-subtle, #cbd5e1); font-weight: 600;">
              <span style="background-color: var(--admin-surface-bg, #1f2937); padding: 4px 10px; border-radius: 4px;">
                👥 {{ org.user_count }}
              </span>
            </td>

            <!-- Ciphers -->
            <td style="padding: 14px 18px; color: var(--admin-text-subtle, #cbd5e1); font-weight: 600;">
              {{ org.cipher_count }}
            </td>

            <!-- Attachments -->
            <td style="padding: 14px 18px; color: var(--admin-text-secondary, #9ca3af); font-size: 12px;">
              {{ org.attachment_count }}
              <span v-if="org.attachment_count > 0" style="color: #64748b;">
                ({{ org.attachment_size }})
              </span>
            </td>

            <!-- Collections & groups -->
            <td style="padding: 14px 18px; font-size: 12px; color: var(--admin-text-secondary, #9ca3af);">
              <div>Коллекций: <strong style="color: var(--admin-text-subtle, #cbd5e1);">{{ org.collection_count }}</strong></div>
              <div style="margin-top: 2px;">Групп: <strong style="color: var(--admin-text-subtle, #cbd5e1);">{{ org.group_count }}</strong></div>
              <div style="margin-top: 2px;">Событий аудита: <strong style="color: var(--admin-text-subtle, #cbd5e1);">{{ org.event_count }}</strong></div>
            </td>

            <!-- Actions -->
            <td style="padding: 14px 18px; text-align: right;">
              <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button
                  @click="openOrgDetails(org)"
                  style="background-color: var(--admin-badge-blue-bg); color: var(--admin-badge-blue-text); border: 1px solid var(--admin-badge-blue-border); padding: 6px 12px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer;"
                >
                  🔍 Подробнее
                </button>
                <button
                  @click="handleDeleteOrg(org)"
                  style="background-color: var(--admin-badge-red-bg); color: var(--admin-badge-red-text); border: 1px solid var(--admin-badge-red-border); padding: 6px 12px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer;"
                >
                  Удалить организацию
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Organization Details Modal -->
    <div
      v-if="showOrgModal"
      style="position: fixed; inset: 0; background-color: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px;"
    >
      <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid #3b82f6; border-radius: 12px; width: 100%; max-width: 720px; max-height: 85vh; overflow-y: auto; padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-size: 18px; font-weight: 700; color: var(--admin-text-main, #f9fafb); margin: 0;">
            Организация: {{ orgDetail?.name || 'Загрузка...' }}
          </h3>
          <button
            type="button"
            @click="showOrgModal = false"
            style="background: var(--admin-surface-bg, #1f2937); color: var(--admin-text-subtle, #cbd5e1); border: 1px solid var(--admin-input-border, #374151); padding: 4px 10px; border-radius: 6px; cursor: pointer;"
          >
            ✕
          </button>
        </div>

        <div v-if="orgLoading" style="padding: 24px; text-align: center; color: var(--admin-text-secondary, #9ca3af);">
          Загрузка участников, коллекций и групп...
        </div>

        <div v-else-if="orgDetail" style="display: grid; gap: 18px; font-size: 13px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
            <div style="background: var(--admin-surface-alt, #0b0f19); padding: 10px 12px; border-radius: 6px; border: 1px solid var(--admin-card-border, #1f2937);">
              <div style="font-size: 11px; color: var(--admin-text-secondary, #9ca3af);">Billing Email</div>
              <div style="color: var(--admin-text-main, #f9fafb); font-weight: 600;">{{ orgDetail.billingEmail || '—' }}</div>
            </div>
            <div style="background: var(--admin-surface-alt, #0b0f19); padding: 10px 12px; border-radius: 6px; border: 1px solid var(--admin-card-border, #1f2937);">
              <div style="font-size: 11px; color: var(--admin-text-secondary, #9ca3af);">Записи / Вложения</div>
              <div style="color: var(--admin-text-subtle, #cbd5e1);">{{ orgDetail.cipher_count }} / {{ orgDetail.attachment_count }} ({{ orgDetail.attachment_size }})</div>
            </div>
            <div style="background: var(--admin-surface-alt, #0b0f19); padding: 10px 12px; border-radius: 6px; border: 1px solid var(--admin-card-border, #1f2937);">
              <div style="font-size: 11px; color: var(--admin-text-secondary, #9ca3af);">События аудита</div>
              <div style="color: var(--admin-text-subtle, #cbd5e1);">{{ orgDetail.event_count }}</div>
            </div>
          </div>

          <div>
            <h4 style="margin: 0 0 8px 0; font-size: 13px; color: var(--admin-blue);">Участники ({{ orgDetail.members.length }})</h4>
            <div v-if="orgDetail.members.length === 0" style="color: var(--admin-text-muted); font-size: 12px;">Нет участников</div>
            <div v-else style="border: 1px solid var(--admin-card-border, #1f2937); border-radius: 6px; overflow: hidden;">
              <div
                v-for="m in orgDetail.members"
                :key="m.id"
                style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--admin-card-border, #1f2937); background: var(--admin-surface-alt, #0b0f19);"
              >
                <div>
                  <span style="color: var(--admin-text-main, #f9fafb); font-weight: 600;">{{ m.email }}</span>
                  <span v-if="m.name" style="color: var(--admin-text-secondary, #9ca3af); margin-left: 6px;">({{ m.name }})</span>
                </div>
                <div style="display: flex; gap: 6px; font-size: 11px;">
                  <span style="background: var(--admin-badge-blue-bg); color: var(--admin-badge-blue-text); border: 1px solid var(--admin-badge-blue-border); padding: 2px 7px; border-radius: 4px;">{{ roleLabel(m.type) }}</span>
                  <span style="background: var(--admin-badge-neutral-bg); color: var(--admin-badge-neutral-text); padding: 2px 7px; border-radius: 4px;">{{ memberStatusLabel(m.status) }}</span>
                  <span v-if="m.accessAll" style="background: var(--admin-badge-green-bg); color: var(--admin-badge-green-text); padding: 2px 7px; border-radius: 4px;">Access All</span>
                </div>
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div>
              <h4 style="margin: 0 0 8px 0; font-size: 13px; color: var(--admin-blue);">Коллекции ({{ orgDetail.collections.length }})</h4>
              <div v-if="orgDetail.collections.length === 0" style="color: var(--admin-text-muted); font-size: 12px;">Нет коллекций</div>
              <ul v-else style="margin: 0; padding-left: 16px; color: var(--admin-text-subtle, #cbd5e1); font-size: 12px;">
                <li v-for="c in orgDetail.collections" :key="c.id">{{ c.id }}</li>
              </ul>
            </div>
            <div>
              <h4 style="margin: 0 0 8px 0; font-size: 13px; color: var(--admin-blue);">Группы ({{ orgDetail.groups.length }})</h4>
              <div v-if="orgDetail.groups.length === 0" style="color: var(--admin-text-muted); font-size: 12px;">Нет групп</div>
              <ul v-else style="margin: 0; padding-left: 16px; color: var(--admin-text-subtle, #cbd5e1); font-size: 12px;">
                <li v-for="g in orgDetail.groups" :key="g.id">{{ g.name }} <span v-if="g.accessAll" style="color: var(--admin-emerald);">(All)</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
