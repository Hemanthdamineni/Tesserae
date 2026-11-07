/**
 * The single network chokepoint for model files.
 *
 * `createModelFetch` returns a `fetch`-compatible function that the ML runtime
 * is told to use via `env.fetch`. Routing *all* model traffic through here buys
 * four things at once:
 *
 *  1. **Privacy / safety** — any URL whose host is not on the allow-list is
 *     refused before a request is made, so a rogue model id can never exfiltrate
 *     anything or reach an unintended server.
 *  2. **Abort** — the caller's `AbortSignal` is passed to the real `fetch`, so
 *     cancelling actually cancels the network request.
 *  3. **Progress** — byte counts (and `Content-Length` totals) feed the
 *     `ProgressTracker`, including cache hits.
 *  4. **Caching** — successful bodies are written to Cache Storage with
 *     integrity metadata; corrupt entries are evicted by `ModelCache.match`.
 */
import { ToolError } from '../types';
import { throwIfAborted } from './types';
import { contentLength, readBodyWithProgress } from './body';
import { ModelCache, extractSha256 } from './cache';
import type { ProgressTracker } from './progress';
import {
  DEFAULT_ALLOWED_HOSTS,
  DEFAULT_REMOTE_HOST,
  cacheKeyForUrl,
  fileNameFromUrl,
  isAllowedHost,
  parseModelUrl,
} from './urls';

export type ModelFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface ModelFetchOptions {
  /** Cache Storage backend. `null`/omitted disables caching. */
  cache?: ModelCache | null;
  /** Cancels in-flight downloads. */
  signal?: AbortSignal | null;
  /** Receives file-level byte updates. */
  tracker?: ProgressTracker | null;
  /** Hosts allowed to serve model files. Defaults to the HF Hub hosts. */
  allowHosts?: readonly string[];
  /** Same-origin prefixes allowed for runtime assets such as local WASM files. */
  sameOriginPrefixes?: readonly string[];
  /** Host used to recognise `<model>/resolve/<revision>/<file>` URLs. */
  remoteHost?: string;
  /** Serve from cache only; never touch the network. */
  offline?: boolean;
  /** Ignore existing cache entries and re-download. */
  refresh?: boolean;
  /** Override the underlying fetch (tests). */
  fetchImpl?: typeof fetch;
}

function resolveFetch(impl?: typeof fetch): typeof fetch {
  const fn = impl ?? (globalThis as { fetch?: typeof fetch }).fetch;
  if (typeof fn !== 'function') {
    throw new ToolError('Network access is unavailable in this environment.');
  }
  return fn.bind(globalThis) as typeof fetch;
}

function labelFor(url: string, remoteHost: string): string {
  return parseModelUrl(url, remoteHost)?.file ?? fileNameFromUrl(url);
}

async function cachedByteSize(response: Response): Promise<number> {
  const recorded = response.headers.get('x-tesserae-bytes');
  if (recorded && Number.isFinite(Number(recorded))) return Number(recorded);
  const declared = contentLength(response);
  if (declared) return declared;
  try {
    return (await response.clone().blob()).size;
  } catch {
    return 0;
  }
}

/** Build a `fetch` implementation bound to one model load (cache + abort + progress). */
export function createModelFetch(options: ModelFetchOptions = {}): ModelFetch {
  const cache = options.cache ?? null;
  const tracker = options.tracker ?? null;
  const signal = options.signal ?? null;
  const allowHosts = options.allowHosts ?? DEFAULT_ALLOWED_HOSTS;
  const sameOriginPrefixes = options.sameOriginPrefixes ?? [];
  const remoteHost = options.remoteHost ?? DEFAULT_REMOTE_HOST;
  const offline = options.offline ?? false;
  const refresh = options.refresh ?? false;
  const fetchImpl = resolveFetch(options.fetchImpl);

  return async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const localAsset =
      sameOriginPrefixes.length > 0 &&
      (() => {
        try {
          const parsed = new URL(url, globalThis.location?.href ?? 'http://localhost/');
          const origin = globalThis.location?.origin;
          return (
            (!origin || parsed.origin === origin) &&
            sameOriginPrefixes.some((prefix) => parsed.pathname.startsWith(prefix))
          );
        } catch {
          return false;
        }
      })();

    if (!localAsset && !isAllowedHost(url, allowHosts)) {
      let host = url;
      try {
        host = new URL(url).host || url;
      } catch {
        /* keep the raw url as the label */
      }
      throw new ToolError(
        `Blocked a request to "${host}".`,
        `Only ${allowHosts.join(', ')} or approved same-origin assets may be used.`,
      );
    }

    throwIfAborted(signal);
    if (localAsset) {
      return fetchImpl(url, { ...init, signal: signal ?? init?.signal ?? undefined });
    }

    const file = labelFor(url, remoteHost);
    const key = cacheKeyForUrl(url);

    if (cache && !refresh) {
      const hit = await cache.match(key);
      if (hit) {
        tracker?.fileCached(file, await cachedByteSize(hit));
        return hit;
      }
    }

    if (offline) {
      throw new ToolError(
        'This model has not been downloaded yet.',
        'Connect to the internet for the first load — after that it works offline.',
      );
    }

    tracker?.setPhase('downloading', 'Downloading model…');
    const response = await fetchImpl(url, {
      ...init,
      signal: signal ?? init?.signal ?? undefined,
    });

    // Non-200 responses are handed back untouched: transformers.js treats a 404
    // as "optional file absent" and must be able to see the real status.
    if (response.status !== 200) return response;

    const declared = contentLength(response);
    tracker?.fileStarted(file, declared);
    const { blob } = await readBodyWithProgress(
      response,
      (loaded, len) => tracker?.fileProgress(file, loaded, len || declared),
      signal,
    );
    tracker?.fileDone(file, blob.size);

    if (cache) {
      const etag = response.headers.get('x-linked-etag') ?? response.headers.get('etag');
      await cache
        .write(key, blob, {
          url,
          bytes: blob.size,
          sha256: extractSha256(etag),
          contentType: response.headers.get('content-type') ?? undefined,
          storedAt: Date.now(),
        })
        .catch(() => false);
    }

    const headers = new Headers(response.headers);
    headers.set('content-length', String(blob.size));
    return new Response(blob, { status: 200, statusText: response.statusText || 'OK', headers });
  };
}
