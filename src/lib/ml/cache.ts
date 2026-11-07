/**
 * Cache Storage backend for model files.
 *
 * Model weights are large and immutable per revision, so they are cached in the
 * browser's Cache Storage (the same store the PWA uses) under a dedicated,
 * versioned cache. On every read the entry is validated — byte length, JSON
 * well-formedness, and (when a SHA-256 is known) the content digest — and a
 * corrupt entry is evicted and reported as a *miss*, so callers transparently
 * re-download instead of loading garbage into the ONNX session.
 *
 * Structural `CacheStorageLike` interfaces are used so tests can inject an
 * in-memory fake and so the module stays SSR-safe.
 */
import type { CachedFileMeta, CacheVerifyMode, CorruptEntryReport } from './types';
import { contentLength, readBodyWithProgress } from './body';

/** Subset of the Web Cache API this module relies on. */
export interface CacheLike {
  match(request: string | Request): Promise<Response | undefined>;
  put(request: string | Request, response: Response): Promise<void>;
  delete(request: string | Request): Promise<boolean>;
  keys(): Promise<Request[]>;
}

/** Subset of the `CacheStorage` API this module relies on. */
export interface CacheStorageLike {
  open(name: string): Promise<CacheLike>;
  delete(name: string): Promise<boolean>;
  has(name: string): Promise<boolean>;
  keys(): Promise<string[]>;
}

export const BYTES_HEADER = 'x-tesserae-bytes';
export const SHA256_HEADER = 'x-tesserae-sha256';
export const URL_HEADER = 'x-tesserae-url';
export const STORED_HEADER = 'x-tesserae-stored-at';

/** Default cap for digest verification of a single cached entry. */
export const DEFAULT_DIGEST_LIMIT = 64 * 1024 * 1024; // 64 MiB

export interface ModelCacheOptions {
  /** Cache Storage bucket name. */
  cacheName?: string;
  /** Injected storage (tests); defaults to `globalThis.caches`. */
  cacheStorage?: CacheStorageLike | null;
  /**
   * Verification strength on read. `'size'` is cheap; `'digest'` additionally
   * re-hashes entries up to `digestLimitBytes`; `'none'` trusts the browser.
   */
  verify?: CacheVerifyMode;
  /** Entries larger than this skip digest verification. */
  digestLimitBytes?: number;
  /** Called when an entry fails validation and is evicted. */
  onCorrupt?: (report: CorruptEntryReport) => void;
  /** Called for non-fatal storage problems (e.g. quota exceeded). */
  onWarning?: (message: string) => void;
}

/** Whether `crypto.subtle` is usable here. */
function hasSubtle(): boolean {
  try {
    return typeof crypto !== 'undefined' && !!crypto.subtle;
  } catch {
    return false;
  }
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += (bytes[i] as number).toString(16).padStart(2, '0');
  return out;
}

/** Extract a lower-case SHA-256 hex digest from an `ETag`/`x-linked-etag` value. */
export function extractSha256(etag: string | null | undefined): string | undefined {
  if (!etag) return undefined;
  const cleaned = etag.trim().replace(/^W\//i, '').replace(/^"|"$/g, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(cleaned) ? cleaned : undefined;
}

/** Whether an entry should be JSON-validated (catches truncated config/tokenizer files). */
export function isJsonEntry(key: string, contentType?: string | null): boolean {
  if (contentType && /json/i.test(contentType)) return true;
  const path = key.split(/[?#]/, 1)[0] ?? key;
  return /\.json$/i.test(path);
}

/** Whether an error from Cache Storage means the storage quota is exhausted. */
export function isQuotaExceeded(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === 'QuotaExceededError' || code === 22;
}

/** Hex SHA-256 of a blob, or `undefined` when `crypto.subtle` is unavailable. */
export async function digestBlob(blob: Blob): Promise<string | undefined> {
  if (!hasSubtle()) return undefined;
  try {
    const buffer = await blob.arrayBuffer();
    return toHex(await crypto.subtle.digest('SHA-256', buffer));
  } catch {
    return undefined;
  }
}

function defaultStorage(): CacheStorageLike | null {
  const globalCaches = (globalThis as unknown as { caches?: CacheStorageLike }).caches;
  return globalCaches ?? null;
}

export class ModelCache {
  /** Versioned bucket name — bump the suffix to invalidate every cached model. */
  static readonly defaultName = 'tesserae-ml-v1';

  private readonly cacheName: string;
  private readonly storage: CacheStorageLike | null;
  private readonly verify: CacheVerifyMode;
  private readonly digestLimit: number;
  private readonly onCorrupt: ((report: CorruptEntryReport) => void) | undefined;
  private readonly onWarning: ((message: string) => void) | undefined;

  constructor(options: ModelCacheOptions = {}) {
    this.cacheName = options.cacheName ?? ModelCache.defaultName;
    this.storage = options.cacheStorage === undefined ? defaultStorage() : options.cacheStorage;
    this.verify = options.verify ?? 'digest';
    this.digestLimit = options.digestLimitBytes ?? DEFAULT_DIGEST_LIMIT;
    this.onCorrupt = options.onCorrupt;
    this.onWarning = options.onWarning;
  }

  get name(): string {
    return this.cacheName;
  }

  /** Whether Cache Storage is available in this environment. */
  static isAvailable(storage: CacheStorageLike | null = defaultStorage()): boolean {
    return !!storage;
  }

  /** Whether this instance can actually persist (false in a non-browser/test env). */
  get available(): boolean {
    return !!this.storage;
  }

  private async open(): Promise<CacheLike | null> {
    if (!this.storage) return null;
    try {
      return await this.storage.open(this.cacheName);
    } catch {
      this.onWarning?.('Model cache could not be opened; downloads will not be cached.');
      return null;
    }
  }

  /**
   * Read a validated entry. Returns `undefined` on a miss *and* on a corrupt
   * entry (which is evicted first), so the caller always re-fetches on doubt.
   */
  async match(key: string): Promise<Response | undefined> {
    const cache = await this.open();
    if (!cache) return undefined;
    let stored: Response | undefined;
    try {
      stored = await cache.match(key);
    } catch {
      return undefined;
    }
    if (!stored) return undefined;

    if (this.verify === 'none') return stored;

    const check = await this.validate(key, stored);
    if (check.ok) return check.response;

    await this.delete(key).catch(() => undefined);
    this.onCorrupt?.({ key, reason: check.reason });
    return undefined;
  }

  /** Cheap existence check that still validates the entry. */
  async has(key: string): Promise<boolean> {
    return (await this.match(key)) !== undefined;
  }

  /**
   * Store a blob with integrity metadata. Returns `false` (without throwing)
   * when storage is unavailable or the quota is exceeded, so a load can still
   * succeed uncached.
   */
  async write(key: string, blob: Blob, meta: CachedFileMeta): Promise<boolean> {
    const cache = await this.open();
    if (!cache) return false;

    const headers = new Headers();
    if (meta.contentType) headers.set('content-type', meta.contentType);
    headers.set(BYTES_HEADER, String(meta.bytes));
    headers.set(URL_HEADER, meta.url);
    headers.set(STORED_HEADER, String(meta.storedAt));
    if (meta.sha256) headers.set(SHA256_HEADER, meta.sha256);
    // Surface byte length as Content-Length for consumers that read it.
    headers.set('content-length', String(meta.bytes));

    const response = new Response(blob, { status: 200, statusText: 'OK', headers });
    try {
      await cache.put(key, response);
      return true;
    } catch (error) {
      if (isQuotaExceeded(error)) {
        this.onWarning?.(
          'The browser storage quota is full, so this model will not be cached for next time.',
        );
        return false;
      }
      throw error;
    }
  }

  /**
   * Cache-API compatible writer (the shape transformers.js expects from
   * `env.customCache`): reads `response` fully, reporting progress, then stores
   * it with derived integrity metadata.
   */
  async put(
    key: string,
    response: Response,
    onProgress?: (data: { progress: number; loaded: number; total: number }) => void,
  ): Promise<void> {
    const declared = contentLength(response);
    const { blob, total } = await readBodyWithProgress(response, (loaded, len) => {
      const expected = len || declared || 0;
      onProgress?.({
        progress: expected ? (loaded / expected) * 100 : 0,
        loaded,
        total: expected,
      });
    });
    const etag = response.headers.get('x-linked-etag') ?? response.headers.get('etag');
    await this.write(key, blob, {
      url: response.headers.get(URL_HEADER) ?? key,
      bytes: blob.size,
      sha256: extractSha256(etag),
      contentType: response.headers.get('content-type') ?? undefined,
      storedAt: Date.now(),
    }).catch(() => false);
    onProgress?.({ progress: 100, loaded: total || blob.size, total: total || blob.size });
  }

  async delete(key: string): Promise<boolean> {
    const cache = await this.open();
    if (!cache) return false;
    try {
      return await cache.delete(key);
    } catch {
      return false;
    }
  }

  /** Remove every entry in this module's cache bucket. */
  async clear(): Promise<void> {
    if (!this.storage) return;
    try {
      await this.storage.delete(this.cacheName);
    } catch {
      this.onWarning?.('The model cache could not be cleared.');
    }
  }

  /** Cache keys currently stored. */
  async list(): Promise<string[]> {
    const cache = await this.open();
    if (!cache) return [];
    try {
      const requests = await cache.keys();
      return requests.map((r) => r.url);
    } catch {
      return [];
    }
  }

  /** Total bytes currently stored. */
  async usage(): Promise<number> {
    const cache = await this.open();
    if (!cache) return 0;
    let total = 0;
    try {
      for (const request of await cache.keys()) {
        const res = await cache.match(request);
        if (!res) continue;
        const recorded = res.headers.get(BYTES_HEADER);
        total += recorded ? Number(recorded) || 0 : (await res.clone().blob()).size;
      }
    } catch {
      return total;
    }
    return total;
  }

  /** Validate a stored entry against its recorded metadata. */
  private async validate(
    key: string,
    stored: Response,
  ): Promise<{ ok: true; response: Response } | { ok: false; reason: string }> {
    let blob: Blob;
    try {
      blob = await stored.blob();
    } catch {
      return { ok: false, reason: 'stored body could not be read' };
    }

    const recorded = stored.headers.get(BYTES_HEADER);
    if (recorded !== null && Number(recorded) !== blob.size) {
      return { ok: false, reason: `byte length ${blob.size} does not match recorded ${recorded}` };
    }

    if (isJsonEntry(key, stored.headers.get('content-type'))) {
      try {
        JSON.parse(await blob.text());
      } catch {
        return { ok: false, reason: 'stored JSON is not parseable' };
      }
    }

    const sha = stored.headers.get(SHA256_HEADER);
    if (this.verify === 'digest' && sha && blob.size <= this.digestLimit) {
      const actual = await digestBlob(blob);
      if (actual && actual !== sha) {
        return { ok: false, reason: `SHA-256 mismatch (expected ${sha})` };
      }
    }

    return { ok: true, response: new Response(blob, { status: 200, headers: stored.headers }) };
  }
}
