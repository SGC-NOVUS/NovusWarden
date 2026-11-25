// NovusWarden Real-Time Notifications Client (SignalR + MessagePack Hub)
// Compatible with Bitwarden Server & Vaultwarden /notifications/hub WebSocket protocol

import { getDeviceIdentifier } from '../api/client.ts';

export interface NotificationHandlers {
  onSync: (updateType: number) => void;
  onLogOut: () => void;
  onAuthRequest?: (payload: any) => void;
}

const RECORD_SEPARATOR = 0x1e;

/** Minimal MessagePack decoder covering the frame types sent by Vaultwarden notifications.rs */
function decodeMsgPack(bytes: Uint8Array): any {
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();

  function readStr(len: number): string {
    const slice = bytes.subarray(offset, offset + len);
    offset += len;
    return decoder.decode(slice);
  }

  function readArray(len: number): any[] {
    const arr = new Array(len);
    for (let i = 0; i < len; i++) arr[i] = readValue();
    return arr;
  }

  function readMap(len: number): Record<string, any> {
    const obj: Record<string, any> = {};
    for (let i = 0; i < len; i++) {
      const k = String(readValue());
      obj[k] = readValue();
    }
    return obj;
  }

  function readValue(): any {
    if (offset >= bytes.length) return null;
    const tag = bytes[offset++];
    if (tag <= 0x7f) return tag; // positive fixint
    if (tag >= 0xe0) return tag - 256; // negative fixint
    if ((tag & 0xf0) === 0x80) return readMap(tag & 0x0f);
    if ((tag & 0xf0) === 0x90) return readArray(tag & 0x0f);
    if ((tag & 0xe0) === 0xa0) return readStr(tag & 0x1f);

    switch (tag) {
      case 0xc0:
        return null;
      case 0xc2:
        return false;
      case 0xc3:
        return true;
      case 0xc4: {
        const l = bytes[offset++];
        const out = bytes.slice(offset, offset + l);
        offset += l;
        return out;
      }
      case 0xc5: {
        const l = view.getUint16(offset, false);
        offset += 2;
        const out = bytes.slice(offset, offset + l);
        offset += l;
        return out;
      }
      case 0xc6: {
        const l = view.getUint32(offset, false);
        offset += 4;
        const out = bytes.slice(offset, offset + l);
        offset += l;
        return out;
      }
      case 0xca: {
        const f = view.getFloat32(offset, false);
        offset += 4;
        return f;
      }
      case 0xcb: {
        const f = view.getFloat64(offset, false);
        offset += 8;
        return f;
      }
      case 0xcc:
        return bytes[offset++];
      case 0xcd: {
        const v = view.getUint16(offset, false);
        offset += 2;
        return v;
      }
      case 0xce: {
        const v = view.getUint32(offset, false);
        offset += 4;
        return v;
      }
      case 0xcf: {
        const hi = view.getUint32(offset, false);
        const lo = view.getUint32(offset + 4, false);
        offset += 8;
        return hi * 2 ** 32 + lo;
      }
      case 0xd0: {
        const v = view.getInt8(offset);
        offset += 1;
        return v;
      }
      case 0xd1: {
        const v = view.getInt16(offset, false);
        offset += 2;
        return v;
      }
      case 0xd2: {
        const v = view.getInt32(offset, false);
        offset += 4;
        return v;
      }
      case 0xd9:
        return readStr(bytes[offset++]);
      case 0xda: {
        const l = view.getUint16(offset, false);
        offset += 2;
        return readStr(l);
      }
      case 0xdb: {
        const l = view.getUint32(offset, false);
        offset += 4;
        return readStr(l);
      }
      case 0xdc: {
        const l = view.getUint16(offset, false);
        offset += 2;
        return readArray(l);
      }
      case 0xdd: {
        const l = view.getUint32(offset, false);
        offset += 4;
        return readArray(l);
      }
      case 0xde: {
        const l = view.getUint16(offset, false);
        offset += 2;
        return readMap(l);
      }
      case 0xdf: {
        const l = view.getUint32(offset, false);
        offset += 4;
        return readMap(l);
      }
      default:
        // ext / fixext timestamps returned inside Payload maps
        if (tag >= 0xd4 && tag <= 0xd8) {
          const sizes: Record<number, number> = { 0xd4: 2, 0xd5: 3, 0xd6: 5, 0xd7: 9, 0xd8: 17 };
          offset += sizes[tag] || 1;
          return null;
        }
        return null;
    }
  }

  return readValue();
}

/** Decode Bitwarden varint length-prefixed SignalR MessagePack binary frames */
function parseSignalRFrames(buffer: ArrayBuffer): any[] {
  const bytes = new Uint8Array(buffer);
  const frames: any[] = [];
  let pos = 0;

  while (pos < bytes.length) {
    // Length prefix (LEB128 varint)
    let len = 0;
    let shift = 0;
    while (pos < bytes.length) {
      const b = bytes[pos++];
      len |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    if (len <= 0 || pos + len > bytes.length) break;
    const frameBytes = bytes.subarray(pos, pos + len);
    pos += len;
    try {
      frames.push(decodeMsgPack(frameBytes));
    } catch {
      // Ignore malformed frame
    }
  }
  return frames;
}

class NotificationsClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private activeToken: string | null = null;
  private handlers: NotificationHandlers | null = null;
  private closedManually = false;
  private backoffMs = 2000;

  async connect(token: string, handlers: NotificationHandlers) {
    this.disconnect();
    this.closedManually = false;
    this.activeToken = token;
    this.handlers = handlers;

    // Probe /notifications/hub/negotiate first so reverse proxies / disabled WS fail gracefully
    try {
      const neg = await fetch('/notifications/hub/negotiate?negotiateVersion=1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!neg.ok) return;
    } catch {
      return;
    }

    this.openSocket();
  }

  private openSocket() {
    if (this.closedManually || !this.activeToken || !this.handlers) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/notifications/hub?access_token=${encodeURIComponent(this.activeToken)}`;

    try {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.onopen = () => {
        this.backoffMs = 2000;
        // SignalR MessagePack handshake
        const handshake = JSON.stringify({ protocol: 'messagepack', version: 1 }) + String.fromCharCode(RECORD_SEPARATOR);
        ws.send(handshake);
      };

      ws.onmessage = (evt) => {
        if (typeof evt.data === 'string') return;
        const frames = parseSignalRFrames(evt.data as ArrayBuffer);
        for (const msg of frames) {
          if (!Array.isArray(msg)) continue;
          // Ping = [6]
          if (msg[0] === 6) {
            ws.send(new Uint8Array([0x02, 0x91, 0x06]));
            continue;
          }
          // Invocation = [1, Headers, InvocationId, Target, Arguments]
          if (msg[0] === 1 && msg[3] === 'ReceiveMessage' && Array.isArray(msg[4]) && msg[4][0]) {
            const payload = msg[4][0];
            const ut = Number(payload?.Type);
            const ctx = payload?.ContextId ? String(payload.ContextId) : '';
            if (ut === 11) {
              this.handlers?.onLogOut();
            } else if (ut === 15) {
              this.handlers?.onAuthRequest?.(payload?.Payload);
            } else if ((ut >= 0 && ut <= 10) || (ut >= 12 && ut <= 14)) {
              if (!ctx || ctx !== getDeviceIdentifier()) {
                this.handlers?.onSync(ut);
              }
            }
          }
        }
      };

      ws.onclose = () => {
        if (!this.closedManually && this.activeToken) {
          this.reconnectTimer = setTimeout(() => {
            this.backoffMs = Math.min(this.backoffMs * 2, 30000);
            this.openSocket();
          }, this.backoffMs);
        }
      };
    } catch {
      // WebSocket not available
    }
  }

  disconnect() {
    this.closedManually = true;
    this.activeToken = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
  }
}

export const notificationsClient = new NotificationsClient();
