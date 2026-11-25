// NovusWarden Vault API Client
// Standard Bitwarden REST & Identity Protocol
// Zero-Knowledge Enterprise Architecture

import { getAcceptLanguageHeader } from '@shared/i18n.ts';

export interface PreloginResponse {
  Kdf?: number;
  kdf?: number;
  KdfIterations?: number;
  kdfIterations?: number;
  KdfMemory?: number;
  kdfMemory?: number;
  KdfParallelism?: number;
  kdfParallelism?: number;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  Key?: string; // Encrypted User Symmetric Key
  PrivateKey?: string; // Encrypted RSA Private Key
  Kdf: number;
  KdfIterations: number;
  KdfMemory?: number;
  KdfParallelism?: number;
  ForcePasswordReset?: boolean;
  ResetMasterPassword?: boolean;
  TwoFactorToken?: string;
}

export interface SyncData {
  profile: {
    id: string;
    name?: string;
    email: string;
    emailVerified: boolean;
    premium: boolean;
    culture?: string;
    securityStamp?: string;
    organizations?: Array<{
      id: string;
      name: string;
      key?: string;
    }>;
  };
  folders: Array<{
    id: string;
    name: string; // EncType 2
    revisionDate: string;
  }>;
  collections: Array<{
    id: string;
    organizationId: string;
    name: string;
    readOnly?: boolean;
    hidePasswords?: boolean;
  }>;
  ciphers: Array<RawCipher>;
  sends: Array<RawSend>;
}

export class TwoFactorRequiredError extends Error {
  providers: string[];
  providers2: Record<string, any>;

  constructor(providers: string[], providers2: Record<string, any>) {
    super('Требуется двухфакторная аутентификация');
    this.name = 'TwoFactorRequiredError';
    this.providers = providers;
    this.providers2 = providers2;
  }
}

export interface RawCipherField {
  name?: string | null;
  value?: string | null;
  type: number; // 0=Text, 1=Hidden, 2=Boolean, 3=Linked
  linkedId?: number | null;
}

export interface RawPasswordHistory {
  lastUsedDate: string;
  password: string;
}

export interface RawAttachment {
  id: string;
  fileName: string;
  size: string | number;
  sizeName?: string;
  key?: string | null;
  url?: string;
}

export interface RawCipher {
  id: string;
  organizationId?: string | null;
  folderId?: string | null;
  encryptedFor?: string;
  key?: string | null;
  collectionIds?: string[];
  type: number; // 1=Login, 2=SecureNote, 3=Card, 4=Identity, 5=SSHKey
  name: string; // EncType 2
  notes?: string | null; // EncType 2
  favorite?: boolean;
  fields?: RawCipherField[] | null;
  passwordHistory?: RawPasswordHistory[] | null;
  attachments?: RawAttachment[] | null;
  login?: {
    username?: string | null;
    password?: string | null;
    totp?: string | null;
    passwordRevisionDate?: string | null;
    uris?: Array<{
      uri: string;
      match?: number | null;
    }>;
    fido2Credentials?: Array<Record<string, any>>;
  } | null;
  card?: {
    cardholderName?: string | null;
    brand?: string | null;
    number?: string | null;
    expMonth?: string | null;
    expYear?: string | null;
    code?: string | null;
  } | null;
  secureNote?: {
    type: number;
  } | null;
  identity?: {
    title?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    ssn?: string | null;
    username?: string | null;
    passportNumber?: string | null;
    licenseNumber?: string | null;
  } | null;
  sshKey?: {
    privateKey?: string | null;
    publicKey?: string | null;
    keyFingerprint?: string | null;
  } | null;
  bankAccount?: {
    bankName?: string | null;
    nameOnAccount?: string | null;
    accountType?: string | null;
    accountNumber?: string | null;
    routingNumber?: string | null;
    branchNumber?: string | null;
    pin?: string | null;
    swiftCode?: string | null;
    iban?: string | null;
    bankContactPhone?: string | null;
  } | null;
  driversLicense?: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    dateOfBirth?: string | null;
    licenseNumber?: string | null;
    issuingCountry?: string | null;
    issuingState?: string | null;
    issueDate?: string | null;
    issuingAuthority?: string | null;
    expirationDate?: string | null;
    licenseClass?: string | null;
  } | null;
  passport?: {
    surname?: string | null;
    givenName?: string | null;
    dateOfBirth?: string | null;
    sex?: string | null;
    birthPlace?: string | null;
    nationality?: string | null;
    passportNumber?: string | null;
    passportType?: string | null;
    issuingCountry?: string | null;
    issuingAuthority?: string | null;
    issueDate?: string | null;
    expirationDate?: string | null;
    nationalIdentificationNumber?: string | null;
  } | null;
  reprompt?: number;
  revisionDate?: string;
  deletedDate?: string | null;
  archivedDate?: string | null;
}

export interface RawSend {
  id: string;
  accessId?: string;
  key?: string;
  name: string;
  type: number; // 0=Text, 1=File
  notes?: string | null;
  text?: { text: string; hidden?: boolean };
  file?: { id: string; fileName: string; size: string | number; sizeName?: string };
  maxAccessCount?: number | null;
  accessCount?: number;
  expirationDate?: string | null;
  deletionDate?: string;
  password?: string | null;
  hasPassword?: boolean;
  hideEmail?: boolean | null;
  disabled?: boolean;
  revisionDate?: string;
}

export function getDeviceIdentifier(): string {
  const storageKey = 'novus_device_id';
  let id = localStorage.getItem(storageKey);
  if (!id) {
    id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(storageKey, id);
  }
  return id;
}

class ApiClient {
  private getPlatformHeaders(): Record<string, string> {
    return {
      'Device-Type': '9',
      'Bitwarden-Client-Name': 'web',
      'Bitwarden-Client-Version': '2026.11.0',
      'Device-Identifier': getDeviceIdentifier(),
    };
  }

  private getHeaders(token?: string, isGet = false): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.getPlatformHeaders(),
      'Accept': 'application/json',
      'Accept-Language': getAcceptLanguageHeader(),
      'Content-Type': 'application/json; charset=utf-8',
    };
    if (isGet) {
      headers['Cache-Control'] = 'no-store';
      headers['Pragma'] = 'no-cache';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async getServerConfig(): Promise<Record<string, any> | null> {
    try {
      const res = await fetch('/api/config', { headers: this.getHeaders(undefined, true) });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  /**
   * Prelogin: Fetch KDF parameters for an email
   */
  async prelogin(email: string): Promise<PreloginResponse> {
    const res = await fetch('/identity/accounts/prelogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      // Default to PBKDF2 600,000 if not found
      return {
        Kdf: 0,
        KdfIterations: 600000,
      };
    }

    return await res.json();
  }

  /**
   * Connect Token (Login)
   */
  async login(
    email: string,
    masterPasswordHash: string,
    twoFactorToken?: string,
    twoFactorProvider?: number,
    rememberTwoFactor?: boolean
  ): Promise<TokenResponse> {
    const params = new URLSearchParams();
    params.append('scope', 'api offline_access');
    params.append('client_id', 'web');
    params.append('grant_type', 'password');
    params.append('username', email);
    params.append('password', masterPasswordHash);
    params.append('deviceType', '9'); // 9 = Web Browser
    params.append('deviceIdentifier', getDeviceIdentifier());
    params.append('deviceName', 'NovusWarden Web');

    if (twoFactorToken && twoFactorProvider !== undefined) {
      params.append('twoFactorToken', twoFactorToken);
      params.append('twoFactorProvider', twoFactorProvider.toString());
      if (rememberTwoFactor) {
        params.append('twoFactorRemember', '1');
      }
    }

    const res = await fetch('/identity/connect/token', {
      method: 'POST',
      headers: {
        ...this.getPlatformHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      if (Array.isArray(data?.TwoFactorProviders) && data.TwoFactorProviders.length > 0) {
        throw new TwoFactorRequiredError(
          data.TwoFactorProviders.map((p: any) => String(p)),
          data.TwoFactorProviders2 || {}
        );
      }
      const errorMsg = data.ErrorModel?.Message || data.error_description || data.error || 'Ошибка входа в систему';
      throw new Error(errorMsg);
    }

    return data;
  }

  /**
   * Send Email 2FA code during login
   */
  async sendTwoFactorEmail(email: string, masterPasswordHash: string): Promise<void> {
    const res = await fetch('/api/two-factor/send-email-login', {
      method: 'POST',
      headers: {
        ...this.getPlatformHeaders(),
        'Device-Identifier': getDeviceIdentifier(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        masterPasswordHash,
        deviceIdentifier: getDeviceIdentifier(),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || err.message || 'Не удалось отправить код на email');
    }
  }

  async createAuthRequest(email: string, publicKey: string, accessCode: string): Promise<any> {
    const res = await fetch('/api/auth-requests', {
      method: 'POST',
      headers: {
        ...this.getPlatformHeaders(),
        'Device-Identifier': getDeviceIdentifier(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        publicKey,
        accessCode,
        deviceIdentifier: getDeviceIdentifier(),
        type: 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.ErrorModel?.Message || data.message || `Ошибка создания запроса входа (${res.status})`);
    }
    return data;
  }

  async pollAuthRequestResponse(id: string, code: string): Promise<any> {
    const res = await fetch(`/api/auth-requests/${id}/response?code=${encodeURIComponent(code)}`, {
      headers: {
        ...this.getPlatformHeaders(),
        'Device-Identifier': getDeviceIdentifier(),
      },
    });
    if (!res.ok) throw new Error(`Ошибка проверки статуса запроса (${res.status})`);
    return await res.json();
  }

  async loginWithAuthRequest(email: string, accessCode: string, authRequestId: string): Promise<TokenResponse> {
    const params = new URLSearchParams();
    params.append('scope', 'api offline_access');
    params.append('client_id', 'web');
    params.append('grant_type', 'password');
    params.append('username', email);
    params.append('password', accessCode);
    params.append('authRequest', authRequestId);
    params.append('deviceType', '9');
    params.append('deviceIdentifier', getDeviceIdentifier());
    params.append('deviceName', 'NovusWarden Web');

    const res = await fetch('/identity/connect/token', {
      method: 'POST',
      headers: {
        ...this.getPlatformHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.ErrorModel?.Message || data.error_description || 'Не удалось завершить беспарольный вход');
    }
    return data;
  }

  /**
   * Refresh OAuth access token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', 'web');

    const res = await fetch('/identity/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_description || data.error || 'Сессия истекла');
    }
    return data;
  }

  /**
   * Register new account (2-step Bitwarden/NovusWarden verification + finish flow)
   */
  async register(payload: {
    email: string;
    name?: string;
    masterPasswordHash: string;
    masterPasswordHint?: string;
    key: string; // Encrypted User Key
    keys: {
      publicKey: string;
      encryptedPrivateKey: string;
    };
    kdf: number;
    kdfIterations: number;
    kdfMemory?: number;
    kdfParallelism?: number;
    emailVerificationToken?: string;
    culture?: string;
  }): Promise<{ needsEmailVerification: boolean }> {
    let verificationToken = payload.emailVerificationToken;
    const acceptLanguage = getAcceptLanguageHeader();

    if (!verificationToken) {
      const verifyRes = await fetch('/identity/accounts/register/send-verification-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Language': acceptLanguage,
        },
        body: JSON.stringify({
          email: payload.email,
          name: payload.name,
          culture: payload.culture,
        }),
      });

      if (verifyRes.status === 204) {
        return { needsEmailVerification: true };
      }

      if (!verifyRes.ok) {
        let msg = 'Регистрация недоступна или не разрешена для данного email';
        try {
          const err = await verifyRes.json();
          msg = err.ErrorModel?.Message || err.message || msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      verificationToken = await verifyRes.json();
    }

    const res = await fetch('/identity/accounts/register/finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': acceptLanguage,
      },
      body: JSON.stringify({
        email: payload.email,
        masterPasswordHash: payload.masterPasswordHash,
        masterPasswordHint: payload.masterPasswordHint,
        key: payload.key,
        keys: payload.keys,
        kdf: payload.kdf,
        kdfIterations: payload.kdfIterations,
        kdfMemory: payload.kdfMemory,
        kdfParallelism: payload.kdfParallelism,
        emailVerificationToken: verificationToken,
        culture: payload.culture,
      }),
    });

    if (!res.ok) {
      let msg = 'Не удалось завершить регистрацию аккаунта';
      try {
        const err = await res.json();
        msg = err.ErrorModel?.Message || err.message || msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    return { needsEmailVerification: false };
  }

  /**
   * Fetch complete sync data
   */
  async sync(token: string): Promise<SyncData> {
    const res = await fetch('/api/sync', {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      const err: any = new Error(`Ошибка синхронизации хранилища (${res.status})`);
      err.status = res.status;
      throw err;
    }

    return await res.json();
  }

  /**
   * Create new cipher
   */
  async createCipher(token: string, cipher: Partial<RawCipher>): Promise<RawCipher> {
    const res = await fetch('/api/ciphers', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(cipher),
    });

    if (!res.ok) {
      throw new Error(`Не удалось сохранить запись (${res.status})`);
    }

    return await res.json();
  }

  /**
   * Update existing cipher
   */
  async updateCipher(token: string, id: string, cipher: Partial<RawCipher>): Promise<RawCipher> {
    const res = await fetch(`/api/ciphers/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(cipher),
    });

    if (!res.ok) {
      throw new Error(`Не удалось обновить запись (${res.status})`);
    }

    return await res.json();
  }

  /**
   * Soft delete cipher (move to trash)
   */
  async deleteCipher(token: string, id: string): Promise<void> {
    const res = await fetch(`/api/ciphers/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(`Не удалось переместить в корзину (${res.status})`);
    }
  }

  /**
   * Permanently delete cipher
   */
  async permanentDeleteCipher(token: string, id: string): Promise<void> {
    const res = await fetch(`/api/ciphers/${id}/permanent`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(`Не удалось окончательно удалить запись (${res.status})`);
    }
  }

  /**
   * Restore cipher from trash
   */
  async restoreCipher(token: string, id: string): Promise<void> {
    const res = await fetch(`/api/ciphers/${id}/restore`, {
      method: 'PUT',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(`Не удалось восстановить запись (${res.status})`);
    }
  }

  async archiveCipher(token: string, id: string): Promise<void> {
    const res = await fetch(`/api/ciphers/${id}/archive`, {
      method: 'PUT',
      headers: this.getHeaders(token),
    });
    if (!res.ok) {
      throw new Error(`Не удалось архивировать запись (${res.status})`);
    }
  }

  async unarchiveCipher(token: string, id: string): Promise<void> {
    const res = await fetch(`/api/ciphers/${id}/unarchive`, {
      method: 'PUT',
      headers: this.getHeaders(token),
    });
    if (!res.ok) {
      throw new Error(`Не удалось разархивировать запись (${res.status})`);
    }
  }

  async shareCipher(
    token: string,
    id: string,
    cipher: Partial<RawCipher>,
    collectionIds: string[]
  ): Promise<RawCipher> {
    const res = await fetch(`/api/ciphers/${id}/share`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ cipher, collectionIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || `Не удалось перенести запись в организацию (${res.status})`);
    }
    return await res.json();
  }

  async updateCipherCollections(token: string, id: string, collectionIds: string[]): Promise<void> {
    const res = await fetch(`/api/ciphers/${id}/collections`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ collectionIds }),
    });
    if (!res.ok) {
      throw new Error(`Не удалось обновить коллекции записи (${res.status})`);
    }
  }

  /**
   * Toggle cipher favorite status via /partial endpoint
   */
  async toggleFavorite(token: string, id: string, folderId: string | null, favorite: boolean): Promise<void> {
    const res = await fetch(`/api/ciphers/${id}/partial`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        folderId: folderId || null,
        favorite,
      }),
    });

    if (!res.ok) {
      throw new Error(`Не удалось обновить избранное (${res.status})`);
    }
  }

  /**
   * Create folder
   */
  async createFolder(token: string, nameEnc: string): Promise<{ id: string; name: string }> {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ name: nameEnc }),
    });

    if (!res.ok) {
      throw new Error(`Не удалось создать папку (${res.status})`);
    }

    return await res.json();
  }

  /**
   * Update folder
   */
  async updateFolder(token: string, id: string, nameEnc: string): Promise<{ id: string; name: string }> {
    const res = await fetch(`/api/folders/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ name: nameEnc }),
    });

    if (!res.ok) {
      throw new Error(`Не удалось переименовать папку (${res.status})`);
    }

    return await res.json();
  }

  /**
   * Delete folder
   */
  async deleteFolder(token: string, id: string): Promise<void> {
    const res = await fetch(`/api/folders/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(`Не удалось удалить папку (${res.status})`);
    }
  }

  /**
   * Account & Security APIs
   */
  async getAccountProfile(token: string): Promise<any> {
    const res = await fetch('/api/accounts/profile', {
      headers: this.getHeaders(token),
    });
    if (!res.ok) {
      throw new Error(`Ошибка получения профиля (${res.status})`);
    }
    return await res.json();
  }

  async updateProfile(token: string, payload: { name?: string; masterPasswordHint?: string; culture?: string }): Promise<void> {
    const res = await fetch('/api/accounts/profile', {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Ошибка обновления профиля');
    }
  }

  async verifyMasterPassword(token: string, masterPasswordHash: string): Promise<boolean> {
    const res = await fetch('/api/accounts/verify-password', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ masterPasswordHash }),
    });
    return res.ok;
  }

  async deleteAccount(token: string, masterPasswordHash: string): Promise<void> {
    const res = await fetch('/api/accounts', {
      method: 'DELETE',
      headers: this.getHeaders(token),
      body: JSON.stringify({ masterPasswordHash }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || err.message || 'Не удалось удалить аккаунт');
    }
  }

  async bulkDeleteCiphers(token: string, ids: string[], permanent = false): Promise<void> {
    const url = permanent ? '/api/ciphers/delete' : '/api/ciphers';
    const method = permanent ? 'POST' : 'DELETE';
    const res = await fetch(url, {
      method,
      headers: this.getHeaders(token),
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Ошибка массового удаления (${res.status})`);
  }

  async bulkRestoreCiphers(token: string, ids: string[]): Promise<void> {
    const res = await fetch('/api/ciphers/restore', {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Ошибка массового восстановления (${res.status})`);
  }

  async bulkMoveCiphers(token: string, ids: string[], folderId: string | null): Promise<void> {
    const res = await fetch('/api/ciphers/move', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ ids, folderId: folderId || null }),
    });
    if (!res.ok) throw new Error(`Ошибка перемещения в папку (${res.status})`);
  }

  async uploadCipherAttachment(
    token: string,
    cipherId: string,
    encBlob: Blob,
    encFileName: string,
    encFileKey: string
  ): Promise<RawCipher> {
    const initRes = await fetch(`/api/ciphers/${cipherId}/attachment/v2`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        fileName: encFileName,
        fileSize: encBlob.size,
        key: encFileKey,
      }),
    });
    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || err.message || `Ошибка создания вложения (${initRes.status})`);
    }
    const meta = await initRes.json();
    const form = new FormData();
    form.append('data', encBlob, encFileName);
    const upRes = await fetch(`/api/ciphers/${cipherId}/attachment/${meta.attachmentId}`, {
      method: 'POST',
      headers: { ...this.getPlatformHeaders(), Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!upRes.ok) {
      throw new Error(`Ошибка загрузки файла вложения (${upRes.status})`);
    }
    return await upRes.json();
  }

  async getCipherAttachment(token: string, cipherId: string, attachmentId: string): Promise<RawAttachment> {
    const res = await fetch(`/api/ciphers/${cipherId}/attachment/${attachmentId}`, {
      headers: this.getHeaders(token, true),
    });
    if (!res.ok) throw new Error(`Не удалось получить ссылку на вложение (${res.status})`);
    return await res.json();
  }

  async deleteCipherAttachment(token: string, cipherId: string, attachmentId: string): Promise<void> {
    const res = await fetch(`/api/ciphers/${cipherId}/attachment/${attachmentId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Не удалось удалить вложение (${res.status})`);
  }

  async updateSend(token: string, id: string, payload: Record<string, any>): Promise<RawSend> {
    const res = await fetch(`/api/sends/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Ошибка обновления Send (${res.status})`);
    return await res.json();
  }

  async removeSendPassword(token: string, id: string): Promise<RawSend> {
    const res = await fetch(`/api/sends/${id}/remove-password`, {
      method: 'PUT',
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Ошибка снятия пароля Send (${res.status})`);
    return await res.json();
  }

  async getSendAccessToken(accessId: string, passwordHashB64?: string): Promise<string> {
    const params = new URLSearchParams();
    params.append('grant_type', 'send_access');
    params.append('client_id', 'web');
    params.append('send_id', accessId);
    if (passwordHashB64) {
      params.append('password_hash_b64', passwordHashB64);
    }
    const res = await fetch('/identity/connect/token', {
      method: 'POST',
      headers: {
        ...this.getPlatformHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(data?.error_description || data?.ErrorModel?.Message || data?.error || '');
      const err: any = new Error(msg || `Доступ запрещён (${res.status})`);
      err.code = data?.error || '';
      err.requiresPassword = msg.toLowerCase().includes('password') || res.status === 401;
      throw err;
    }
    return data.access_token;
  }

  async accessSend(sendAccessToken: string): Promise<RawSend> {
    const res = await fetch('/api/sends/access', {
      method: 'POST',
      headers: this.getHeaders(sendAccessToken),
    });
    if (!res.ok) throw new Error(`Send не найден или недоступен (${res.status})`);
    return await res.json();
  }

  async accessSendFileUrl(sendAccessToken: string, fileId: string): Promise<{ url: string }> {
    const res = await fetch(`/api/sends/access/file/${fileId}`, {
      method: 'POST',
      headers: this.getHeaders(sendAccessToken),
    });
    if (!res.ok) throw new Error(`Не удалось получить ссылку на файл (${res.status})`);
    return await res.json();
  }

  async getPendingAuthRequests(token: string): Promise<any[]> {
    const res = await fetch('/api/auth-requests/pending', {
      headers: this.getHeaders(token, true),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  async respondAuthRequest(
    token: string,
    id: string,
    payload: { deviceIdentifier: string; key: string; masterPasswordHash?: string; requestApproved: boolean }
  ): Promise<void> {
    const res = await fetch(`/api/auth-requests/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Не удалось обработать запрос входа (${res.status})`);
  }

  async changePassword(token: string, payload: {
    masterPasswordHash: string;
    newMasterPasswordHash: string;
    masterPasswordHint?: string;
    key: string;
  }): Promise<void> {
    const res = await fetch('/api/accounts/password', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error_description || 'Ошибка смены мастер-пароля');
    }
  }

  async changeKdf(token: string, payload: {
    authenticationData: {
      salt: string;
      kdf: {
        kdf: number;
        kdfIterations: number;
        kdfMemory?: number;
        kdfParallelism?: number;
      };
      masterPasswordAuthenticationHash: string;
    };
    unlockData: {
      salt: string;
      kdf: {
        kdf: number;
        kdfIterations: number;
        kdfMemory?: number;
        kdfParallelism?: number;
      };
      masterKeyWrappedUserKey: string;
    };
    masterPasswordHash: string;
  }): Promise<void> {
    const res = await fetch('/api/accounts/kdf', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || err.message || 'Ошибка изменения алгоритма KDF');
    }
  }

  async createSend(token: string, payload: Record<string, any>): Promise<RawSend> {
    const res = await fetch('/api/sends', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || err.message || `Ошибка создания Send (${res.status})`);
    }
    return await res.json();
  }

  async createFileSend(
    token: string,
    metadataPayload: Record<string, any>,
    encryptedFileBlob: Blob,
    encFileName: string
  ): Promise<RawSend> {
    const initRes = await fetch('/api/sends/file/v2', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(metadataPayload),
    });
    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || err.message || `Ошибка инициализации File Send (${initRes.status})`);
    }

    const uploadMeta = await initRes.json();
    const uploadUrl = String(uploadMeta?.url || '').startsWith('/api')
      ? uploadMeta.url
      : `/api${uploadMeta?.url || ''}`;

    const form = new FormData();
    form.append('data', encryptedFileBlob, encFileName);

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || err.message || `Ошибка загрузки файла Send (${uploadRes.status})`);
    }

    return uploadMeta.sendResponse as RawSend;
  }

  async deleteSend(token: string, id: string): Promise<void> {
    const res = await fetch(`/api/sends/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (!res.ok) {
      throw new Error(`Ошибка удаления Send (${res.status})`);
    }
  }

  async deauthorizeSessions(token: string, masterPasswordHash: string): Promise<void> {
    const res = await fetch('/api/accounts/security-stamp', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ masterPasswordHash }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Ошибка сброса активных сессий');
    }
  }

  async purgeVault(token: string, masterPasswordHash: string): Promise<void> {
    const res = await fetch('/api/ciphers/purge', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ masterPasswordHash }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Ошибка очистки хранилища');
    }
  }

  async importCiphers(token: string, data: any): Promise<void> {
    const res = await fetch('/api/ciphers/import', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Ошибка импорта данных');
    }
  }

  async getTwoFactor(token: string): Promise<any> {
    const res = await fetch('/api/two-factor', {
      headers: this.getHeaders(token),
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  }

  async getAuthenticator2fa(
    token: string,
    masterPasswordHash: string
  ): Promise<{ authenticator: { enabled: boolean; key: string }; userVerificationToken: string }> {
    const res = await fetch('/api/two-factor/get-authenticator', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ masterPasswordHash }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || err.message || 'Неверный мастер-пароль');
    }
    return await res.json();
  }

  async activateAuthenticator2fa(
    token: string,
    payload: { key: string; token: string; userVerificationToken: string }
  ): Promise<void> {
    const res = await fetch('/api/two-factor/authenticator', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || err.message || 'Неверный код TOTP');
    }
  }

  async disableAuthenticator2fa(
    token: string,
    payload: { key: string; userVerificationToken: string }
  ): Promise<void> {
    const res = await fetch('/api/two-factor/authenticator', {
      method: 'DELETE',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || err.message || 'Не удалось отключить 2FA');
    }
  }

  async getRecoveryCode(token: string, masterPasswordHash: string): Promise<{ code: string }> {
    const res = await fetch('/api/two-factor/get-recover', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ masterPasswordHash }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.ErrorModel?.Message || 'Неверный мастер-пароль');
    return data;
  }

  async getEmail2fa(
    token: string,
    masterPasswordHash: string
  ): Promise<{ email: { enabled: boolean; email: string | null }; userVerificationToken: string }> {
    const res = await fetch('/api/two-factor/get-email', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ masterPasswordHash }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.ErrorModel?.Message || 'Неверный мастер-пароль');
    return data;
  }

  async sendEmail2faSetup(token: string, email: string, userVerificationToken: string): Promise<void> {
    const res = await fetch('/api/two-factor/send-email', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ email, userVerificationToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || 'Ошибка отправки письма Email 2FA');
    }
  }

  async activateEmail2fa(
    token: string,
    email: string,
    codeToken: string,
    userVerificationToken: string
  ): Promise<void> {
    const res = await fetch('/api/two-factor/email', {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ email, token: codeToken, userVerificationToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || 'Неверный код подтверждения Email 2FA');
    }
  }

  async disableEmail2fa(token: string, email: string, userVerificationToken: string): Promise<void> {
    const res = await fetch('/api/two-factor/email', {
      method: 'DELETE',
      headers: this.getHeaders(token),
      body: JSON.stringify({ email, userVerificationToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || 'Не удалось отключить Email 2FA');
    }
  }

  async getWebAuthn2fa(token: string, masterPasswordHash: string): Promise<any> {
    const res = await fetch('/api/two-factor/get-webauthn', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ masterPasswordHash }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.ErrorModel?.Message || 'Неверный мастер-пароль');
    return data;
  }

  async requestEmailChangeToken(token: string, masterPasswordHash: string, newEmail: string): Promise<void> {
    const res = await fetch('/api/accounts/email-token', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ masterPasswordHash, newEmail }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || 'Не удалось отправить токен смены email');
    }
  }

  async confirmEmailChange(
    token: string,
    payload: {
      masterPasswordHash: string;
      newMasterPasswordHash: string;
      newEmail: string;
      token: string;
      key: string;
    }
  ): Promise<void> {
    const res = await fetch('/api/accounts/email', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || 'Ошибка смены адреса электронной почты');
    }
  }

  async getEmergencyTrusted(token: string): Promise<any[]> {
    const res = await fetch('/api/emergency-access/trusted', { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  async getEmergencyGranted(token: string): Promise<any[]> {
    const res = await fetch('/api/emergency-access/granted', { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  async inviteEmergencyContact(
    token: string,
    payload: { email: string; type: number; waitTimeDays: number }
  ): Promise<void> {
    const res = await fetch('/api/emergency-access/invite', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || 'Ошибка отправки приглашения доверенного контакта');
    }
  }

  async deleteEmergencyContact(token: string, id: string): Promise<void> {
    const res = await fetch(`/api/emergency-access/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || 'Ошибка удаления экстренного контакта');
    }
  }

  // --- Organizations Management ---
  async getUserPublicKey(token: string, userId: string): Promise<{ userId: string; publicKey: string }> {
    const res = await fetch(`/api/users/${userId}/public-key`, { headers: this.getHeaders(token) });
    if (!res.ok) throw new Error(`Не удалось получить публичный ключ пользователя (${res.status})`);
    return await res.json();
  }

  async createOrganization(
    token: string,
    payload: {
      name: string;
      billingEmail: string;
      collectionName: string;
      key: string;
      keys: { publicKey: string; encryptedPrivateKey: string };
      planType: number;
    }
  ): Promise<any> {
    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.ErrorModel?.Message || data.message || `Ошибка создания организации (${res.status})`);
    return data;
  }

  async getOrganization(token: string, orgId: string): Promise<any> {
    const res = await fetch(`/api/organizations/${orgId}`, { headers: this.getHeaders(token) });
    if (!res.ok) throw new Error(`Не удалось загрузить организацию (${res.status})`);
    return await res.json();
  }

  async updateOrganization(token: string, orgId: string, payload: { name: string; billingEmail: string }): Promise<any> {
    const res = await fetch(`/api/organizations/${orgId}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Не удалось обновить организацию (${res.status})`);
    return await res.json();
  }

  async deleteOrganization(token: string, orgId: string, masterPasswordHash: string): Promise<void> {
    const res = await fetch(`/api/organizations/${orgId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
      body: JSON.stringify({ masterPasswordHash }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || `Не удалось удалить организацию (${res.status})`);
    }
  }

  async leaveOrganization(token: string, orgId: string): Promise<void> {
    const res = await fetch(`/api/organizations/${orgId}/leave`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || `Не удалось покинуть организацию (${res.status})`);
    }
  }

  async getOrgUsers(token: string, orgId: string): Promise<any[]> {
    const res = await fetch(`/api/organizations/${orgId}/users`, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  async inviteOrgUser(
    token: string,
    orgId: string,
    payload: { emails: string[]; type: number; groups: string[]; collections?: any[]; permissions?: Record<string, boolean> }
  ): Promise<void> {
    const res = await fetch(`/api/organizations/${orgId}/users/invite`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || `Не удалось пригласить участника (${res.status})`);
    }
  }

  async confirmOrgUser(token: string, orgId: string, memberId: string, key: string): Promise<void> {
    const res = await fetch(`/api/organizations/${orgId}/users/${memberId}/confirm`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ key }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || `Не удалось подтвердить участника (${res.status})`);
    }
  }

  async editOrgUser(
    token: string,
    orgId: string,
    memberId: string,
    payload: { type: number; groups?: string[]; collections?: any[]; permissions?: Record<string, boolean> }
  ): Promise<void> {
    const res = await fetch(`/api/organizations/${orgId}/users/${memberId}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || `Не удалось обновить роль участника (${res.status})`);
    }
  }

  async revokeOrgUser(token: string, orgId: string, memberId: string): Promise<void> {
    const res = await fetch(`/api/organizations/${orgId}/users/${memberId}/revoke`, {
      method: 'PUT',
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Не удалось отозвать участника (${res.status})`);
  }

  async restoreOrgUser(token: string, orgId: string, memberId: string): Promise<void> {
    const res = await fetch(`/api/organizations/${orgId}/users/${memberId}/restore`, {
      method: 'PUT',
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Не удалось восстановить участника (${res.status})`);
  }

  async deleteOrgUser(token: string, orgId: string, memberId: string): Promise<void> {
    const res = await fetch(`/api/organizations/${orgId}/users/${memberId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Не удалось удалить участника (${res.status})`);
  }

  async getOrgCollectionsDetails(token: string, orgId: string): Promise<any[]> {
    const res = await fetch(`/api/organizations/${orgId}/collections/details`, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  async createOrgCollection(
    token: string,
    orgId: string,
    name: string,
    groups: any[] = [],
    users: any[] = []
  ): Promise<any> {
    const res = await fetch(`/api/organizations/${orgId}/collections`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ name, groups, users, externalId: null }),
    });
    if (!res.ok) throw new Error(`Не удалось создать коллекцию (${res.status})`);
    return await res.json();
  }

  async updateOrgCollection(
    token: string,
    orgId: string,
    colId: string,
    name: string,
    groups: any[] = [],
    users: any[] = []
  ): Promise<any> {
    const res = await fetch(`/api/organizations/${orgId}/collections/${colId}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ name, groups, users, externalId: null }),
    });
    if (!res.ok) throw new Error(`Не удалось обновить коллекцию (${res.status})`);
    return await res.json();
  }

  async deleteOrgCollection(token: string, orgId: string, colId: string): Promise<void> {
    const res = await fetch(`/api/organizations/${orgId}/collections/${colId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Не удалось удалить коллекцию (${res.status})`);
  }

  async getOrgGroupsDetails(token: string, orgId: string): Promise<any[]> {
    const res = await fetch(`/api/organizations/${orgId}/groups/details`, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  async createOrgGroup(
    token: string,
    orgId: string,
    payload: { name: string; accessAll: boolean; collections: any[]; users: string[]; externalId?: string | null }
  ): Promise<any> {
    const res = await fetch(`/api/organizations/${orgId}/groups`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Не удалось создать группу (${res.status})`);
    return await res.json();
  }

  async deleteOrgGroup(token: string, orgId: string, groupId: string): Promise<void> {
    const res = await fetch(`/api/organizations/${orgId}/groups/${groupId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Не удалось удалить группу (${res.status})`);
  }

  async getOrgPolicies(token: string, orgId: string): Promise<any[]> {
    const res = await fetch(`/api/organizations/${orgId}/policies`, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  async updateOrgPolicy(
    token: string,
    orgId: string,
    polType: number,
    enabled: boolean,
    data: Record<string, any> | null = null
  ): Promise<any> {
    const res = await fetch(`/api/organizations/${orgId}/policies/${polType}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ policy: { enabled, data } }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.ErrorModel?.Message || `Не удалось обновить политику (${res.status})`);
    }
    return await res.json();
  }

  async getOrgEvents(token: string, orgId: string): Promise<any[]> {
    const res = await fetch(`/api/organizations/${orgId}/events`, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  async exportOrgVault(token: string, orgId: string): Promise<any> {
    const res = await fetch(`/api/organizations/${orgId}/export`, { headers: this.getHeaders(token) });
    if (!res.ok) throw new Error(`Не удалось экспортировать данные организации (${res.status})`);
    return await res.json();
  }

  async getOrgDuo2fa(token: string, orgId: string, masterPasswordHash: string): Promise<any> {
    const res = await fetch(`/api/organizations/${orgId}/two-factor/get-duo`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ masterPasswordHash }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.ErrorModel?.Message || `Ошибка проверки Duo организации (${res.status})`);
    return data;
  }

  async saveOrgDuo2fa(
    token: string,
    orgId: string,
    payload: { host: string; clientId: string; clientSecret: string; userVerificationToken: string }
  ): Promise<any> {
    const res = await fetch(`/api/organizations/${orgId}/two-factor/duo`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.ErrorModel?.Message || `Ошибка сохранения Duo организации (${res.status})`);
    return data;
  }
}

export const api = new ApiClient();
