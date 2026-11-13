/** Copy text to the clipboard with a legacy fallback. Returns success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function readClipboardText(): Promise<string | null> {
  try {
    if (navigator.clipboard?.readText && window.isSecureContext) {
      return await navigator.clipboard.readText();
    }
  } catch {
    /* permission denied or unsupported */
  }
  return null;
}

/**
 * Read image files pasted into the page (Ctrl/⌘+V) or copied from a file
 * manager. Returns the files, or an empty array when the clipboard holds no
 * image content. Browsers only expose image data via the async clipboard API;
 * other file types are still reachable through a normal paste into a text
 * field or the drop zone.
 */
export async function readClipboardFiles(): Promise<File[]> {
  try {
    if (!navigator.clipboard?.read || !window.isSecureContext) return [];
    const items = await navigator.clipboard.read();
    const files: File[] = [];
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          files.push(new File([blob], clipboardFileName(type), { type }));
        }
      }
    }
    return files;
  } catch {
    /* permission denied, unsupported, or the document is not focused */
    return [];
  }
}

/** A reasonable filename for an image pasted from the clipboard. */
function clipboardFileName(type: string): string {
  const ext = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
  return `clipboard.${ext}`;
}
