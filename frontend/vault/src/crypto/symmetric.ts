// Symmetric Encryption & Decryption Engine
// AES-256-CBC + HMAC-SHA256 (Bitwarden EncType 2) & AES-256-GCM
// NovusWarden Enterprise Zero-Knowledge Protocol

import { CipherString, EncType } from './cipher-string.ts';
import {
  stringToBytes,
  bytesToString,
  bytesToBase64,
  concatBytes,
  getRandomBytes,
  timingSafeEqual,
} from './utils.ts';

/**
 * Stretches a 32-byte (256-bit) Master Key into a 64-byte (512-bit) User Key
 * using HKDF-Expand with SHA-256:
 * - First 32 bytes: HKDF-Expand(masterKey, "enc", 32)
 * - Next 32 bytes:  HKDF-Expand(masterKey, "mac", 32)
 */
export async function stretchMasterKey(masterKey: Uint8Array): Promise<Uint8Array> {
  // RFC 5869 HKDF-Expand with SHA-256 (Bitwarden exact specification):
  // encKey = HMAC-SHA256(masterKey, UTF8("enc") || 0x01)
  // macKey = HMAC-SHA256(masterKey, UTF8("mac") || 0x01)
  const hmacKey = await globalThis.crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const encInfo = concatBytes(stringToBytes('enc'), new Uint8Array([1]));
  const macInfo = concatBytes(stringToBytes('mac'), new Uint8Array([1]));

  const encBuffer = await globalThis.crypto.subtle.sign('HMAC', hmacKey, encInfo as BufferSource);
  const macBuffer = await globalThis.crypto.subtle.sign('HMAC', hmacKey, macInfo as BufferSource);

  return concatBytes(new Uint8Array(encBuffer), new Uint8Array(macBuffer));
}

/**
 * Derives a 64-byte Send encryption key from a 16-byte raw Send key using HKDF-SHA256
 * (Bitwarden Send specification: salt="bitwarden-send", info="send").
 */
export async function deriveSendKey(rawSendKey: Uint8Array): Promise<Uint8Array> {
  const ikm = await globalThis.crypto.subtle.importKey(
    'raw',
    rawSendKey as BufferSource,
    'HKDF',
    false,
    ['deriveBits']
  );

  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: stringToBytes('bitwarden-send') as BufferSource,
      info: stringToBytes('send') as BufferSource,
    },
    ikm,
    512
  );

  return new Uint8Array(bits);
}

/**
 * Normalizes any key to 64 bytes (512-bit: 32b AES + 32b HMAC)
 */
export async function normalizeSymmetricKey(key: Uint8Array): Promise<{
  encKey: Uint8Array;
  macKey: Uint8Array;
  fullKey: Uint8Array;
}> {
  let fullKey: Uint8Array;
  if (key.byteLength === 32) {
    fullKey = await stretchMasterKey(key);
  } else if (key.byteLength === 64) {
    fullKey = key;
  } else {
    throw new Error(`Недопустимая длина ключа: ${key.byteLength} байт (ожидается 32 или 64)`);
  }

  return {
    encKey: fullKey.slice(0, 32),
    macKey: fullKey.slice(32, 64),
    fullKey,
  };
}

/**
 * Encrypts plaintext string or bytes into Bitwarden EncType 2 CipherString
 */
export async function encrypt(
  plainData: string | Uint8Array,
  key: Uint8Array
): Promise<CipherString> {
  const plainBytes = typeof plainData === 'string' ? stringToBytes(plainData) : plainData;
  const { encKey, macKey } = await normalizeSymmetricKey(key);

  const iv = getRandomBytes(16);

  // 1. AES-256-CBC Encrypt
  const aesKey = await globalThis.crypto.subtle.importKey(
    'raw',
    encKey as BufferSource,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: iv as BufferSource },
    aesKey,
    plainBytes as BufferSource
  );
  const ciphertext = new Uint8Array(cipherBuffer);

  // 2. HMAC-SHA256 over IV + Ciphertext
  const hmacKey = await globalThis.crypto.subtle.importKey(
    'raw',
    macKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const macData = concatBytes(iv, ciphertext);
  const macBuffer = await globalThis.crypto.subtle.sign('HMAC', hmacKey, macData as BufferSource);
  const mac = new Uint8Array(macBuffer);

  return new CipherString(EncType.AesCbc256_HmacSha256_B64, ciphertext, iv, mac);
}

/**
 * Encrypts binary file/attachment bytes into Bitwarden binary EncType 2 buffer:
 * [encType (1 byte = 0x02) | iv (16 bytes) | mac (32 bytes) | ciphertext]
 */
export async function encryptBytes(
  plainBytes: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array> {
  const { encKey, macKey } = await normalizeSymmetricKey(key);
  const iv = getRandomBytes(16);

  const aesKey = await globalThis.crypto.subtle.importKey(
    'raw',
    encKey as BufferSource,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: iv as BufferSource },
    aesKey,
    plainBytes as BufferSource
  );
  const ciphertext = new Uint8Array(cipherBuffer);

  const hmacKey = await globalThis.crypto.subtle.importKey(
    'raw',
    macKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const macData = concatBytes(iv, ciphertext);
  const macBuffer = await globalThis.crypto.subtle.sign('HMAC', hmacKey, macData as BufferSource);
  const mac = new Uint8Array(macBuffer);

  return concatBytes(new Uint8Array([EncType.AesCbc256_HmacSha256_B64]), iv, mac, ciphertext);
}

/**
 * Decrypts Bitwarden binary EncType 2 buffer ([0x02 | iv(16) | mac(32) | ciphertext])
 */
export async function decryptBytes(
  encryptedBytes: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array> {
  if (encryptedBytes.byteLength < 1 + 16 + 32 + 1) {
    throw new Error('Повреждённый зашифрованный бинарный буфер');
  }
  const encType = encryptedBytes[0];
  if (encType !== EncType.AesCbc256_HmacSha256_B64) {
    throw new Error(`Неподдерживаемый бинарный тип шифра: ${encType}`);
  }
  const iv = encryptedBytes.slice(1, 17);
  const mac = encryptedBytes.slice(17, 49);
  const ciphertext = encryptedBytes.slice(49);

  const { encKey, macKey } = await normalizeSymmetricKey(key);
  const hmacKey = await globalThis.crypto.subtle.importKey(
    'raw',
    macKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const computedMac = new Uint8Array(
    await globalThis.crypto.subtle.sign('HMAC', hmacKey, concatBytes(iv, ciphertext) as BufferSource)
  );
  if (!timingSafeEqual(computedMac, mac)) {
    throw new Error('Ошибка проверки целостности (MAC) зашифрованного файла');
  }

  const aesKey = await globalThis.crypto.subtle.importKey(
    'raw',
    encKey as BufferSource,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  const plain = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: iv as BufferSource },
    aesKey,
    ciphertext as BufferSource
  );
  return new Uint8Array(plain);
}

/**
 * Bitwarden Send password key hash (PBKDF2-SHA256, 100k iterations, salt="bitwarden-send")
 */
export async function hashSendPassword(password: string): Promise<string> {
  const keyMat = await globalThis.crypto.subtle.importKey(
    'raw',
    stringToBytes(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: stringToBytes('bitwarden-send') as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMat,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

/**
 * Decrypts a Bitwarden CipherString using symmetric key
 */
export async function decrypt(
  cipherInput: string | CipherString,
  key: Uint8Array
): Promise<string> {
  const cipher = typeof cipherInput === 'string' ? CipherString.parse(cipherInput) : cipherInput;
  const { encKey, macKey } = await normalizeSymmetricKey(key);

  if (
    cipher.encType === EncType.AesCbc256_HmacSha256_B64 ||
    cipher.encType === EncType.AesCbc256_HmacSha256_B64_Mac
  ) {
    if (!cipher.iv || !cipher.mac) {
      throw new Error('Отсутствует IV или MAC для шифра AesCbc256_HmacSha256');
    }

    // 1. Verify HMAC
    const hmacKey = await globalThis.crypto.subtle.importKey(
      'raw',
      macKey as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const macData = concatBytes(cipher.iv, cipher.ciphertext);
    const computedMacBuffer = await globalThis.crypto.subtle.sign('HMAC', hmacKey, macData as BufferSource);
    const computedMac = new Uint8Array(computedMacBuffer);

    if (!timingSafeEqual(computedMac, cipher.mac)) {
      throw new Error('Критическая ошибка MAC: данные повреждены или неверный ключ шифрования');
    }

    // 2. Decrypt AES-CBC
    const aesKey = await globalThis.crypto.subtle.importKey(
      'raw',
      encKey as BufferSource,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );

    const plainBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: cipher.iv as BufferSource },
      aesKey,
      cipher.ciphertext as BufferSource
    );

    return bytesToString(plainBuffer);
  } else if (cipher.encType === EncType.AesCbc256_B64) {
    if (!cipher.iv) throw new Error('Отсутствует IV для шифра AesCbc256');

    const aesKey = await globalThis.crypto.subtle.importKey(
      'raw',
      encKey as BufferSource,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );

    const plainBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: cipher.iv as BufferSource },
      aesKey,
      cipher.ciphertext as BufferSource
    );

    return bytesToString(plainBuffer);
  }

  throw new Error(`Тип шифра ${cipher.encType} не поддерживается симметричным дешифратором`);
}

/**
 * Decrypts binary data (e.g. decrypted symmetric key, private key DER)
 */
export async function decryptToBytes(
  cipherInput: string | CipherString,
  key: Uint8Array
): Promise<Uint8Array> {
  const cipher = typeof cipherInput === 'string' ? CipherString.parse(cipherInput) : cipherInput;
  const { encKey, macKey } = await normalizeSymmetricKey(key);

  if (!cipher.iv || !cipher.mac) {
    throw new Error('Отсутствует IV или MAC');
  }

  // 1. Verify HMAC
  const hmacKey = await globalThis.crypto.subtle.importKey(
    'raw',
    macKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const macData = concatBytes(cipher.iv, cipher.ciphertext);
  const computedMacBuffer = await globalThis.crypto.subtle.sign('HMAC', hmacKey, macData as BufferSource);
  if (!timingSafeEqual(new Uint8Array(computedMacBuffer), cipher.mac)) {
    throw new Error('Ошибка проверки подлинности MAC ключа');
  }

  // 2. Decrypt AES-CBC
  const aesKey = await globalThis.crypto.subtle.importKey(
    'raw',
    encKey as BufferSource,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );

  const plainBuffer = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: cipher.iv as BufferSource },
    aesKey,
    cipher.ciphertext as BufferSource
  );

  return new Uint8Array(plainBuffer);
}
