// Asymmetric Cryptography Engine (RSA-OAEP 2048-bit)
// NovusWarden Enterprise Zero-Knowledge Protocol

import { bytesToBase64, base64ToBytes, stringToBytes, bytesToString } from './utils.ts';
import { CipherString, EncType } from './cipher-string.ts';
import { encrypt, decryptToBytes } from './symmetric.ts';

export interface AsymmetricKeyPair {
  publicKey: string; // SPKI DER Base64
  encryptedPrivateKey: string; // EncType 2 CipherString wrapping PKCS#8 DER
}

/**
 * Generates an RSA-OAEP 2048-bit keypair (Bitwarden Standard)
 * Public key is exported to SPKI base64.
 * Private key is exported to PKCS#8 DER, then encrypted with userKey.
 */
export async function generateKeyPair(userKey: Uint8Array): Promise<AsymmetricKeyPair> {
  const keyPair = await globalThis.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-1', // Bitwarden v1/v2 standard for OAEP
    },
    true,
    ['encrypt', 'decrypt']
  );

  // 1. Export Public Key to SPKI (SubjectPublicKeyInfo) DER
  const spkiBuffer = await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKey = bytesToBase64(new Uint8Array(spkiBuffer));

  // 2. Export Private Key to PKCS#8 DER
  const pkcs8Buffer = await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const pkcs8Bytes = new Uint8Array(pkcs8Buffer);

  // 3. Encrypt PKCS#8 with user symmetric key using EncType 2
  const cipher = await encrypt(pkcs8Bytes, userKey);
  const encryptedPrivateKey = cipher.toString();

  return {
    publicKey,
    encryptedPrivateKey,
  };
}

/**
 * Decrypts user's private key using user symmetric key and imports it for RSA-OAEP
 */
export async function decryptPrivateKey(
  encryptedPrivateKey: string,
  userKey: Uint8Array
): Promise<CryptoKey> {
  const pkcs8Bytes = await decryptToBytes(encryptedPrivateKey, userKey);

  return await globalThis.crypto.subtle.importKey(
    'pkcs8',
    pkcs8Bytes as BufferSource,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-1',
    },
    false,
    ['decrypt']
  );
}

/**
 * Decrypts an RSA-OAEP encrypted string using user's private key
 */
export async function decryptWithPrivateKey(
  cipherInput: string | CipherString,
  privateKey: CryptoKey
): Promise<Uint8Array> {
  const cipher = typeof cipherInput === 'string' ? CipherString.parse(cipherInput) : cipherInput;

  const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    cipher.ciphertext as BufferSource
  );

  return new Uint8Array(decryptedBuffer);
}

/**
 * Generates an ephemeral RSA-OAEP 2048-bit keypair for Login with Device / Auth Requests
 */
export async function generateEphemeralKeyPair(): Promise<{ publicKeyB64: string; privateKey: CryptoKey }> {
  const keyPair = await globalThis.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-1',
    },
    true,
    ['encrypt', 'decrypt']
  );
  const spkiBuffer = await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey);
  return {
    publicKeyB64: bytesToBase64(new Uint8Array(spkiBuffer)),
    privateKey: keyPair.privateKey,
  };
}

/**
 * Encrypts bytes (e.g. userKey) using an SPKI Base64 RSA-OAEP public key -> EncType.Rsa2048_OaepSha1_B64 (4)
 */
export async function encryptWithPublicKey(data: Uint8Array, publicKeyB64: string): Promise<string> {
  const spkiBytes = base64ToBytes(publicKeyB64);
  const pubKey = await globalThis.crypto.subtle.importKey(
    'spki',
    spkiBytes as BufferSource,
    { name: 'RSA-OAEP', hash: 'SHA-1' },
    false,
    ['encrypt']
  );
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    pubKey,
    data as BufferSource
  );
  return new CipherString(EncType.Rsa2048_OaepSha1_B64, new Uint8Array(encrypted)).toString();
}

