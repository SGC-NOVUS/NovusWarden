// Key Derivation Functions (KDF) for NovusWarden
// PBKDF2-HMAC-SHA256 and Argon2id WebAssembly (offloaded to Web Worker when available)

import { stringToBytes, bytesToBase64, hexToBytes } from './utils.ts';
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

let argonWorkerSeq = 1;

function getSubtleCrypto(): SubtleCrypto {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : window.crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is unavailable in this context');
  }
  return c.subtle;
}

async function runArgon2idInWorker(params: {
  password: string;
  salt: Uint8Array;
  parallelism: number;
  iterations: number;
  memorySize: number;
  hashLength: number;
}): Promise<string> {
  if (typeof Worker === 'undefined') {
    return await argon2id({ ...params, outputType: 'hex' });
  }

  return await new Promise<string>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./argon2.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      // Fallback to main thread if bundler/environment disallows module workers
      argon2id({ ...params, outputType: 'hex' }).then(resolve, reject);
      return;
    }

    const reqId = argonWorkerSeq++;
    const cleanup = () => {
      try {
        worker.terminate();
      } catch {
        // ignore
      }
    };

    worker.onmessage = (event: MessageEvent<{ id: number; hashHex?: string; error?: string }>) => {
      if (event.data?.id !== reqId) return;
      cleanup();
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else if (event.data.hashHex) {
        resolve(event.data.hashHex);
      } else {
        reject(new Error('Empty Argon2id worker response'));
      }
    };

    worker.onerror = () => {
      cleanup();
      // Seamless fallback to main thread if worker fails to load
      argon2id({ ...params, outputType: 'hex' }).then(resolve, reject);
    };

    worker.postMessage({ id: reqId, ...params });
  });
}

/**
 * Derives a 32-byte (256-bit) Master Key from Master Password + Email Salt
 */
export async function deriveMasterKey(
  password: string,
  email: string,
  config: KdfConfig = DEFAULT_PBKDF2_CONFIG
): Promise<Uint8Array> {
  const subtle = getSubtleCrypto();
  const normEmail = email.trim().toLowerCase();
  const emailBytes = stringToBytes(normEmail);

  if (config.kdfType === 1) {
    // Bitwarden Argon2id specification uses SHA-256(lowercase(email)) as the 32-byte salt.
    const saltBuffer = await subtle.digest('SHA-256', emailBytes as BufferSource);
    const salt = new Uint8Array(saltBuffer);
    const memoryKb = (config.memory || 64) * 1024;
    const iterations = config.iterations || 3;
    const parallelism = config.parallelism || 4;

    const hashHex = await runArgon2idInWorker({
      password,
      salt,
      parallelism,
      iterations,
      memorySize: memoryKb,
      hashLength: 32,
    });
    return hexToBytes(hashHex);
  }

  // PBKDF2-HMAC-SHA256 via native Web Crypto API (salt = UTF-8 lowercase email)
  const passwordKey = await subtle.importKey(
    'raw',
    stringToBytes(password) as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await subtle.deriveBits(
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
  const subtle = getSubtleCrypto();
  const importedKey = await subtle.importKey(
    'raw',
    masterKey as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await subtle.deriveBits(
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
