// Bitwarden-compatible WebAuthn / FIDO2 helper utilities
// Used by both the standalone /webauthn-fallback-connector.html extension bridge
// and native WebAuthn 2FA inside NovusWarden Web Vault.

import type { SupportedLocale } from '@shared/i18n.ts';

export function getQueryParam(name: string, url = window.location.href): string | null {
  const escaped = name.replace(/[[\]]/g, '\\$&');
  const regex = new RegExp('[?&]' + escaped + '(=([^&#]*)|&|#|$)');
  const results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

export function base64DecodeUtf8(raw: string, spaceAsPlus = false): string {
  let str = spaceAsPlus ? raw.replace(/ /g, '+') : raw;
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (str.length % 4)) % 4;
  if (padLen) {
    str += '='.repeat(padLen);
  }
  const binary = atob(str);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function base64UrlToUint8Array(value: string): Uint8Array {
  let b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (b64.length % 4)) % 4;
  if (padLen) {
    b64 += '='.repeat(padLen);
  }
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function coerceToBase64Url(input: ArrayBuffer | Uint8Array | number[] | string): string {
  let bytes: Uint8Array | null = null;
  if (Array.isArray(input)) {
    bytes = Uint8Array.from(input);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  }

  let b64: string;
  if (bytes) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    b64 = window.btoa(binary);
  } else if (typeof input === 'string') {
    b64 = input;
  } else {
    throw new Error('Could not coerce value to Base64URL string');
  }

  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=*$/g, '');
}

/**
 * Parses Bitwarden/Vaultwarden WebAuthn PublicKeyCredentialRequestOptions
 * (either JSON string or already-parsed object) into browser-ready binary fields.
 */
export function parseWebauthnRequestOptions(
  raw: string | Record<string, any>
): PublicKeyCredentialRequestOptions {
  const parsed: Record<string, any> =
    typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));

  if (!parsed || typeof parsed.challenge !== 'string') {
    throw new Error('Missing WebAuthn challenge');
  }

  parsed.challenge = base64UrlToUint8Array(parsed.challenge);

  if (Array.isArray(parsed.allowCredentials)) {
    parsed.allowCredentials = parsed.allowCredentials.map((item: any) => ({
      ...item,
      id: typeof item.id === 'string' ? base64UrlToUint8Array(item.id) : item.id,
    }));
  }

  return parsed as PublicKeyCredentialRequestOptions;
}

/**
 * Serializes a browser PublicKeyCredential assertion into the exact JSON format
 * expected by Bitwarden clients and NovusWarden /identity/connect/token.
 */
export function buildWebauthnAssertionJson(assertedCredential: PublicKeyCredential): string {
  const response = assertedCredential.response as AuthenticatorAssertionResponse;
  const authData = new Uint8Array(response.authenticatorData);
  const clientDataJSON = new Uint8Array(response.clientDataJSON);
  const rawId = new Uint8Array(assertedCredential.rawId);
  const sig = new Uint8Array(response.signature);

  const payload = {
    id: assertedCredential.id,
    rawId: coerceToBase64Url(rawId),
    type: assertedCredential.type,
    extensions:
      typeof assertedCredential.getClientExtensionResults === 'function'
        ? assertedCredential.getClientExtensionResults()
        : {},
    response: {
      authenticatorData: coerceToBase64Url(authData),
      clientDataJson: coerceToBase64Url(clientDataJSON),
      signature: coerceToBase64Url(sig),
    },
  };

  return JSON.stringify(payload);
}

export function formatWebauthnError(err: unknown, locale: SupportedLocale): string {
  const name = (err as any)?.name || '';
  const msg = (err as any)?.message || (typeof err === 'string' ? err : '');

  if (name === 'NotAllowedError') {
    if (locale === 'uk') {
      return 'Операцію скасовано або час очікування ключа безпеки вичерпано. Спробуйте ще раз.';
    }
    if (locale === 'en') {
      return 'Operation was cancelled or timed out while waiting for your security key. Please try again.';
    }
    return 'Операция отменена или истекло время ожидания ключа безопасности. Попробуйте ещё раз.';
  }

  if (name === 'InvalidStateError') {
    if (locale === 'uk') {
      return 'Цей ключ безпеки не відповідає зареєстрованим ключам акаунта.';
    }
    if (locale === 'en') {
      return 'This security key does not match any key registered to your account.';
    }
    return 'Этот ключ безопасности не соответствует зарегистрированным ключам аккаунта.';
  }

  if (name === 'SecurityError') {
    if (locale === 'uk') {
      return 'Помилка безпеки домену WebAuthn (перевірте HTTPS та адресу сервера).';
    }
    if (locale === 'en') {
      return 'WebAuthn domain security error (verify HTTPS and server domain).';
    }
    return 'Ошибка безопасности домена WebAuthn (проверьте HTTPS и адрес сервера).';
  }

  if (msg) return msg;

  if (locale === 'uk') return 'Не вдалося підтвердити ключ безпеки.';
  if (locale === 'en') return 'Failed to verify security key.';
  return 'Не удалось подтвердить ключ безопасности.';
}
