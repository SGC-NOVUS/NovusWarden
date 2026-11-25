// Bitwarden CipherString Parser and Formatter
// NovusWarden Enterprise Zero-Knowledge Protocol

import { base64ToBytes, bytesToBase64 } from './utils.ts';

export enum EncType {
  AesCbc256_B64 = 0,
  AesCbc128_HmacSha256_B64 = 1,
  AesCbc256_HmacSha256_B64 = 2,
  Rsa2048_OaepSha256_B64 = 3,
  Rsa2048_OaepSha1_B64 = 4,
  Rsa2048_OaepSha256_HmacSha256_B64 = 5,
  Rsa2048_OaepSha1_HmacSha256_B64 = 6,
  AesCbc256_HmacSha256_B64_Mac = 7,
}

export class CipherString {
  encType: EncType;
  iv?: Uint8Array;
  ciphertext: Uint8Array;
  mac?: Uint8Array;

  constructor(encType: EncType, ciphertext: Uint8Array, iv?: Uint8Array, mac?: Uint8Array) {
    this.encType = encType;
    this.ciphertext = ciphertext;
    this.iv = iv;
    this.mac = mac;
  }

  static parse(encryptedString: string): CipherString {
    if (!encryptedString || typeof encryptedString !== 'string') {
      throw new Error('Некорректная зашифрованная строка');
    }

    const dotIndex = encryptedString.indexOf('.');
    if (dotIndex === -1) {
      throw new Error(`Неизвестный формат шифра: ${encryptedString.slice(0, 20)}...`);
    }

    const encType = parseInt(encryptedString.substring(0, dotIndex), 10) as EncType;
    const body = encryptedString.substring(dotIndex + 1);
    const parts = body.split('|');

    switch (encType) {
      case EncType.AesCbc256_B64:
      case EncType.AesCbc128_HmacSha256_B64:
        if (parts.length < 2) throw new Error('AesCbc шифр должен содержать IV и ciphertext');
        return new CipherString(encType, base64ToBytes(parts[1]), base64ToBytes(parts[0]));

      case EncType.AesCbc256_HmacSha256_B64:
      case EncType.AesCbc256_HmacSha256_B64_Mac:
        if (parts.length < 3) throw new Error('AesCbc+Hmac шифр должен содержать IV, ciphertext и MAC');
        return new CipherString(
          encType,
          base64ToBytes(parts[1]),
          base64ToBytes(parts[0]),
          base64ToBytes(parts[2])
        );

      case EncType.Rsa2048_OaepSha256_B64:
      case EncType.Rsa2048_OaepSha1_B64:
        return new CipherString(encType, base64ToBytes(parts[0]));

      case EncType.Rsa2048_OaepSha256_HmacSha256_B64:
      case EncType.Rsa2048_OaepSha1_HmacSha256_B64:
        if (parts.length < 2) throw new Error('RSA+Hmac шифр должен содержать ciphertext и MAC');
        return new CipherString(encType, base64ToBytes(parts[0]), undefined, base64ToBytes(parts[1]));

      default:
        throw new Error(`Неподдерживаемый тип шифрования: ${encType}`);
    }
  }

  toString(): string {
    const ctB64 = bytesToBase64(this.ciphertext);
    const ivB64 = this.iv ? bytesToBase64(this.iv) : '';
    const macB64 = this.mac ? bytesToBase64(this.mac) : '';

    switch (this.encType) {
      case EncType.AesCbc256_B64:
      case EncType.AesCbc128_HmacSha256_B64:
        return `${this.encType}.${ivB64}|${ctB64}`;

      case EncType.AesCbc256_HmacSha256_B64:
      case EncType.AesCbc256_HmacSha256_B64_Mac:
        return `${this.encType}.${ivB64}|${ctB64}|${macB64}`;

      case EncType.Rsa2048_OaepSha256_B64:
      case EncType.Rsa2048_OaepSha1_B64:
        return `${this.encType}.${ctB64}`;

      case EncType.Rsa2048_OaepSha256_HmacSha256_B64:
      case EncType.Rsa2048_OaepSha1_HmacSha256_B64:
        return `${this.encType}.${ctB64}|${macB64}`;

      default:
        throw new Error(`Неизвестный тип шифрования: ${this.encType}`);
    }
  }
}

