import { describe, it, expect, beforeEach } from 'vitest';
import { deriveMasterKey, hashMasterPassword } from '@vault/crypto/kdf.ts';
import { encrypt, decrypt, stretchMasterKey } from '@vault/crypto/symmetric.ts';
import { CipherString, EncType } from '@vault/crypto/cipher-string.ts';
import { generateTotp, parseTotpSecret } from '@vault/crypto/totp.ts';
import {
  getQueryParam,
  base64DecodeUtf8,
  coerceToBase64Url,
  parseWebauthnRequestOptions,
  parseWebauthnCreationOptions,
  formatWebauthnError,
} from '@vault/crypto/webauthn.ts';
import { normalizeSupportedLocale, setLocale, t } from '@shared/i18n.ts';

describe('NovusWarden KDF (PBKDF2 & Argon2id)', () => {
  it('derives deterministic 32-byte Master Key with Argon2id (RFC 9106)', async () => {
    const k1 = await deriveMasterKey('CorrectHorseBatteryStaple!', 'User@Example.com', {
      kdfType: 1,
      iterations: 2,
      memory: 16,
      parallelism: 2,
    });
    const k2 = await deriveMasterKey('CorrectHorseBatteryStaple!', '  user@example.com ', {
      kdfType: 1,
      iterations: 2,
      memory: 16,
      parallelism: 2,
    });
    expect(k1.byteLength).toBe(32);
    expect(Buffer.from(k1).toString('hex')).toBe(Buffer.from(k2).toString('hex'));

    const hash = await hashMasterPassword(k1, 'CorrectHorseBatteryStaple!');
    expect(hash.length).toBeGreaterThan(30);
  });

  it('derives deterministic 32-byte Master Key with PBKDF2-SHA256', async () => {
    const key = await deriveMasterKey('test-password', 'alice@example.com', {
      kdfType: 0,
      iterations: 1000,
    });
    expect(key.byteLength).toBe(32);
  });
});

describe('NovusWarden Symmetric Crypto & CipherString (EncType 2)', () => {
  it('round-trips UTF-8 plaintext through HKDF stretch + AES-256-CBC-HMAC-SHA256', async () => {
    const mk = await deriveMasterKey('my-master-secret', 'alice@example.com', {
      kdfType: 0,
      iterations: 1000,
    });
    const stretched = await stretchMasterKey(mk);
    expect(stretched.byteLength).toBe(64);

    const plaintext = 'Секретный пароль 🔐 — NovusWarden Zero-Knowledge!';
    const cs = await encrypt(plaintext, stretched);
    expect(cs.encType).toBe(EncType.AesCbc256_HmacSha256_B64);

    const serialized = cs.toString();
    expect(serialized.startsWith('2.')).toBe(true);

    const parsed = CipherString.parse(serialized);
    expect(parsed.encType).toBe(EncType.AesCbc256_HmacSha256_B64);

    const decrypted = await decrypt(serialized, stretched);
    expect(decrypted).toBe(plaintext);
  });

  it('rejects tampered MAC in CipherString', async () => {
    const mk = await deriveMasterKey('secret', 'bob@example.com', { kdfType: 0, iterations: 1000 });
    const stretched = await stretchMasterKey(mk);
    const serialized = (await encrypt('hello', stretched)).toString();
    const parts = serialized.split('|');
    // Flip first char of MAC
    parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
    await expect(decrypt(parts.join('|'), stretched)).rejects.toThrow();
  });
});

describe('TOTP Generator & URI Parser', () => {
  it('parses otpauth URI and generates valid 6-digit TOTP code', async () => {
    const parsed = parseTotpSecret(
      'otpauth://totp/NovusWarden:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=NovusWarden&digits=6&period=30'
    );
    expect(parsed.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(parsed.digits).toBe(6);
    expect(parsed.period).toBe(30);

    const res = await generateTotp(parsed);
    expect(res.code).toMatch(/^\d{6}$/);
    expect(res.secondsRemaining).toBeGreaterThan(0);
    expect(res.secondsRemaining).toBeLessThanOrEqual(30);
  });
});

describe('WebAuthn Protocol Utilities', () => {
  it('parses query params and UTF-8 Base64 payloads', () => {
    const url = 'https://vault.sgc-novus.xyz/webauthn-fallback-connector.html?parent=chrome-extension%3A%2F%2Fabc&locale=ru&v=2';
    expect(getQueryParam('parent', url)).toBe('chrome-extension://abc');
    expect(getQueryParam('locale', url)).toBe('ru');
    expect(getQueryParam('v', url)).toBe('2');

    const encoded = Buffer.from('{"hello":"привет"}', 'utf8').toString('base64');
    expect(JSON.parse(base64DecodeUtf8(encoded))).toEqual({ hello: 'привет' });
  });

  it('converts WebAuthn challenge & allowCredentials to Uint8Array and encodes Base64URL', () => {
    const opts = parseWebauthnRequestOptions(
      JSON.stringify({
        challenge: 'AQIDBA',
        rpId: 'vault.sgc-novus.xyz',
        allowCredentials: [{ id: 'BQYHCA', type: 'public-key' }],
      })
    );
    expect(opts.challenge).toBeInstanceOf(Uint8Array);
    expect(Array.from(opts.challenge as Uint8Array)).toEqual([1, 2, 3, 4]);
    expect(opts.allowCredentials?.[0].id).toBeInstanceOf(Uint8Array);
    expect(Array.from(opts.allowCredentials?.[0].id as Uint8Array)).toEqual([5, 6, 7, 8]);

    // Ensure Base64URL strips padding and converts +/ to -_
    const b64u = coerceToBase64Url('ab+cd/ef==');
    expect(b64u).toBe('ab-cd_ef');
  });

  it('parses WebAuthn registration options (challenge, user.id, excludeCredentials)', () => {
    const createOpts = parseWebauthnCreationOptions({
      challenge: 'AQIDBA',
      rp: { name: 'NovusWarden', id: 'vault.sgc-novus.xyz' },
      user: { id: 'BQYHCA', name: 'u@example.com', displayName: 'User' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      excludeCredentials: [{ type: 'public-key', id: 'AQIDBA' }],
    });
    expect(createOpts.challenge).toBeInstanceOf(Uint8Array);
    expect(createOpts.user.id).toBeInstanceOf(Uint8Array);
    expect(createOpts.excludeCredentials?.[0].id).toBeInstanceOf(Uint8Array);
  });

  it('localizes WebAuthn NotAllowedError cleanly', () => {
    const err = Object.assign(new Error('timeout'), { name: 'NotAllowedError' });
    expect(formatWebauthnError(err, 'ru')).toContain('отменена');
    expect(formatWebauthnError(err, 'uk')).toContain('скасовано');
    expect(formatWebauthnError(err, 'en')).toContain('cancelled');
  });
});

describe('i18n Engine (RU / UK / EN)', () => {
  beforeEach(() => {
    setLocale('ru');
  });

  it('normalizes locale tags and translates across ru/uk/en', () => {
    expect(normalizeSupportedLocale('uk-UA')).toBe('uk');
    expect(normalizeSupportedLocale('ru_RU')).toBe('ru');
    expect(normalizeSupportedLocale('en-GB')).toBe('en');
    expect(normalizeSupportedLocale('de-DE')).toBeNull();

    setLocale('ru');
    expect(t('nav.vault')).toBe('Хранилище');
    setLocale('uk');
    expect(t('nav.vault')).toBe('Сховище');
    setLocale('en');
    expect(t('nav.vault')).toBe('Vault');
  });
});
