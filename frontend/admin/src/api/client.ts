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
  storageUsage?: string;
}

export interface BillingPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  storageGb: number;
  pamSeats: number;
  features: string[];
  badgeColor: string;
}

export interface BillingConfig {
  enabled: boolean;
  currency: string;
  stripePublishableKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  cryptoWallet: string;
  webhookUrl: string;
  plans: BillingPlan[];
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

export interface OrgDetail extends OrgSummary {
  members: Array<{
    id: string;
    userId: string;
    email: string;
    name: string;
    type: number;
    status: number;
    accessAll: boolean;
  }>;
  collections: Array<{ id: string; name: string; externalId?: string | null }>;
  groups: Array<{ id: string; name: string; accessAll: boolean }>;
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
  web_vault_compare: number | string;
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
import { getAcceptLanguageHeader } from '@shared/i18n.ts';

export function getBasePath(): string {
  if (typeof window === 'undefined') return '';
  const m = window.location.pathname.match(/^(.*?)\/admin(?:\/|$)/);
  return m ? m[1] : '';
}

export function adminUrl(path: string): string {
  return `${getBasePath()}${path}`;
}

export const authState = ref({
  needsAuth: true,
  isAuthenticated: false,
  checked: false,
  isLocked: false,
  failedAttempts: 0,
});

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', getAcceptLanguageHeader());
  }
  const res = await fetch(adminUrl(url), { ...init, headers });
  if (res.status === 401) {
    authState.value.needsAuth = true;
    authState.value.isAuthenticated = false;
    authState.value.checked = true;
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/login';
    }
  } else if (res.ok) {
    authState.value.isAuthenticated = true;
    authState.value.needsAuth = false;
    authState.value.checked = true;
  }
  return res;
}

export const api = {
  // --- Auth ---
  async checkSession(): Promise<boolean> {
    try {
      const res = await fetch(adminUrl('/admin/session'), {
        headers: { 'Accept-Language': getAcceptLanguageHeader() },
      });
      const data = await res.json().catch(() => ({}));
      authState.value.checked = true;
      authState.value.isLocked = !!data?.locked;
      if (res.ok && data?.authenticated) {
        authState.value.isAuthenticated = true;
        authState.value.needsAuth = false;
        return true;
      }
      authState.value.isAuthenticated = false;
      authState.value.needsAuth = true;
      return false;
    } catch {
      authState.value.checked = true;
      authState.value.isAuthenticated = false;
      authState.value.needsAuth = true;
      return false;
    }
  },

  async login(token: string): Promise<boolean> {
    const form = new URLSearchParams();
    form.append('token', token.trim());
    const res = await fetch(adminUrl('/admin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    if (res.ok || res.redirected || res.type === 'opaqueredirect' || res.status === 302 || res.status === 303) {
      authState.value.needsAuth = false;
      authState.value.isAuthenticated = true;
      authState.value.checked = true;
      authState.value.isLocked = false;
      authState.value.failedAttempts = 0;
      return true;
    }

    const text = await res.text().catch(() => '');
    if (res.status === 429 || text.includes('locked') || text.includes('блокирован')) {
      authState.value.isLocked = true;
      throw new Error('Панель управления заблокирована из-за превышения лимита попыток входа. Проверьте почту администратора.');
    }

    authState.value.failedAttempts += 1;
    throw new Error('Неверный ключ доступа администратора. Повторная ошибка приведёт к блокировке!');
  },

  async logout(): Promise<void> {
    await fetch(adminUrl('/admin/logout'), { method: 'GET' }).catch(() => {});
    authState.value.needsAuth = true;
    authState.value.isAuthenticated = false;
    authState.value.checked = true;
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
      storageUsage: u.storageUsage ?? u.attachment_size ?? '0 B',
    }));
  },

  async getUser(uuid: string): Promise<any> {
    const res = await apiFetch(`/admin/users/${uuid}`);
    if (!res.ok) throw new Error(`Ошибка загрузки профиля пользователя: ${res.statusText}`);
    return res.json();
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

  async getOrganization(id: string): Promise<OrgDetail> {
    const res = await apiFetch(`/admin/organizations/${id}`);
    if (!res.ok) throw new Error(`Ошибка загрузки организации: ${res.statusText}`);
    return res.json();
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

  async testTelegram(chatId?: string): Promise<{ ok: boolean; botUsername: string; chatId: string }> {
    const res = await apiFetch('/admin/test/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: chatId || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.ErrorModel?.Message || data?.message || res.statusText;
      throw new Error(`Ошибка теста Telegram: ${msg}`);
    }
    return data;
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

  async exportUsers(): Promise<Blob> {
    const res = await apiFetch('/admin/users/export');
    if (!res.ok) throw new Error('Ошибка экспорта пользователей');
    return res.blob();
  },

  async testHttpCode(code: number): Promise<number> {
    const res = await fetch(adminUrl(`/admin/diagnostics/http?code=${code}`));
    return res.status;
  },
};
