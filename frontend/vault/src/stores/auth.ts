// NovusWarden Auth & Key Management Store
// Zero-Knowledge Architecture - Enterprise Standard

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, TokenResponse, TwoFactorRequiredError } from '../api/client.ts';
import { deriveMasterKey, hashMasterPassword, KdfConfig } from '../crypto/kdf.ts';
import { stretchMasterKey, decryptToBytes, encrypt } from '../crypto/symmetric.ts';
import { generateKeyPair, decryptPrivateKey, decryptWithPrivateKey } from '../crypto/asymmetric.ts';
import { getRandomBytes, stringToBytes, timingSafeEqual } from '../crypto/utils.ts';
import { currentLocale, syncLocaleFromAccountCulture } from '@shared/i18n.ts';

export interface UserProfile {
  id: string;
  name?: string;
  email: string;
  emailVerified: boolean;
  premium: boolean;
  culture?: string;
}

export interface PendingTwoFactor {
  email: string;
  masterPasswordHash: string;
  providers: string[];
  providers2: Record<string, any>;
  telegram2faAvailable?: boolean;
}

function twoFactorRememberStorageKey(email: string): string {
  return `novus_2fa_remember_${email.trim().toLowerCase()}`;
}

function extractSubFromJwt(jwt: string): string {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return '';
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const json = JSON.parse(atob(padded));
    return typeof json?.sub === 'string' ? json.sub : '';
  } catch {
    return '';
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(sessionStorage.getItem('novus_token') || null);
  const refreshToken = ref<string | null>(localStorage.getItem('novus_refresh_token') || null);
  const savedEmail = ref<string>(localStorage.getItem('novus_email') || '');
  const profile = ref<UserProfile | null>(null);
  const pendingTwoFactor = ref<PendingTwoFactor | null>(null);

  // In-memory zero-knowledge cryptographic keys (NEVER saved to disk/localStorage)
  const masterKey = ref<Uint8Array | null>(null);
  const userKey = ref<Uint8Array | null>(null);
  const privateKey = ref<CryptoKey | null>(null);
  const organizations = ref<Array<{ id: string; name: string; key?: string }>>([]);
  const orgKeys = ref<Record<string, Uint8Array>>({});
  const forcePasswordReset = ref(false);
  const publicKeyStr = ref<string>(sessionStorage.getItem('novus_pubkey') || '');
  const hasPin = ref(!!sessionStorage.getItem('novus_pin_key'));
  const vaultTimeoutMinutes = ref<number>(Number(localStorage.getItem('novus_timeout_minutes') || '15'));

  let idleTimer: any = null;
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (!userKey.value || vaultTimeoutMinutes.value <= 0) return;
    idleTimer = setTimeout(() => {
      lock();
    }, vaultTimeoutMinutes.value * 60 * 1000);
  }

  function setVaultTimeout(minutes: number) {
    vaultTimeoutMinutes.value = minutes;
    localStorage.setItem('novus_timeout_minutes', String(minutes));
    resetIdleTimer();
  }

  async function derivePinKey(pin: string, email: string): Promise<Uint8Array> {
    return await deriveMasterKey(pin, `pin:${email.toLowerCase()}`, { kdfType: 0, iterations: 100000 });
  }

  async function setPin(pin: string) {
    if (!userKey.value || !savedEmail.value) throw new Error('Хранилище заблокировано');
    if (pin.length < 4) throw new Error('PIN должен содержать минимум 4 символа');
    const pinKey = await derivePinKey(pin, savedEmail.value);
    const wrapped = (await encrypt(userKey.value, await stretchMasterKey(pinKey))).toString();
    sessionStorage.setItem('novus_pin_key', wrapped);
    hasPin.value = true;
  }

  function clearPin() {
    sessionStorage.removeItem('novus_pin_key');
    hasPin.value = false;
  }

  async function unlockWithPin(pin: string) {
    const wrapped = sessionStorage.getItem('novus_pin_key');
    if (!wrapped || !savedEmail.value || !token.value) {
      throw new Error('PIN-разблокировка недоступна, введите мастер-пароль');
    }
    const pinKey = await derivePinKey(pin, savedEmail.value);
    const unwrapped = await decryptToBytes(wrapped, await stretchMasterKey(pinKey));
    if (unwrapped.byteLength !== 64) {
      throw new Error('Неверный PIN');
    }
    userKey.value = unwrapped;
    resetIdleTimer();
    return true;
  }

  async function verifyMasterPassword(password: string): Promise<boolean> {
    if (!savedEmail.value) return false;
    const pre = await api.prelogin(savedEmail.value);
    const cfg: KdfConfig = {
      kdfType: pre.Kdf ?? pre.kdf ?? 0,
      iterations: pre.KdfIterations ?? pre.kdfIterations ?? 600000,
      memory: pre.KdfMemory ?? pre.kdfMemory ?? undefined,
      parallelism: pre.KdfParallelism ?? pre.kdfParallelism ?? undefined,
    };
    const mk = await deriveMasterKey(password, savedEmail.value, cfg);
    if (masterKey.value && timingSafeEqual(mk, masterKey.value)) {
      return true;
    }
    if (!token.value) return false;
    const hash = await hashMasterPassword(mk, password);
    return await api.verifyMasterPassword(token.value, hash);
  }

  async function getFingerprintPhrase(): Promise<string> {
    const seed = `${savedEmail.value}:${publicKeyStr.value || profile.value?.id || 'novus'}`;
    const digest = new Uint8Array(
      await window.crypto.subtle.digest('SHA-256', stringToBytes(seed) as BufferSource)
    );
    const words = [
      'aurora', 'beacon', 'cipher', 'delta', 'ember', 'falcon', 'granite', 'harbor',
      'indigo', 'jupiter', 'krypton', 'lantern', 'matrix', 'nebula', 'obsidian', 'prism',
      'quantum', 'reactor', 'sentinel', 'titanium', 'umbra', 'vector', 'warden', 'xenon',
      'yonder', 'zenith', 'amber', 'cobalt', 'frost', 'matrix', 'nova', 'orbit',
    ];
    return Array.from({ length: 5 }, (_, i) => words[digest[i] % words.length]).join('-');
  }

  const isAuthenticated = computed(() => !!token.value && !!userKey.value);
  const isLocked = computed(() => !!token.value && !userKey.value);

  /**
   * Complete Zero-Knowledge Login Flow (with 2FA support)
   */
  async function login(
    email: string,
    masterPassword: string,
    rememberEmail = true,
    twoFactor?: { token: string; provider: number; remember?: boolean }
  ) {
    const normEmail = email.trim().toLowerCase();
    if (rememberEmail) {
      localStorage.setItem('novus_email', normEmail);
      savedEmail.value = normEmail;
    } else {
      localStorage.removeItem('novus_email');
      savedEmail.value = '';
    }

    // 1. Prelogin: Obtain KDF params
    const prelogin = await api.prelogin(normEmail);
    const kdfConfig: KdfConfig = {
      kdfType: prelogin.Kdf ?? prelogin.kdf ?? 0,
      iterations: prelogin.KdfIterations ?? prelogin.kdfIterations ?? 600000,
      memory: prelogin.KdfMemory ?? prelogin.kdfMemory ?? undefined,
      parallelism: prelogin.KdfParallelism ?? prelogin.kdfParallelism ?? undefined,
    };

    // 2. Derive 32-byte Master Key
    const derivedMasterKey = await deriveMasterKey(masterPassword, normEmail, kdfConfig);

    // 3. Compute Master Password Hash
    const passwordHash = await hashMasterPassword(derivedMasterKey, masterPassword);

    // 4. Connect Token (auto-send saved 30-day Remember 2FA token if available)
    const rememberStorageKey = twoFactorRememberStorageKey(normEmail);
    const savedRememberToken = !twoFactor ? localStorage.getItem(rememberStorageKey) : null;
    const effectiveToken = twoFactor?.token ?? savedRememberToken ?? undefined;
    const effectiveProvider = twoFactor ? twoFactor.provider : savedRememberToken ? 5 : undefined;
    const effectiveRemember = twoFactor ? !!twoFactor.remember : false;

    let res: TokenResponse;
    try {
      res = await api.login(
        normEmail,
        passwordHash,
        effectiveToken,
        effectiveProvider,
        effectiveRemember
      );
      pendingTwoFactor.value = null;
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        // Clear stale/expired remembered device token so user is prompted cleanly
        if (savedRememberToken && !twoFactor) {
          localStorage.removeItem(rememberStorageKey);
        }
        pendingTwoFactor.value = {
          email: normEmail,
          masterPasswordHash: passwordHash,
          providers: err.providers,
          providers2: err.providers2,
          telegram2faAvailable: err.telegram2faAvailable,
        };
      }
      throw err;
    }

    // Persist 30-day 2FA remember token returned by server for future logins on this device
    const returnedTwoFactorToken = res.TwoFactorToken || (res as any).twoFactorToken;
    if (typeof returnedTwoFactorToken === 'string' && returnedTwoFactorToken.trim().length > 0) {
      localStorage.setItem(rememberStorageKey, returnedTwoFactorToken.trim());
    }

    // 5. Unpack and decrypt Protected User Key
    if (!res.Key) {
      throw new Error('Ключ шифрования пользователя не получен от сервера');
    }

    const stretched = await stretchMasterKey(derivedMasterKey);
    const unwrappedUserKey = await decryptToBytes(res.Key, stretched);

    if (unwrappedUserKey.byteLength !== 64) {
      throw new Error(`Недопустимый размер пользовательского ключа: ${unwrappedUserKey.byteLength} байт`);
    }

    // 6. Decrypt RSA Private Key if present
    let rsaKey: CryptoKey | null = null;
    if (res.PrivateKey) {
      try {
        rsaKey = await decryptPrivateKey(res.PrivateKey, unwrappedUserKey);
      } catch (err) {
        console.warn('Не удалось расшифровать асимметричный ключ пользователя:', err);
      }
    }

    // 7. Store session in memory
    token.value = res.access_token;
    sessionStorage.setItem('novus_token', res.access_token);
    if (res.refresh_token) {
      refreshToken.value = res.refresh_token;
      localStorage.setItem('novus_refresh_token', res.refresh_token);
    }

    masterKey.value = derivedMasterKey;
    userKey.value = unwrappedUserKey;
    privateKey.value = rsaKey;
    forcePasswordReset.value = !!(res.ForcePasswordReset ?? res.ResetMasterPassword);
    resetIdleTimer();

    const userId = extractSubFromJwt(res.access_token);
    profile.value = {
      id: userId,
      email: normEmail,
      emailVerified: true,
      premium: true,
    };

    if (!userId) {
      try {
        const p = await api.getAccountProfile(res.access_token);
        if (p?.id) {
          profile.value.id = p.id;
          profile.value.name = p.name;
          profile.value.emailVerified = !!p.emailVerified;
          profile.value.premium = !!p.premium;
          profile.value.culture = p.culture;
          syncLocaleFromAccountCulture(p.culture);
        }
      } catch {
        // Will be hydrated during sync()
      }
    }

    return true;
  }

  async function hydrateOrganizations(orgs: Array<{ id: string; name: string; key?: string }>) {
    organizations.value = orgs || [];
    const nextKeys: Record<string, Uint8Array> = {};
    if (privateKey.value) {
      for (const org of organizations.value) {
        if (org.key) {
          try {
            const raw = await decryptWithPrivateKey(org.key, privateKey.value);
            if (raw.byteLength === 64) nextKeys[org.id] = raw;
          } catch {
            // Skip org keys that cannot be unlocked
          }
        }
      }
    }
    orgKeys.value = nextKeys;
  }

  async function loginWithAuthRequest(
    email: string,
    accessCode: string,
    authRequestId: string,
    encryptedUserKeyStr: string,
    ephemeralPrivateKey: CryptoKey
  ): Promise<boolean> {
    const normEmail = email.trim().toLowerCase();
    const unwrappedUserKey = await decryptWithPrivateKey(encryptedUserKeyStr, ephemeralPrivateKey);
    if (unwrappedUserKey.byteLength !== 64) {
      throw new Error('Некорректный ключ пользователя в ответе одобрения');
    }

    const res = await api.loginWithAuthRequest(normEmail, accessCode, authRequestId);
    let rsaKey: CryptoKey | null = null;
    if (res.PrivateKey) {
      try {
        rsaKey = await decryptPrivateKey(res.PrivateKey, unwrappedUserKey);
      } catch {
        // Ignore optional private key failure
      }
    }

    token.value = res.access_token;
    sessionStorage.setItem('novus_token', res.access_token);
    if (res.refresh_token) {
      refreshToken.value = res.refresh_token;
      localStorage.setItem('novus_refresh_token', res.refresh_token);
    }
    savedEmail.value = normEmail;
    localStorage.setItem('novus_email', normEmail);

    masterKey.value = null;
    userKey.value = unwrappedUserKey;
    privateKey.value = rsaKey;
    forcePasswordReset.value = false;
    resetIdleTimer();

    const userId = extractSubFromJwt(res.access_token);
    profile.value = {
      id: userId,
      email: normEmail,
      emailVerified: true,
      premium: true,
    };
    return true;
  }

  async function requestEmailTwoFactor() {
    if (!pendingTwoFactor.value) {
      throw new Error('Нет активной сессии для отправки кода 2FA');
    }
    await api.sendTwoFactorEmail(
      pendingTwoFactor.value.email,
      pendingTwoFactor.value.masterPasswordHash
    );
  }

  async function tryRefreshToken(): Promise<boolean> {
    if (!refreshToken.value) return false;
    try {
      const res = await api.refreshAccessToken(refreshToken.value);
      token.value = res.access_token;
      sessionStorage.setItem('novus_token', res.access_token);
      if (res.refresh_token) {
        refreshToken.value = res.refresh_token;
        localStorage.setItem('novus_refresh_token', res.refresh_token);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Complete Zero-Knowledge Registration Flow
   */
  async function register(
    email: string,
    name: string,
    masterPassword: string,
    passwordHint?: string,
    _kdfType = 1,
    emailVerificationToken?: string,
    culture?: string
  ): Promise<{ needsEmailVerification: boolean }> {
    const normEmail = email.trim().toLowerCase();
    const preferredCulture = culture?.trim() || currentLocale.value;
    // Enforce Argon2id unconditionally on all new account registrations
    const enforcedKdfType = 1;
    const iterations = 3;
    const memory = 64;
    const parallelism = 4;

    const kdfConfig: KdfConfig = {
      kdfType: enforcedKdfType,
      iterations,
      memory,
      parallelism,
    };

    // 1. Derive Master Key
    const derivedMasterKey = await deriveMasterKey(masterPassword, normEmail, kdfConfig);

    // 2. Compute Master Password Hash
    const passwordHash = await hashMasterPassword(derivedMasterKey, masterPassword);

    // 3. Generate 64-byte random user symmetric key
    const rawUserKey = getRandomBytes(64);

    // 4. Encrypt user key with stretched master key
    const stretched = await stretchMasterKey(derivedMasterKey);
    const encryptedUserKey = (await encrypt(rawUserKey, stretched)).toString();

    // 5. Generate RSA-2048 keypair
    const keyPair = await generateKeyPair(rawUserKey);

    // 6. Call API Register (send-verification-email + finish)
    const regResult = await api.register({
      email: normEmail,
      name: name.trim() || undefined,
      masterPasswordHash: passwordHash,
      masterPasswordHint: passwordHint?.trim() || undefined,
      key: encryptedUserKey,
      keys: {
        publicKey: keyPair.publicKey,
        encryptedPrivateKey: keyPair.encryptedPrivateKey,
      },
      kdf: enforcedKdfType,
      kdfIterations: iterations,
      kdfMemory: memory,
      kdfParallelism: parallelism,
      emailVerificationToken,
      culture: preferredCulture,
    });

    if (regResult.needsEmailVerification) {
      return { needsEmailVerification: true };
    }

    // 7. Automatically log in
    await login(normEmail, masterPassword, true);
    return { needsEmailVerification: false };
  }

  /**
   * Lock Vault (Clears keys from RAM, remains signed-in)
   */
  function lock() {
    masterKey.value = null;
    userKey.value = null;
    privateKey.value = null;
  }

  /**
   * Unlock Vault with Master Password
   */
  async function unlock(masterPassword: string) {
    if (!savedEmail.value) {
      throw new Error('Email не найден для разблокировки');
    }
    return await login(savedEmail.value, masterPassword, true);
  }

  /**
   * Change Master Password
   */
  async function changePassword(currentPassword: string, newPassword: string, hint?: string) {
    if (!userKey.value || !savedEmail.value || !token.value) {
      throw new Error('Сессия недействительна');
    }

    const pre = await api.prelogin(savedEmail.value);
    const currentKdf: KdfConfig = {
      kdfType: pre.Kdf ?? pre.kdf ?? 0,
      iterations: pre.KdfIterations ?? pre.kdfIterations ?? 600000,
      memory: pre.KdfMemory ?? pre.kdfMemory ?? undefined,
      parallelism: pre.KdfParallelism ?? pre.kdfParallelism ?? undefined,
    };

    const curMasterKey = await deriveMasterKey(currentPassword, savedEmail.value, currentKdf);
    const curPasswordHash = await hashMasterPassword(curMasterKey, currentPassword);

    const newMasterKey = await deriveMasterKey(newPassword, savedEmail.value, currentKdf);
    const newPasswordHash = await hashMasterPassword(newMasterKey, newPassword);

    const newStretched = await stretchMasterKey(newMasterKey);
    const newEncryptedUserKey = (await encrypt(userKey.value, newStretched)).toString();

    await api.changePassword(token.value, {
      masterPasswordHash: curPasswordHash,
      newMasterPasswordHash: newPasswordHash,
      masterPasswordHint: hint || undefined,
      key: newEncryptedUserKey,
    });

    masterKey.value = newMasterKey;
  }

  /**
   * Change KDF Algorithm & Parameters
   */
  async function changeKdf(
    currentPassword: string,
    newKdfType: number,
    iterations: number,
    memory?: number,
    parallelism?: number
  ) {
    if (!userKey.value || !savedEmail.value || !token.value) {
      throw new Error('Сессия недействительна');
    }

    const pre = await api.prelogin(savedEmail.value);
    const curKdf: KdfConfig = {
      kdfType: pre.Kdf ?? pre.kdf ?? 0,
      iterations: pre.KdfIterations ?? pre.kdfIterations ?? 600000,
      memory: pre.KdfMemory ?? pre.kdfMemory ?? undefined,
      parallelism: pre.KdfParallelism ?? pre.kdfParallelism ?? undefined,
    };

    const curMasterKey = await deriveMasterKey(currentPassword, savedEmail.value, curKdf);
    const curPasswordHash = await hashMasterPassword(curMasterKey, currentPassword);

    const newKdfConfig: KdfConfig = {
      kdfType: newKdfType,
      iterations,
      memory,
      parallelism,
    };

    const newMasterKey = await deriveMasterKey(currentPassword, savedEmail.value, newKdfConfig);
    const newPasswordHash = await hashMasterPassword(newMasterKey, currentPassword);

    const newStretched = await stretchMasterKey(newMasterKey);
    const newEncryptedUserKey = (await encrypt(userKey.value, newStretched)).toString();

    const normEmail = savedEmail.value.trim().toLowerCase();
    const kdfPayload = {
      kdf: newKdfType,
      kdfIterations: iterations,
      kdfMemory: newKdfType === 1 ? memory : undefined,
      kdfParallelism: newKdfType === 1 ? parallelism : undefined,
    };

    await api.changeKdf(token.value, {
      authenticationData: {
        salt: normEmail,
        kdf: kdfPayload,
        masterPasswordAuthenticationHash: newPasswordHash,
      },
      unlockData: {
        salt: normEmail,
        kdf: kdfPayload,
        masterKeyWrappedUserKey: newEncryptedUserKey,
      },
      masterPasswordHash: curPasswordHash,
    });

    masterKey.value = newMasterKey;
  }

  /**
   * Deauthorize all sessions
   */
  async function deauthorizeSessions(currentPassword: string) {
    if (!savedEmail.value || !token.value) {
      throw new Error('Сессия недействительна');
    }
    const pre = await api.prelogin(savedEmail.value);
    const curKdf: KdfConfig = {
      kdfType: pre.Kdf ?? pre.kdf ?? 0,
      iterations: pre.KdfIterations ?? pre.kdfIterations ?? 600000,
      memory: pre.KdfMemory ?? pre.kdfMemory ?? undefined,
      parallelism: pre.KdfParallelism ?? pre.kdfParallelism ?? undefined,
    };
    const curMasterKey = await deriveMasterKey(currentPassword, savedEmail.value, curKdf);
    const curPasswordHash = await hashMasterPassword(curMasterKey, currentPassword);
    await api.deauthorizeSessions(token.value, curPasswordHash);
    localStorage.removeItem(twoFactorRememberStorageKey(savedEmail.value));
  }

  /**
   * Purge all items in vault
   */
  async function purgeVault(currentPassword: string) {
    if (!savedEmail.value || !token.value) {
      throw new Error('Сессия недействительна');
    }
    const pre = await api.prelogin(savedEmail.value);
    const curKdf: KdfConfig = {
      kdfType: pre.Kdf ?? pre.kdf ?? 0,
      iterations: pre.KdfIterations ?? pre.kdfIterations ?? 600000,
      memory: pre.KdfMemory ?? pre.kdfMemory ?? undefined,
      parallelism: pre.KdfParallelism ?? pre.kdfParallelism ?? undefined,
    };
    const curMasterKey = await deriveMasterKey(currentPassword, savedEmail.value, curKdf);
    const curPasswordHash = await hashMasterPassword(curMasterKey, currentPassword);
    await api.purgeVault(token.value, curPasswordHash);
  }

  /**
   * Permanently delete account
   */
  async function deleteAccount(currentPassword: string) {
    if (!savedEmail.value || !token.value) {
      throw new Error('Сессия недействительна');
    }
    const pre = await api.prelogin(savedEmail.value);
    const curKdf: KdfConfig = {
      kdfType: pre.Kdf ?? pre.kdf ?? 0,
      iterations: pre.KdfIterations ?? pre.kdfIterations ?? 600000,
      memory: pre.KdfMemory ?? pre.kdfMemory ?? undefined,
      parallelism: pre.KdfParallelism ?? pre.kdfParallelism ?? undefined,
    };
    const curMasterKey = await deriveMasterKey(currentPassword, savedEmail.value, curKdf);
    const curPasswordHash = await hashMasterPassword(curMasterKey, currentPassword);
    await api.deleteAccount(token.value, curPasswordHash);
    logout();
  }

  /**
   * Logout and clear all storage
   */
  function logout() {
    if (idleTimer) clearTimeout(idleTimer);
    token.value = null;
    refreshToken.value = null;
    masterKey.value = null;
    userKey.value = null;
    privateKey.value = null;
    organizations.value = [];
    orgKeys.value = {};
    profile.value = null;
    forcePasswordReset.value = false;
    sessionStorage.removeItem('novus_token');
    sessionStorage.removeItem('novus_pin_key');
    localStorage.removeItem('novus_refresh_token');
    hasPin.value = false;
  }

  return {
    token,
    savedEmail,
    profile,
    pendingTwoFactor,
    masterKey,
    userKey,
    privateKey,
    organizations,
    orgKeys,
    hydrateOrganizations,
    forcePasswordReset,
    hasPin,
    vaultTimeoutMinutes,
    isAuthenticated,
    isLocked,
    login,
    loginWithAuthRequest,
    requestEmailTwoFactor,
    tryRefreshToken,
    register,
    changePassword,
    changeKdf,
    deauthorizeSessions,
    purgeVault,
    deleteAccount,
    verifyMasterPassword,
    getFingerprintPhrase,
    setVaultTimeout,
    resetIdleTimer,
    setPin,
    clearPin,
    unlockWithPin,
    lock,
    unlock,
    logout,
  };
});
