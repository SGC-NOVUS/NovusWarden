<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, type DiagnosticsData, type UserSummary, type OrgSummary } from '../api/client.ts';

const loading = ref(true);
const diag = ref<DiagnosticsData | null>(null);
const users = ref<UserSummary[]>([]);
const orgs = ref<OrgSummary[]>([]);

onMounted(async () => {
  try {
    const [diagRes, usersRes, orgsRes] = await Promise.all([
      api.getDiagnosticsData().catch(() => null),
      api.getUsers().catch(() => []),
      api.getOrganizations().catch(() => []),
    ]);
    diag.value = diagRes;
    users.value = usersRes;
    orgs.value = orgsRes;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <div style="margin-bottom: 24px;">
      <h1 style="font-size: 24px; font-weight: 700; color: var(--admin-text-main, #f9fafb); margin: 0 0 6px 0;">
        Сводка системы NovusWarden
      </h1>
      <p style="font-size: 14px; color: var(--admin-text-secondary, #9ca3af); margin: 0;">
        Телеметрия в реальном времени, статус ядра NovusWarden и мониторинг подключённых сервисов.
      </p>
    </div>

    <!-- Quick Stat Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px;">
      <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 12px; padding: 20px; box-shadow: var(--admin-card-shadow);">
        <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Пользователи</div>
        <div style="font-size: 32px; font-weight: 800; color: #38bdf8; margin-top: 8px;">
          {{ loading ? '...' : users.length }}
        </div>
        <div style="font-size: 12px; color: var(--admin-text-muted, #64748b); margin-top: 4px;">
          С двухфакторной защитой: {{ users.filter(u => u.twoFactorEnabled).length }}
        </div>
      </div>

      <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 12px; padding: 20px; box-shadow: var(--admin-card-shadow);">
        <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Организации</div>
        <div style="font-size: 32px; font-weight: 800; color: #c084fc; margin-top: 8px;">
          {{ loading ? '...' : orgs.length }}
        </div>
        <div style="font-size: 12px; color: var(--admin-text-muted, #64748b); margin-top: 4px;">
          Корпоративные пространства
        </div>
      </div>

      <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 12px; padding: 20px; box-shadow: var(--admin-card-shadow);">
        <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">База данных</div>
        <div style="font-size: 22px; font-weight: 700; color: #34d399; margin-top: 10px;">
          {{ diag?.db_type || 'PostgreSQL' }}
        </div>
        <div style="font-size: 12px; color: var(--admin-text-muted, #64748b); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          {{ diag?.db_version ? 'Подключена и активна' : 'Подключение активно' }}
        </div>
      </div>

      <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 12px; padding: 20px; box-shadow: var(--admin-card-shadow);">
        <div style="font-size: 12px; color: var(--admin-text-secondary, #9ca3af); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Версия сборки</div>
        <div style="font-size: 22px; font-weight: 700; color: #fbbf24; margin-top: 10px;">
          {{ diag?.current_release || 'v2026.11' }}
        </div>
        <div style="font-size: 12px; color: var(--admin-text-muted, #64748b); margin-top: 4px;">
          {{ diag?.host_os }} / {{ diag?.host_arch }}
        </div>
      </div>
    </div>

    <!-- Navigation & Quick Actions -->
    <div style="background-color: var(--admin-card-bg, #111827); border: 1px solid var(--admin-card-border, #1f2937); border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: var(--admin-card-shadow);">
      <h2 style="font-size: 16px; font-weight: 600; color: var(--admin-text-main, #f9fafb); margin: 0 0 16px 0;">
        Быстрые действия
      </h2>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <router-link to="/users" style="background: linear-gradient(135deg, #0284c7, #2563eb); color: white; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
          👤 Управление пользователями
        </router-link>
        <router-link to="/organizations" style="background-color: var(--admin-input-bg, #1f2937); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.4); padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">
          🏢 Организации
        </router-link>
        <router-link to="/subscriptions" style="background-color: var(--admin-input-bg, #1f2937); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4); padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">
          💎 Тарифы и подписки (B2C/B2B)
        </router-link>
        <router-link to="/settings" style="background-color: var(--admin-input-bg, #1f2937); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">
          ⚙️ Конфигурация сервера (100+ настроек)
        </router-link>
        <router-link to="/diagnostics" style="background-color: var(--admin-input-bg, #1f2937); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.4); padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">
          🩺 Диагностика и сетевые тесты
        </router-link>
      </div>
    </div>
  </div>
</template>
