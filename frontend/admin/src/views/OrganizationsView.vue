<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api, type OrgSummary } from '../api/client.ts';

const organizations = ref<OrgSummary[]>([]);
const search = ref('');
const loading = ref(true);
const message = ref<{ text: string; error?: boolean } | null>(null);

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
  if (
    !confirm(
      `ВНИМАНИЕ: Вы действительно хотите безвозвратно удалить организацию "${org.name}" (${org.billingEmail})?\n\nВсе общие коллекции, записи и членства в этой организации будут стёрты.`
    )
  )
    return;

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
        <h1 style="font-size: 24px; font-weight: 700; color: #f9fafb; margin: 0 0 6px 0;">
          Организации и корпоративные хранилища
        </h1>
        <p style="font-size: 14px; color: #9ca3af; margin: 0;">
          Управление общими пространствами, коллекциями, дисковыми квотами и корпоративными членами.
        </p>
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <router-link
          to="/subscriptions"
          style="background-color: #1f2937; color: #fbbf24; border: 1px solid #b45309; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 6px;"
        >
          💎 Тарифы B2B для организаций
        </router-link>
        <button
          @click="loadOrganizations"
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

    <!-- Filter input -->
    <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <input
        v-model="search"
        type="text"
        placeholder="Поиск по названию организации, billing email или UUID..."
        style="width: 100%; box-sizing: border-box; background-color: #0b0f19; border: 1px solid #374151; color: white; padding: 10px 14px; border-radius: 6px; font-size: 13px; outline: none;"
      />
    </div>

    <!-- Organizations Table -->
    <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 1px solid #1f2937; color: #9ca3af; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; background-color: #161e2e;">
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
            <td colspan="6" style="padding: 36px; text-align: center; color: #9ca3af;">
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
            style="border-bottom: 1px solid #1f2937; transition: background-color 0.15s ease;"
          >
            <!-- Org details -->
            <td style="padding: 14px 18px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 38px; height: 38px; border-radius: 8px; background-color: #312e81; color: #c7d2fe; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">
                  {{ org.name.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <div style="font-weight: 600; color: #f9fafb; font-size: 14px;">
                    {{ org.name }}
                  </div>
                  <div style="font-size: 12px; color: #9ca3af;">
                    {{ org.billingEmail || 'Email не указан' }}
                  </div>
                  <div style="font-family: monospace; font-size: 11px; color: #64748b; margin-top: 2px;">
                    {{ org.id }}
                  </div>
                </div>
              </div>
            </td>

            <!-- Members -->
            <td style="padding: 14px 18px; color: #cbd5e1; font-weight: 600;">
              <span style="background-color: #1f2937; padding: 4px 10px; border-radius: 4px;">
                👥 {{ org.user_count }}
              </span>
            </td>

            <!-- Ciphers -->
            <td style="padding: 14px 18px; color: #cbd5e1; font-weight: 600;">
              {{ org.cipher_count }}
            </td>

            <!-- Attachments -->
            <td style="padding: 14px 18px; color: #9ca3af; font-size: 12px;">
              {{ org.attachment_count }}
              <span v-if="org.attachment_count > 0" style="color: #64748b;">
                ({{ org.attachment_size }})
              </span>
            </td>

            <!-- Collections & groups -->
            <td style="padding: 14px 18px; font-size: 12px; color: #9ca3af;">
              <div>Коллекций: <strong style="color: #cbd5e1;">{{ org.collection_count }}</strong></div>
              <div style="margin-top: 2px;">Групп: <strong style="color: #cbd5e1;">{{ org.group_count }}</strong></div>
              <div style="margin-top: 2px;">Событий аудита: <strong style="color: #cbd5e1;">{{ org.event_count }}</strong></div>
            </td>

            <!-- Actions -->
            <td style="padding: 14px 18px; text-align: right;">
              <button
                @click="handleDeleteOrg(org)"
                style="background-color: #450a0a; color: #f87171; border: 1px solid #991b1b; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;"
              >
                Удалить организацию
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
