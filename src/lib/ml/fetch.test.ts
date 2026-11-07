import { describe, expect, it, vi } from 'vitest';
import { ToolError } from '../types';
import { ModelCache } from './cache';
import { createModelFetch } from './fetch';
import { ProgressTracker } from './progress';
import { FakeCacheStorage, bytesResponse, installFakeCaches } from '../../../test/ml-fakes';

const URL_OK = 'https://huggingface.co/Xenova/modnet/resolve/main/config.json';

function setup(fetchImpl?: typeof fetch) {
  const storage = new FakeCacheStorage();
  const cache = new ModelCache({ cacheStorage: storage });
  const tracker = new ProgressTracker();
  const fetchFn = createModelFetch({ cache, tracker, fetchImpl });
  return { storage, cache, tracker, fetchFn };
}

describe('createModelFetch', () => {
  it('refuses hosts outside the allow-list before any request is made', async () => {
    const impl = vi.fn();
    const { fetchFn } = setup(impl as unknown as typeof fetch);
    await expect(fetchFn('https://evil.test/steal')).rejects.toThrow(ToolError);
    await expect(fetchFn('https://evil.test/steal')).rejects.toThrow(/Blocked/i);
    expect(impl).not.toHaveBeenCalled();
  });

  it('allows approved same-origin runtime assets without treating them as model files', async () => {
    const impl = vi.fn(async () => new Response('wasm', { status: 200 }));
    const { cache, tracker } = setup(impl as unknown as typeof fetch);
    const fetchFn = createModelFetch({
      cache,
      tracker,
      sameOriginPrefixes: ['/vendor/onnxruntime/'],
      fetchImpl: impl as unknown as typeof fetch,
    });
    await fetchFn('/vendor/onnxruntime/runtime.wasm', { headers: { 'x-test': '1' } });
    expect(impl).toHaveBeenCalledOnce();
  });

  it('serves a cache hit without touching the network and reports it as cached', async () => {
    const { storage, cache, tracker } = setup();
    const bucket = await storage.open(ModelCache.defaultName);
    bucket.seedRaw(URL_OK, bytesResponse(new TextEncoder().encode('{"cached":true}')));

    const impl = vi.fn();
    const fetchFn = createModelFetch({
      cache,
      tracker,
      fetchImpl: impl as unknown as typeof fetch,
    });
    const res = await fetchFn(URL_OK);

    expect(impl).not.toHaveBeenCalled();
    expect(await res.text()).toBe('{"cached":true}');
    expect(tracker.cachedBytes).toBeGreaterThan(0);
    expect(tracker.networkBytes).toBe(0);
    expect(tracker.snapshot().files[0]?.cached).toBe(true);
  });

  it('downloads, reports progress, and writes to the cache on a miss', async () => {
    const { cache, tracker } = setup();
    const body = new TextEncoder().encode('{"hidden_size":8}');
    const impl = vi.fn(async () => bytesResponse(body));
    const fetchFn = createModelFetch({
      cache,
      tracker,
      fetchImpl: impl as unknown as typeof fetch,
    });

    const res = await fetchFn(URL_OK);
    expect(await res.text()).toBe('{"hidden_size":8}');
    expect(impl).toHaveBeenCalledOnce();
    expect(tracker.networkBytes).toBe(body.byteLength);
    expect(tracker.currentPhase).toBe('downloading');

    // Second call is served from the cache written by the first.
    await fetchFn(URL_OK);
    expect(impl).toHaveBeenCalledOnce();
    await expect(cache.match(URL_OK)).resolves.toBeDefined();
  });

  it('forwards request headers to the underlying fetch', async () => {
    const { cache, tracker } = setup();
    const impl = vi.fn(async (_url: string, _init?: RequestInit) =>
      bytesResponse(new Uint8Array([1])),
    );
    const fetchFn = createModelFetch({
      cache,
      tracker,
      fetchImpl: impl as unknown as typeof fetch,
    });
    await fetchFn(URL_OK, { headers: { 'x-test': '1' } });
    expect(impl.mock.calls[0]?.[1]?.headers).toEqual({ 'x-test': '1' });
  });

  it('passes a non-200 response straight through (transformers.js treats 404s as absent)', async () => {
    const { cache, tracker } = setup();
    const impl = vi.fn(async () => new Response(null, { status: 404 }));
    const fetchFn = createModelFetch({
      cache,
      tracker,
      fetchImpl: impl as unknown as typeof fetch,
    });

    const res = await fetchFn(URL_OK);
    expect(res.status).toBe(404);
    await expect(cache.match(URL_OK)).resolves.toBeUndefined();
  });

  it('refuses to touch the network when offline and the file is not cached', async () => {
    const { cache, tracker } = setup();
    const impl = vi.fn();
    const fetchFn = createModelFetch({
      cache,
      tracker,
      offline: true,
      fetchImpl: impl as unknown as typeof fetch,
    });
    await expect(fetchFn(URL_OK)).rejects.toThrow(/has not been downloaded/i);
    expect(impl).not.toHaveBeenCalled();
  });

  it('re-downloads when refresh bypasses an existing cache entry', async () => {
    const { storage, cache, tracker } = setup();
    const bucket = await storage.open(ModelCache.defaultName);
    bucket.seedRaw(URL_OK, bytesResponse(new TextEncoder().encode('["old"]')));

    const impl = vi.fn(async () => bytesResponse(new TextEncoder().encode('["new"]')));
    const fetchFn = createModelFetch({
      cache,
      tracker,
      refresh: true,
      fetchImpl: impl as unknown as typeof fetch,
    });

    const res = await fetchFn(URL_OK);
    expect(await res.text()).toBe('["new"]');
    expect(impl).toHaveBeenCalledOnce();
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const { cache, tracker } = setup();
    const controller = new AbortController();
    controller.abort();
    const fetchFn = createModelFetch({ cache, tracker, signal: controller.signal });
    await expect(fetchFn(URL_OK)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('stops mid-download when aborted', async () => {
    const { cache } = setup();
    const controller = new AbortController();
    const tracker = new ProgressTracker();
    const body = new TextEncoder().encode('partial');
    const impl = async (): Promise<Response> => {
      queueMicrotask(() => controller.abort());
      return bytesResponse(body);
    };
    const fetchFn = createModelFetch({
      cache,
      tracker,
      signal: controller.signal,
      fetchImpl: impl as unknown as typeof fetch,
    });

    await expect(fetchFn(URL_OK)).rejects.toMatchObject({ name: 'AbortError' });
    await expect(cache.match(URL_OK)).resolves.toBeUndefined();
  });

  it('works with the process-wide caches global', async () => {
    const fake = installFakeCaches();
    try {
      const cache = new ModelCache();
      expect(cache.available).toBe(true);
      const tracker = new ProgressTracker();
      const impl = vi.fn(async () => bytesResponse(new TextEncoder().encode('hi')));
      const fetchFn = createModelFetch({
        cache,
        tracker,
        fetchImpl: impl as unknown as typeof fetch,
      });
      const res = await fetchFn(URL_OK);
      expect(await res.text()).toBe('hi');
      expect(fake.storage.buckets.has(ModelCache.defaultName)).toBe(true);
    } finally {
      fake.restore();
    }
  });
});
