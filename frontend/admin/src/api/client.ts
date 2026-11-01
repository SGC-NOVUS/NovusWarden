/**
 * NovusWarden Admin API Client
 * Connects directly to backend /admin endpoints with session cookie auth.
 */

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  organizationsCount: number;
  ciphersCount: number;
  attachmentsCount: number;
  attachmentsSize: string;
  userEnabled: boolean;
  createdAt: string;
  lastActive: string;
  ssoIdentifier: string;
}

export interface OrgSummary {
  id: string;
  name: string;
  billingEmail: string;
  usersCount: number;
  ciphersCount: number;
}

export interface DiagnosticsConfig {
  version: string;
  server_time: string;
  db_type: string;
  overrides: Record<string, unknown>;
}

export const api = {
  async getUsers(): Promise<UserSummary[]> {
    const res = await fetch('/admin/users');
    if (!res.ok) throw new Error(`Ошибка загрузки пользователей: ${res.statusText}`);
    const data = await res.json();
    return data.map((u: any) => ({
      id: u.id || u.Id || u.uuid || '',
      name: u.name || u.Name || '',
      email: u.email || u.Email || '',
      emailVerified: !!(u.emailVerified ?? u.EmailVerified),
      twoFactorEnabled: !!(u.twoFactorEnabled ?? u.TwoFactorEnabled ?? u.twofactor_enabled),
      ciphersCount: u.ciphersCount ?? u.cipher_count ?? u.CiphersCount ?? 0,
      organizationsCount: u.organizationsCount ?? u.OrganizationsCount ?? (Array.isArray(u.organizations) ? u.organizations.length : 0),
      attachmentsCount: u.attachment_count ?? 0,
      attachmentsSize: u.attachment_size ?? '0 B',
      userEnabled: !!(u.userEnabled ?? u.user_enabled ?? u.UserEnabled ?? true),
      createdAt: u.createdAt ?? u.created_at ?? u.CreatedAt ?? '',
      lastActive: u.lastActive ?? u.last_active ?? u.LastActive ?? '',
      ssoIdentifier: u.sso_identifier ?? u.ssoIdentifier ?? '',
    }));
  },

  async inviteUser(email: string): Promise<void> {
    const res = await fetch('/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(`Ошибка приглашения пользователя: ${res.statusText}`);
  },

  async deauthUser(uuid: string): Promise<void> {
    const res = await fetch(`/admin/users/${uuid}/deauth`, { method: 'POST' });
    if (!res.ok) throw new Error('Ошибка деавторизации сессий пользователя');
  },

  async remove2FA(uuid: string): Promise<void> {
    const res = await fetch(`/admin/users/${uuid}/remove-2fa`, { method: 'POST' });
    if (!res.ok) throw new Error('Ошибка сброса двухфакторной аутентификации');
  },

  async deleteUser(uuid: string): Promise<void> {
    const res = await fetch(`/admin/users/${uuid}/delete`, { method: 'POST' });
    if (!res.ok) throw new Error('Ошибка удаления пользователя');
  },

  async getDiagnostics(): Promise<DiagnosticsConfig> {
    const res = await fetch('/admin/diagnostics/config');
    if (!res.ok) throw new Error('Ошибка загрузки диагностических параметров');
    return res.json();
  },

  async logout(): Promise<void> {
    await fetch('/admin/logout', { method: 'POST' });
    window.location.href = '/admin';
  },
};
