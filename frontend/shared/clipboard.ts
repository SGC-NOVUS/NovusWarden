/**
 * Safe cross-browser clipboard copy helper with optional auto-clear timer for secrets.
 *
 * Avoids unhandled `NotAllowedError: Document is not focused` rejections from
 * `navigator.clipboard.writeText` by falling back gracefully to a readonly
 * `<textarea>` + `document.execCommand('copy')`.
 */

const CLIPBOARD_CLEAR_KEY = 'novus_clipboard_clear_sec';
let pendingClearTimer: ReturnType<typeof setTimeout> | null = null;
let lastCopiedSecret: string | null = null;

export function getClipboardClearSeconds(): number {
  if (typeof localStorage === 'undefined') return 30;
  const raw = localStorage.getItem(CLIPBOARD_CLEAR_KEY);
  if (raw === null) return 30;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 30;
}

export function setClipboardClearSeconds(seconds: number): void {
  if (typeof localStorage === 'undefined') return;
  const clamped = Math.max(0, Math.min(600, Math.round(seconds)));
  localStorage.setItem(CLIPBOARD_CLEAR_KEY, String(clamped));
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  const canUseAsyncClipboard =
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.writeText === 'function';

  // Prefer modern Clipboard API when the document currently holds focus
  if (canUseAsyncClipboard && (typeof document === 'undefined' || document.hasFocus())) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }

  // Fallback for unfocused documents (e.g. DevTools open) or blocked Clipboard API
  if (typeof document !== 'undefined' && document.body) {
    let ta: HTMLTextAreaElement | null = null;
    try {
      const prevFocused = document.activeElement as HTMLElement | null;
      ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.focus({ preventScroll: true });
      ta.select();
      ta.setSelectionRange(0, text.length);
      const copied = document.execCommand('copy');
      document.body.removeChild(ta);
      ta = null;
      if (prevFocused && typeof prevFocused.focus === 'function') {
        try {
          prevFocused.focus({ preventScroll: true });
        } catch {
          // Ignore focus restore error
        }
      }
      if (copied) return true;
    } catch {
      if (ta && ta.parentNode) {
        ta.parentNode.removeChild(ta);
      }
    }
  }

  // Final attempt with async Clipboard API even if document.hasFocus() was false
  if (canUseAsyncClipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Copies a sensitive secret (password, TOTP, CVV, SSH private key) and schedules
 * automatic clipboard clearing according to user preference (`novus_clipboard_clear_sec`).
 */
export async function copySecretToClipboard(
  text: string
): Promise<{ ok: boolean; clearAfterSec: number }> {
  const ok = await copyTextToClipboard(text);
  const clearAfterSec = getClipboardClearSeconds();

  if (pendingClearTimer) {
    clearTimeout(pendingClearTimer);
    pendingClearTimer = null;
  }

  if (ok && clearAfterSec > 0) {
    lastCopiedSecret = text;
    pendingClearTimer = setTimeout(async () => {
      pendingClearTimer = null;
      try {
        // Only clear if we still hold the secret or cannot read clipboard
        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
          const current = await navigator.clipboard.readText().catch(() => null);
          if (current !== null && lastCopiedSecret !== null && current !== lastCopiedSecret) {
            return;
          }
        }
        await copyTextToClipboard(' ');
      } catch {
        // Ignore background clear error
      } finally {
        lastCopiedSecret = null;
      }
    }, clearAfterSec * 1000);
  }

  return { ok, clearAfterSec: ok ? clearAfterSec : 0 };
}
