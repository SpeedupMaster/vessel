/**
 * Copy text to the clipboard. The async Clipboard API only exists in secure contexts, and the
 * dashboard is usually opened over plain HTTP (http://<server-ip>:3900), so fall back to
 * a hidden textarea and execCommand('copy') there.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or document not focused; try the legacy path
    }
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  const previous = document.activeElement as HTMLElement | null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  // Inside an open dialog so a focus trap does not pull focus away before the copy
  const host = previous?.closest('[role="dialog"]') ?? document.body;
  host.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  host.removeChild(textarea);
  previous?.focus?.({ preventScroll: true });
  return ok;
}
