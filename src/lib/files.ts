/** Browser-only file I/O helpers. Never import from a `.tool.ts` that must stay pure. */

export const MAX_FILE_COUNT = 20;

export function validateFileSelection(files: File[]): string | null {
  if (files.length > MAX_FILE_COUNT) return `Choose at most ${MAX_FILE_COUNT} files.`;
  return null;
}

function readWith<T>(
  start: (reader: FileReader) => void,
  map: (result: FileReader['result']) => T,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => {
      reader.abort();
      reject(new DOMException('The file read was cancelled.', 'AbortError'));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    const cleanup = () => signal?.removeEventListener('abort', abort);
    reader.onload = () => {
      cleanup();
      resolve(map(reader.result));
    };
    reader.onerror = () => {
      cleanup();
      reject(reader.error ?? new Error('Failed to read file'));
    };
    reader.onabort = () => {
      cleanup();
      reject(new DOMException('The file read was cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    start(reader);
  });
}

export function readAsText(file: Blob, encoding = 'utf-8', signal?: AbortSignal): Promise<string> {
  return readWith((reader) => reader.readAsText(file, encoding), String, signal);
}

export function readAsArrayBuffer(file: Blob, signal?: AbortSignal): Promise<ArrayBuffer> {
  return readWith(
    (reader) => reader.readAsArrayBuffer(file),
    (result) => result as ArrayBuffer,
    signal,
  );
}

export function readAsDataURL(file: Blob, signal?: AbortSignal): Promise<string> {
  return readWith((reader) => reader.readAsDataURL(file), String, signal);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(text: string, filename: string, type = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}

/**
 * Make output filenames safe to use as ZIP entry keys: strip any directory
 * components (so `../x`, `/x` and `a/../b` cannot escape or nest unexpectedly)
 * and de-duplicate collisions instead of silently overwriting an earlier entry.
 */
export function sanitizeZipEntryNames(names: string[]): string[] {
  const used = new Map<string, number>();
  return names.map((raw) => {
    const base =
      String(raw)
        .replace(/\\/g, '/')
        .split('/')
        .filter((part) => part && part !== '.' && part !== '..')
        .pop() ?? '';
    const name = base || 'file';
    const seen = used.get(name) ?? 0;
    used.set(name, seen + 1);
    if (seen === 0) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)}-${seen + 1}${name.slice(dot)}` : `${name}-${seen + 1}`;
  });
}

/** Bundle multiple outputs into a .zip (fflate is loaded lazily). */
export async function downloadZip(
  files: { filename: string; blob: Blob }[],
  zipName: string,
): Promise<void> {
  const { zip } = await import('fflate');
  const names = sanitizeZipEntryNames(files.map((f) => f.filename));
  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < files.length; i++) {
    entries[names[i]!] = new Uint8Array(await files[i]!.blob.arrayBuffer());
  }
  const packed: Uint8Array = await new Promise((resolve, reject) => {
    zip(entries, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)));
  });
  const part = packed.slice() as unknown as BlobPart;
  downloadBlob(new Blob([part], { type: 'application/zip' }), zipName);
}

export interface DropZoneHandle {
  destroy(): void;
}

/**
 * Wire an element for drag-and-drop + click-to-pick. Returns a handle to detach.
 */
export function createDropZone(
  el: HTMLElement,
  opts: {
    accept?: string;
    multiple?: boolean;
    onFiles: (files: File[]) => void;
    dragClass?: string;
  },
): DropZoneHandle {
  const dragClass = opts.dragClass ?? 'is-dragging';
  const input = document.createElement('input');
  input.type = 'file';
  input.hidden = true;
  if (opts.accept) input.accept = opts.accept;
  if (opts.multiple) input.multiple = true;
  el.appendChild(input);

  const emit = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    opts.onFiles(Array.from(list));
  };

  const onClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a,button')) return;
    input.click();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  };
  const onChange = () => {
    emit(input.files);
    input.value = '';
  };
  const stop = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onEnter = (e: DragEvent) => {
    stop(e);
    el.classList.add(dragClass);
  };
  const onLeave = (e: DragEvent) => {
    stop(e);
    if (e.target === el) el.classList.remove(dragClass);
  };
  const onDrop = (e: DragEvent) => {
    stop(e);
    el.classList.remove(dragClass);
    emit(e.dataTransfer?.files ?? null);
  };

  el.addEventListener('click', onClick);
  el.addEventListener('keydown', onKey);
  input.addEventListener('change', onChange);
  el.addEventListener('dragenter', onEnter);
  el.addEventListener('dragover', onEnter);
  el.addEventListener('dragleave', onLeave);
  el.addEventListener('drop', onDrop);

  return {
    destroy() {
      el.removeEventListener('click', onClick);
      el.removeEventListener('keydown', onKey);
      input.removeEventListener('change', onChange);
      el.removeEventListener('dragenter', onEnter);
      el.removeEventListener('dragover', onEnter);
      el.removeEventListener('dragleave', onLeave);
      el.removeEventListener('drop', onDrop);
      input.remove();
    },
  };
}
