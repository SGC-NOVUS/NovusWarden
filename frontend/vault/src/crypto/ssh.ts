// NovusWarden Client-Side SSH Key Generator & Utilities
// Zero-Knowledge WebCrypto Implementation

export interface GeneratedSshKeyPair {
  type: string;
  publicKey: string;
  privateKey: string;
  fingerprint: string;
}

/**
 * Convert an ArrayBuffer to Base64
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Format string into PEM layout (64 chars per line)
 */
function toPem(body: string, label: string): string {
  const lines: string[] = [];
  lines.push(`-----BEGIN ${label}-----`);
  for (let i = 0; i < body.length; i += 64) {
    lines.push(body.slice(i, i + 64));
  }
  lines.push(`-----END ${label}-----`);
  return lines.join('\n');
}

/**
 * Encode SSH string (4-byte length prefix + string)
 */
function sshEncodeString(str: string): Uint8Array {
  const enc = new TextEncoder().encode(str);
  const buf = new Uint8Array(4 + enc.length);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, enc.length, false);
  buf.set(enc, 4);
  return buf;
}

/**
 * Encode SSH mpint (big-endian integer with sign handling)
 */
function sshEncodeMpint(bytes: Uint8Array): Uint8Array {
  // If high bit is set, prepend 0x00
  let p = 0;
  while (p < bytes.length && bytes[p] === 0) p++;
  const trimmed = bytes.subarray(p);
  const needsZero = trimmed.length > 0 && (trimmed[0] & 0x80) !== 0;
  const len = trimmed.length + (needsZero ? 1 : 0);

  const buf = new Uint8Array(4 + len);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, len, false);
  if (needsZero) {
    buf[4] = 0x00;
    buf.set(trimmed, 5);
  } else {
    buf.set(trimmed, 4);
  }
  return buf;
}

/**
 * Generate RSA SSH Key Pair (2048 or 4096 bit)
 */
export async function generateRsaSshKey(
  bits: 2048 | 4096 = 2048,
  comment = 'novuswarden-key'
): Promise<GeneratedSshKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: bits,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  // 1. Export Private Key as PKCS#8 PEM
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const privBase64 = bufferToBase64(pkcs8);
  const privateKeyPem = toPem(privBase64, 'PRIVATE KEY');

  // 2. Export Public Key components as JWK to get modulus (n) and exponent (e)
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const eBytes = Uint8Array.from(atob(jwk.e!.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const nBytes = Uint8Array.from(atob(jwk.n!.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

  const typeHeader = sshEncodeString('ssh-rsa');
  const eEnc = sshEncodeMpint(eBytes);
  const nEnc = sshEncodeMpint(nBytes);

  const wireLen = typeHeader.length + eEnc.length + nEnc.length;
  const wireBytes = new Uint8Array(wireLen);
  let offset = 0;
  wireBytes.set(typeHeader, offset);
  offset += typeHeader.length;
  wireBytes.set(eEnc, offset);
  offset += eEnc.length;
  wireBytes.set(nEnc, offset);

  const pubKeyWireBase64 = bufferToBase64(wireBytes.buffer);
  const publicKeyStr = `ssh-rsa ${pubKeyWireBase64} ${comment}`;

  // 3. Compute SHA256 Fingerprint
  const hash = await crypto.subtle.digest('SHA-256', wireBytes);
  const hashBase64 = bufferToBase64(hash).replace(/=+$/, '');
  const fingerprint = `SHA256:${hashBase64}`;

  return {
    type: `RSA-${bits}`,
    publicKey: publicKeyStr,
    privateKey: privateKeyPem,
    fingerprint,
  };
}

