// Key Derivation Functions (KDF) for NovusWarden
// PBKDF2-HMAC-SHA256 and Argon2id WebAssembly

import { stringToBytes, bytesToBase64, bytesToString, hexToBytes } from './utils.ts';
import { argon2id } from 'hash-wasm';

export interface KdfConfig {
  kdfType: number; // 0 = PBKDF2, 1 = Argon2id
  iterations: number;
  memory?: number | null; // in MB (e.g. 64)
  parallelism?: number | null; // e.g. 4
}

export const DEFAULT_PBKDF2_CONFIG: KdfConfig = {
  kdfType: 0,
  iterations: 600000,
};

export const DEFAULT_ARGON2_CONFIG: KdfConfig = {
  kdfType: 1,
  iterations: 3,
  memory: 64,
  parallelism: 4,
};

/**
 * Derives a 32-byte (256-bit) Master Key from Master Password + Email Salt
 */
export async function deriveMasterKey(
  password: string,
  email: string,
  config: KdfConfig = DEFAULT_PBKDF2_CONFIG
): Promise<Uint8Array> {
  const normEmail = email.trim().toLowerCase();
  const emailBytes = stringToBytes(normEmail);

  if (config.kdfType === 1) {
    // Bitwarden Argon2id specification uses SHA-256(lowercase(email)) as the 32-byte salt.
    const saltBuffer = await window.crypto.subtle.digest('SHA-256', emailBytes as BufferSource);
    const salt = new Uint8Array(saltBuffer);
    const memoryKb = (config.memory || 64) * 1024;
    const iterations = config.iterations || 3;
    const parallelism = config.parallelism || 4;

    const hashHex = await argon2id({
      password,
      salt,
      parallelism,
      iterations,
      memorySize: memoryKb,
      hashLength: 32,
      outputType: 'hex',
    });
    return hexToBytes(hashHex);
  }

  // PBKDF2-HMAC-SHA256 via native browser Web Crypto API (salt = UTF-8 lowercase email)
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    stringToBytes(password) as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: emailBytes as BufferSource,
      iterations: config.iterations || 600000,
      hash: 'SHA-256',
    },
    passwordKey,
    256 // 32 bytes
  );

  return new Uint8Array(derivedBits);
}

/**
 * Computes Master Password Hash sent to server for authentication:
 * base64(PBKDF2(masterKey, password, 1, 32, SHA-256))
 */
export async function hashMasterPassword(masterKey: Uint8Array, password: string): Promise<string> {
  const importedKey = await window.crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: stringToBytes(password) as BufferSource,
      iterations: 1,
      hash: 'SHA-256',
    },
    importedKey,
    256
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

