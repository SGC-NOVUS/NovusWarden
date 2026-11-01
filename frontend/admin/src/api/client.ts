/**
 * NovusWarden Admin API Client
 * Connects directly to backend /admin endpoints with session cookie auth.
 */

export interface UserSummary {
  Id: string;
  Name: string;
  Email: string;
  EmailVerified: boolean;
  TwoFactorEnabled: boolean;
  OrganizationsCount: number;
  CiphersCount: number;
  Status: number;
  CreatedAt: string;
}

export interface OrgSummary {
  Id: string;
  Name: string;
  BillingEmail: string;
  UsersCount: number;
  CiphersCount: number;
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
    if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);
    return res.json();
  },

  async inviteUser(email: string): Promise<void> {
    const res = await fetch('/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(`Failed to invite user: ${res.statusText}`);
  },

  async deauthUser(uuid: string): Promise<void> {
    const res = await fetch(`/admin/users/${uuid}/deauth`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to deauth user');
  },

  async remove2FA(uuid: string): Promise<void> {
    const res = await fetch(`/admin/users/${uuid}/remove-2fa`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to remove 2FA');
  },

  async deleteUser(uuid: string): Promise<void> {
    const res = await fetch(`/admin/users/${uuid}/delete`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to delete user');
  },

  async getDiagnostics(): Promise<DiagnosticsConfig> {
    const res = await fetch('/admin/diagnostics/config');
    if (!res.ok) throw new Error('Failed to load diagnostics');
    return res.json();
  },

  async logout(): Promise<void> {
    await fetch('/admin/logout', { method: 'POST' });
    window.location.href = '/admin';
  },
};

