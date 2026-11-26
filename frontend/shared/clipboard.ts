/**
 * Safe cross-browser clipboard copy helper.
 *
 * Avoids unhandled `NotAllowedError: Document is not focused` rejections from
 * `navigator.clipboard.writeText` (e.g. when DevTools is focused or browser
 * extension scriptlets proxy the Clipboard API) by falling back gracefully to
 * a temporary readonly `<textarea>` + `document.execCommand('copy')`.
 */
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
