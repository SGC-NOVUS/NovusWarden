<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api, type DiagnosticsData, type UserSummary, type OrgSummary } from '../api/client.ts';

const loading = ref(true);
const diag = ref<DiagnosticsData | null>(null);
const users = ref<UserSummary[]>([]);
const orgs = ref<OrgSummary[]>([]);

const twoFaUsersCount = computed(() => users.value.filter((u) => u.twoFactorEnabled).length);
const twoFaCoveragePct = computed(() =>
  users.value.length > 0 ? Math.round((twoFaUsersCount.value / users.value.length) * 100) : 0
);
const totalCiphersCount = computed(() =>
  users.value.reduce((acc, u) => acc + (Number(u.ciphersCount) || 0), 0)
);

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
  <div class="dash-root">
    <!-- Hero Header -->
    <div class="dash-header">
      <div>
        <h1 class="dash-title">Сводка системы NovusWarden</h1>
        <p class="dash-subtitle">
          Телеметрия ядра SGC-NOVUS в реальном времени, состояние безопасности и быстрое управление.
        </p>
      </div>
      <div class="dash-status-pill">
        <span class="status-dot"></span>
        <span>Система активна • {{ diag?.db_type || 'PostgreSQL' }}</span>
      </div>
    </div>

    <!-- KPI Cards Grid -->
    <div class="kpi-grid">
      <div class="kpi-card accent-sky">
        <div class="kpi-top">
          <span class="kpi-label">Пользователи</span>
          <span class="kpi-badge badge-sky">2FA: {{ twoFaCoveragePct }}%</span>
        </div>
        <div class="kpi-value text-sky">{{ loading ? '…' : users.length }}</div>
        <div class="kpi-meta">
          С двухфакторной защитой: <strong>{{ twoFaUsersCount }}</strong> из {{ users.length }}
        </div>
        <div class="kpi-bar">
          <div class="kpi-bar-fill fill-sky" :style="{ width: `${twoFaCoveragePct}%` }"></div>
        </div>
      </div>

      <div class="kpi-card accent-purple">
        <div class="kpi-top">
          <span class="kpi-label">Организации</span>
          <span class="kpi-badge badge-purple">B2B / Teams</span>
        </div>
        <div class="kpi-value text-purple">{{ loading ? '…' : orgs.length }}</div>
        <div class="kpi-meta">Записей в хранилищах: <strong>{{ totalCiphersCount }}</strong></div>
      </div>

      <div class="kpi-card accent-emerald">
        <div class="kpi-top">
          <span class="kpi-label">База данных</span>
          <span class="kpi-badge badge-emerald">Healthy</span>
        </div>
        <div class="kpi-value-sm text-emerald">{{ diag?.db_type || 'PostgreSQL' }}</div>
        <div class="kpi-meta truncate" :title="diag?.db_version">
          {{ diag?.db_version || 'Защищённое подключение активно' }}
        </div>
      </div>

      <div class="kpi-card accent-amber">
        <div class="kpi-top">
          <span class="kpi-label">Сборка ядра</span>
          <span class="kpi-badge badge-amber">Argon2id</span>
        </div>
        <div class="kpi-value-sm text-amber">{{ diag?.current_release || 'v2026.11' }}</div>
        <div class="kpi-meta">{{ diag?.host_os || 'Linux' }} / {{ diag?.host_arch || 'x86_64' }}</div>
      </div>
    </div>

    <!-- Quick Action Cards -->
    <div class="actions-panel">
      <div class="actions-header">
        <h2 class="actions-title">Центр управления</h2>
        <span class="actions-hint">Мгновенный переход к ключевым модулям</span>
      </div>
      <div class="actions-grid">
        <router-link to="/users" class="action-tile">
          <div class="action-icon icon-sky">👤</div>
          <div class="action-body">
            <div class="action-name">Пользователи и доступ</div>
            <div class="action-desc">Приглашения, 2FA, лицензии, блокировки и аудит</div>
          </div>
          <span class="action-arrow">→</span>
        </router-link>

        <router-link to="/organizations" class="action-tile">
          <div class="action-icon icon-purple">🏢</div>
          <div class="action-body">
            <div class="action-name">Организации</div>
            <div class="action-desc">Корпоративные коллекции, роли и квоты</div>
          </div>
          <span class="action-arrow">→</span>
        </router-link>

        <router-link to="/settings" class="action-tile">
          <div class="action-icon icon-teal">⚙️</div>
          <div class="action-body">
            <div class="action-name">Конфигурация сервера</div>
            <div class="action-desc">100+ параметров: SMTP / Resend, SSO, 2FA, WebSockets</div>
          </div>
          <span class="action-arrow">→</span>
        </router-link>

        <router-link to="/subscriptions" class="action-tile">
          <div class="action-icon icon-amber">💎</div>
          <div class="action-body">
            <div class="action-name">Тарифы и подписки</div>
            <div class="action-desc">Управление планами B2C / B2B и квотами хранилища</div>
          </div>
          <span class="action-arrow">→</span>
        </router-link>

        <router-link to="/diagnostics" class="action-tile">
          <div class="action-icon icon-emerald">🩺</div>
          <div class="action-body">
            <div class="action-name">Диагностика и телеметрия</div>
            <div class="action-desc">Проверка DNS, времени, заголовков прокси и портов</div>
          </div>
          <span class="action-arrow">→</span>
        </router-link>

        <router-link to="/docs" class="action-tile">
          <div class="action-icon icon-indigo">📘</div>
          <div class="action-body">
            <div class="action-name">Документация и безопасность</div>
            <div class="action-desc">Архитектура Zero-Knowledge, инструкции и прозрачность</div>
          </div>
          <span class="action-arrow">→</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dash-root {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.dash-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dash-title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--admin-text-main);
  margin: 0 0 4px 0;
}

.dash-subtitle {
  font-size: 13px;
  color: var(--admin-text-secondary);
  margin: 0;
}

.dash-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #34d399;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

:global(html.light) .dash-status-pill {
  color: #047857;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
}

.kpi-card {
  position: relative;
  overflow: hidden;
  background: var(--admin-card-bg);
  border: 1px solid var(--admin-card-border);
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: var(--admin-card-shadow);
  transition: transform 0.18s ease, border-color 0.18s ease;
}

.kpi-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.kpi-card.accent-sky::before { background: linear-gradient(90deg, #0284c7, #38bdf8); }
.kpi-card.accent-purple::before { background: linear-gradient(90deg, #7c3aed, #c084fc); }
.kpi-card.accent-emerald::before { background: linear-gradient(90deg, #059669, #34d399); }
.kpi-card.accent-amber::before { background: linear-gradient(90deg, #d97706, #fbbf24); }

.kpi-card:hover {
  transform: translateY(-2px);
  border-color: rgba(56, 189, 248, 0.4);
}

.kpi-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kpi-label {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--admin-text-secondary);
}

.kpi-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
}

.badge-sky { background: rgba(56, 189, 248, 0.14); color: #38bdf8; }
.badge-purple { background: rgba(192, 132, 252, 0.14); color: #c084fc; }
.badge-emerald { background: rgba(52, 211, 153, 0.14); color: #34d399; }
.badge-amber { background: rgba(251, 191, 36, 0.14); color: #fbbf24; }

:global(html.light) .badge-sky { color: #0284c7; }
:global(html.light) .badge-purple { color: #7e22ce; }
:global(html.light) .badge-emerald { color: #047857; }
:global(html.light) .badge-amber { color: #b45309; }

.kpi-value {
  font-size: 32px;
  font-weight: 800;
  line-height: 1.15;
  margin-top: 10px;
}

.kpi-value-sm {
  font-size: 21px;
  font-weight: 800;
  line-height: 1.25;
  margin-top: 12px;
}

.text-sky { color: #38bdf8; }
.text-purple { color: #c084fc; }
.text-emerald { color: #34d399; }
.text-amber { color: #fbbf24; }

:global(html.light) .text-sky { color: #0284c7; }
:global(html.light) .text-purple { color: #7e22ce; }
:global(html.light) .text-emerald { color: #047857; }
:global(html.light) .text-amber { color: #b45309; }

.kpi-meta {
  font-size: 12px;
  color: var(--admin-text-muted);
  margin-top: 6px;
}

.kpi-bar {
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  margin-top: 10px;
  overflow: hidden;
}

.kpi-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}

.fill-sky {
  background: linear-gradient(90deg, #0284c7, #38bdf8);
}

.actions-panel {
  background: var(--admin-card-bg);
  border: 1px solid var(--admin-card-border);
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--admin-card-shadow);
}

.actions-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 16px;
}

.actions-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--admin-text-main);
  margin: 0;
}

.actions-hint {
  font-size: 12px;
  color: var(--admin-text-muted);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.action-tile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border-radius: 12px;
  background: var(--admin-input-bg);
  border: 1px solid var(--admin-card-border);
  text-decoration: none;
  color: var(--admin-text-main);
  transition: all 0.16s ease;
}

.action-tile:hover {
  border-color: var(--admin-accent, #38bdf8);
  transform: translateY(-1px);
}

.action-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
}

.icon-sky { background: rgba(56, 189, 248, 0.14); }
.icon-purple { background: rgba(192, 132, 252, 0.14); }
.icon-teal { background: rgba(45, 212, 191, 0.14); }
.icon-amber { background: rgba(251, 191, 36, 0.14); }
.icon-emerald { background: rgba(52, 211, 153, 0.14); }
.icon-indigo { background: rgba(129, 140, 248, 0.14); }

.action-body {
  flex: 1;
  min-width: 0;
}

.action-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--admin-text-main);
}

.action-desc {
  font-size: 11.5px;
  color: var(--admin-text-secondary);
  margin-top: 2px;
}

.action-arrow {
  font-size: 15px;
  color: var(--admin-text-muted);
  transition: transform 0.16s ease, color 0.16s ease;
}

.action-tile:hover .action-arrow {
  color: var(--admin-accent, #38bdf8);
  transform: translateX(3px);
}
</style>
