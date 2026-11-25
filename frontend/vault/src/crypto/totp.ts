// RFC 6238 Time-Based One-Time Password (TOTP) Engine
// Zero-Knowledge NovusWarden Enterprise Standard
// WebCrypto Native implementation (SHA-1, SHA-256, SHA-512)

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodes a Base32 string into Uint8Array
 */
export function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[\s\-_=]/g, '');
  if (!clean) return new Uint8Array(0);

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) {
      continue; // Ignore invalid chars
    }

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

export interface TotpOptions {
  secret: string;
  digits?: number; // default: 6
  period?: number; // default: 30 seconds
  algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512'; // default: SHA-1
  timestamp?: number; // default: Date.now()
}

export interface TotpResult {
  code: string;
  secondsRemaining: number;
  period: number;
  progressPercent: number;
}

/**
 * Parses otpauth:// URI or raw secret string
 */
export function parseTotpSecret(input: string): {
  secret: string;
  digits: number;
  period: number;
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512';
} {
  const trimmed = input.trim();
  if (trimmed.startsWith('otpauth://')) {
    try {
      const url = new URL(trimmed);
      const secret = url.searchParams.get('secret') || '';
      const digits = parseInt(url.searchParams.get('digits') || '6', 10);
      const period = parseInt(url.searchParams.get('period') || '30', 10);
      let algoRaw = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase();
      let algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512' = 'SHA-1';
      if (algoRaw === 'SHA256' || algoRaw === 'SHA-256') algorithm = 'SHA-256';
      else if (algoRaw === 'SHA512' || algoRaw === 'SHA-512') algorithm = 'SHA-512';

      return {
        secret: secret.replace(/\s+/g, ''),
        digits: isNaN(digits) ? 6 : digits,
        period: isNaN(period) ? 30 : period,
        algorithm,
      };
    } catch {
      // Fallback to raw parsing
    }
  }

  return {
    secret: trimmed.replace(/\s+/g, ''),
    digits: 6,
    period: 30,
    algorithm: 'SHA-1',
  };
}

/**
 * Generates current TOTP code and countdown info using WebCrypto HMAC
 */
export async function generateTotp(options: TotpOptions): Promise<TotpResult> {
  const digits = options.digits || 6;
  const period = options.period || 30;
  const algorithm = options.algorithm || 'SHA-1';
  const now = options.timestamp !== undefined ? options.timestamp : Date.now();

  const keyBytes = base32ToBytes(options.secret);
  if (keyBytes.byteLength === 0) {
    return {
      code: '------',
      secondsRemaining: 30,
      period,
      progressPercent: 100,
    };
  }

  const epochSeconds = Math.floor(now / 1000);
  const timeStep = Math.floor(epochSeconds / period);
  const secondsRemaining = period - (epochSeconds % period);
  const progressPercent = Math.round((secondsRemaining / period) * 100);

  // Time step as 8-byte big-endian counter
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(0, Math.floor(timeStep / 0x100000000), false);
  counterView.setUint32(4, timeStep & 0xffffffff, false);

  // Import HMAC key
  const hmacKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );

  // Sign counter
  const hmacResult = await window.crypto.subtle.sign('HMAC', hmacKey, counterBuffer);
  const hmacBytes = new Uint8Array(hmacResult);

  // Dynamic truncation (RFC 4226)
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
  const binaryCode =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  const mod = Math.pow(10, digits);
  const otpNumber = binaryCode % mod;
  const code = otpNumber.toString().padStart(digits, '0');

  return {
    code,
    secondsRemaining,
    period,
    progressPercent,
  };
}

