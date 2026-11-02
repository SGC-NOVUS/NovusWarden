/**
 * NovusWarden Admin API Client
 * Full typed client connecting to /admin REST endpoints with session cookie auth.
 */

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  status: number;
  userEnabled: boolean;
  organizations: Array<{ id: string; name: string; type: number }>;
  organizationsCount: number;
  ciphersCount: number;
  attachmentsCount: number;
  attachmentsSize: string;
  createdAt: string;
  lastActive: string;
  ssoIdentifier: string;
  subscriptionPlan?: string;
  licenseExpiresAt?: string | null;
}

export interface OrgSummary {
  id: string;
  name: string;
  billingEmail: string;
  user_count: number;
  cipher_count: number;
  collection_count: number;
  group_count: number;
  event_count: number;
  attachment_count: number;
  attachment_size: string;
}

export interface ConfigElement {
  name: string;
  value: any;
  default: any;
  type: 'text' | 'number' | 'checkbox' | 'password';
  editable: boolean;
  overridden: boolean;
  doc: {
    name: string;
    description: string;
    name_localized?: string;
    desc_localized?: string;
  };
}

export interface ConfigGroup {
  group: string;
  grouptoggle: string;
  groupdoc: string;
  groupdoc_localized?: string;
  elements: ConfigElement[];
}

export interface ConfigResponse {
  config: ConfigGroup[];
  can_backup: boolean;
}

export interface DiagnosticsData {
  dns_resolved: string;
  current_release: string;
  latest_release: string;
  latest_commit: string;
  web_vault_enabled: boolean;
  active_web_release: string;
  latest_web_release: string;
  web_vault_compare: string;
  running_within_container: boolean;
  container_base_image: string;
  has_http_access: boolean;
  ip_header_exists: boolean;
  ip_header_match: boolean;
  ip_header_name: string;
  ip_header_config: string;
  uses_proxy: boolean;
  enable_websocket: boolean;
  db_type: string;
  db_version: string;
  admin_url: string;
  overrides: string;
  config_file_status: string;
  template_overrides: string;
  invalid_env_vars: string;
  invalid_feature_flags: string[];
  host_arch: string;
  host_os: string;
  tz_env: string;
  server_time_local: string;
  server_time: string;
  ntp_time: string;
}

import { ref } from 'vue';

export const authState = ref({
  needsAuth: false,
  isAuthenticated: true,
  isLocked: false,
  failedAttempts: 0,
});

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', 'ru-RU, ru;q=0.9, en;q=0.1');
  }
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    authState.value.needsAuth = true;
    authState.value.isAuthenticated = false;
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/login';
    }
  } else if (res.ok) {
    authState.value.isAuthenticated = true;
    authState.value.needsAuth = false;
  }
  return res;
}

export const api = {
  // --- Auth ---
  async login(token: string): Promise<boolean> {
    const form = new URLSearchParams();
    form.append('token', token.trim());
    const res = await fetch('/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    if (res.ok || res.redirected || res.type === 'opaqueredirect' || res.status === 302 || res.status === 303) {
      authState.value.needsAuth = false;
      authState.value.isLocked = false;
      authState.value.failedAttempts = 0;
      return true;
    }

    const text = await res.text().catch(() => '');
    if (text.includes('locked') || text.includes('блокирован')) {
      authState.value.isLocked = true;
      throw new Error('Панель управления заблокирована из-за 2 неверных попыток. Проверьте почту администратора для разблокировки.');
    }

    authState.value.failedAttempts += 1;
    throw new Error('Неверный ключ доступа администратора. Осталась 1 попытка до автоматической блокировки!');
  },

  async logout(): Promise<void> {
    await fetch('/admin/logout', { method: 'POST' }).catch(() => {});
    authState.value.needsAuth = true;
  },

  // --- Users ---
  async getUsers(): Promise<UserSummary[]> {
    const res = await apiFetch('/admin/users');
    if (!res.ok) throw new Error(`Ошибка загрузки пользователей: ${res.statusText}`);
    const data = await res.json();
    return data.map((u: any) => ({
      id: u.id || u.Id || u.uuid || '',
      name: u.name || u.Name || '',
      email: u.email || u.Email || '',
      emailVerified: !!(u.emailVerified ?? u.EmailVerified),
      twoFactorEnabled: !!(u.twoFactorEnabled ?? u.TwoFactorEnabled ?? u.twofactor_enabled),
      status: u._status ?? (u.password_hash ? 2 : 1),
      userEnabled: !!(u.userEnabled ?? u.user_enabled ?? u.UserEnabled ?? true),
      organizations: Array.isArray(u.organizations) ? u.organizations.map((o: any) => ({
        id: o.id || o.Id || '',
        name: o.name || o.Name || '',
        type: o.type ?? o.Type ?? 2,
      })) : [],
      organizationsCount: u.organizationsCount ?? (Array.isArray(u.organizations) ? u.organizations.length : 0),
      ciphersCount: u.ciphersCount ?? u.cipher_count ?? 0,
      attachmentsCount: u.attachment_count ?? 0,
      attachmentsSize: u.attachment_size ?? '0 B',
      createdAt: u.createdAt ?? u.created_at ?? '',
      lastActive: u.lastActive ?? u.last_active ?? '',
      ssoIdentifier: u.sso_identifier ?? u.ssoIdentifier ?? '',
      subscriptionPlan: u.subscriptionPlan || 'Free',
      licenseExpiresAt: u.licenseExpiresAt || null,
    }));
  },

  async inviteUser(email: string, plan?: string): Promise<void> {
    const res = await apiFetch('/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, plan }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Ошибка приглашения: ${err}`);
    }
  },

  async setUserLicense(uuid: string, data: { plan: string; expiresDays?: number | null; notes?: string }): Promise<void> {
    const res = await apiFetch(`/admin/users/${uuid}/license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка назначения лицензии пользователю');
  },

  async getBillingConfig(): Promise<any> {
    const res = await apiFetch('/admin/subscriptions/plans');
    if (!res.ok) throw new Error('Ошибка загрузки конфигурации подписок');
    return res.json();
  },

  async saveBillingConfig(data: any): Promise<void> {
    const res = await apiFetch('/admin/subscriptions/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка сохранения конфигурации подписок');
  },

  async resendInvite(uuid: string): Promise<void> {
    const res = await apiFetch(`/admin/users/${uuid}/invite/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Ошибка повторной отправки приглашения');
  },

  async deauthUser(uuid: string): Promise<void> {
    const res = await apiFetch(`/admin/users/${uuid}/deauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Ошибка деавторизации сессий пользователя');
  },

  async remove2FA(uuid: string): Promise<void> {
    const res = await apiFetch(`/admin/users/${uuid}/remove-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Ошибка сброса двухфакторной аутентификации');
  },

  async disableUser(uuid: string): Promise<void> {
    const res = await apiFetch(`/admin/users/${uuid}/disable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Ошибка отключения пользователя');
  },

  async enableUser(uuid: string): Promise<void> {
    const res = await apiFetch(`/admin/users/${uuid}/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Ошибка включения пользователя');
  },

  async deleteUser(uuid: string): Promise<void> {
    const res = await apiFetch(`/admin/users/${uuid}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Ошибка удаления пользователя');
  },

  async deleteSSO(uuid: string): Promise<void> {
    const res = await apiFetch(`/admin/users/${uuid}/sso`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Ошибка удаления SSO связи');
  },

  async updateRevision(): Promise<void> {
    const res = await apiFetch('/admin/users/update_revision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Ошибка принудительной синхронизации ревизий');
  },

  async updateMembershipType(user_uuid: string, org_uuid: string, user_type: number): Promise<void> {
    const res = await apiFetch('/admin/users/org_type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_uuid, org_uuid, user_type }),
    });
    if (!res.ok) throw new Error('Ошибка изменения роли в организации');
  },

  // --- Organizations ---
  async getOrganizations(): Promise<OrgSummary[]> {
    const res = await apiFetch('/admin/organizations');
    if (!res.ok) throw new Error(`Ошибка загрузки организаций: ${res.statusText}`);
    const data = await res.json();
    return data.map((o: any) => ({
      id: o.id || o.uuid || '',
      name: o.name || '',
      billingEmail: o.billingEmail || o.billing_email || '',
      user_count: o.user_count ?? 0,
      cipher_count: o.cipher_count ?? 0,
      collection_count: o.collection_count ?? 0,
      group_count: o.group_count ?? 0,
      event_count: o.event_count ?? 0,
      attachment_count: o.attachment_count ?? 0,
      attachment_size: o.attachment_size ?? '0 B',
    }));
  },

  async deleteOrganization(id: string): Promise<void> {
    const res = await apiFetch(`/admin/organizations/${id}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Ошибка удаления организации');
  },

  // --- Configuration ---
  async getConfig(): Promise<ConfigResponse> {
    const res = await apiFetch('/admin/config');
    if (!res.ok) throw new Error(`Ошибка загрузки конфигурации: ${res.statusText}`);
    return res.json();
  },

  async saveConfig(data: Record<string, any>): Promise<void> {
    const res = await apiFetch('/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Ошибка сохранения параметров: ${err}`);
    }
  },

  async resetConfig(): Promise<void> {
    const res = await apiFetch('/admin/config/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Ошибка сброса конфигурации к значениям по умолчанию');
  },

  async backupDatabase(): Promise<string> {
    const res = await apiFetch('/admin/config/backup_db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Ошибка создания резервной копии базы данных');
    return res.text();
  },

  async testSmtp(email: string): Promise<void> {
    const res = await apiFetch('/admin/test/smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Ошибка теста SMTP: ${err}`);
    }
  },

  // --- Diagnostics ---
  async getDiagnosticsData(): Promise<DiagnosticsData> {
    const res = await apiFetch('/admin/diagnostics/data');
    if (!res.ok) throw new Error(`Ошибка сбора телеметрии: ${res.statusText}`);
    return res.json();
  },

  async getDiagnosticsConfig(): Promise<Record<string, any>> {
    const res = await apiFetch('/admin/diagnostics/config');
    if (!res.ok) throw new Error('Ошибка генерации отчёта поддержки');
    return res.json();
  },

  async testHttpCode(code: number): Promise<void> {
    await apiFetch(`/admin/diagnostics/http?code=${code}`);
  },
};
