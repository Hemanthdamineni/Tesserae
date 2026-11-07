import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '../types';
import { ModelCache } from './cache';
import type { ModelFetch } from './fetch';
import { HF_PATH_TEMPLATE, modelFileUrl } from './urls';
import {
  estimateDownloadSize,
  loadModel,
  setMlRuntimeLoader,
  type MlRuntime,
  type MlRuntimeEnv,
} from './loader';
import { FakeCacheStorage, bytesResponse, withNavigatorGpu } from '../../../test/ml-fakes';

interface RuntimeHarness {
  runtime: MlRuntime;
  calls: { task: string; model: string; options: Record<string, unknown> }[];
  env: MlRuntimeEnv;
  fetched: string[];
}

function makeRuntime(options: { failWebgpu?: boolean } = {}): RuntimeHarness {
  const calls: RuntimeHarness['calls'] = [];
  const fetched: string[] = [];
  const env: MlRuntimeEnv = {
    allowLocalModels: true,
    allowRemoteModels: true,
    useBrowserCache: true,
    useCustomCache: false,
    customCache: null,
    backends: { onnx: { wasm: {} } },
    remoteHost: 'https://example.invalid/',
    remotePathTemplate: '',
    fetch: (async () => new Response()) as ModelFetch,
  };
  const runtime: MlRuntime = {
    env,
    async pipeline(task, model, pipelineOptions) {
      const opts = pipelineOptions ?? {};
      calls.push({ task, model, options: opts });
      if (options.failWebgpu && opts.device === 'webgpu') throw new Error('GPU adapter lost');
      // Simulate transformers.js loading one model file through env.fetch.
      const url = modelFileUrl(model, 'config.json', String(opts.revision ?? 'main'));
      fetched.push(url);
      const res = await env.fetch(url, { headers: new Headers() });
      if (res.status !== 200) throw new Error(`missing file: ${url}`);
      return { tag: `${task}:${model}:${String(opts.device)}` };
    },
  };
  return { runtime, calls, env, fetched };
}

function harness(options: { failWebgpu?: boolean } = {}) {
  const storage = new FakeCacheStorage();
  const cache = new ModelCache({ cacheStorage: storage });
  const rt = makeRuntime(options);
  setMlRuntimeLoader(() => Promise.resolve(rt.runtime));
  const fetchImpl = vi.fn(async () => bytesResponse(new TextEncoder().encode('{"ok":true}')));
  return { storage, cache, rt, fetchImpl };
}

afterEach(() => {
  setMlRuntimeLoader(null);
});

describe('loadModel', () => {
  it('rejects a model that is not on the licence allow-list before loading the runtime', async () => {
    const loader = vi.fn();
    setMlRuntimeLoader(loader);
    await expect(
      loadModel({ task: 'image-segmentation', model: 'briaai/RMBG-1.4' }),
    ).rejects.toThrow(ToolError);
    expect(loader).not.toHaveBeenCalled();
  });

  it('selects WASM in a browser without WebGPU and configures the runtime env', async () => {
    const { cache, rt, fetchImpl } = harness();

    const loaded = await loadModel({
      task: 'image-segmentation',
      model: 'Xenova/modnet',
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(loaded.backend).toBe('wasm');
    expect(loaded.requestedBackend).toBe('auto');
    expect(loaded.fellBack).toBe(false);
    expect(loaded.dtype).toBe('q8');
    expect(loaded.pipeline).toEqual({ tag: 'image-segmentation:Xenova/modnet:wasm' });
    expect(loaded.fromCache).toBe(false);

    expect(rt.env.allowLocalModels).toBe(false);
    expect(rt.env.allowRemoteModels).toBe(true);
    expect(rt.env.useBrowserCache).toBe(false);
    expect(rt.env.useCustomCache).toBe(false);
    expect(rt.env.remotePathTemplate).toBe(HF_PATH_TEMPLATE);
    expect(typeof rt.env.fetch).toBe('function');
  });
  it('configures the same-origin ONNX runtime assets', async () => {
    const { cache, rt, fetchImpl } = harness();
    await loadModel({
      task: 'image-segmentation',
      model: 'Xenova/modnet',
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(rt.env.backends?.onnx?.wasm?.wasmPaths?.mjs).toMatch(
      /vendor\/onnxruntime\/ort-wasm-simd-threaded\.asyncify\.mjs$/,
    );
    expect(rt.env.backends?.onnx?.wasm?.wasmPaths?.wasm).toMatch(
      /vendor\/onnxruntime\/ort-wasm-simd-threaded\.asyncify\.wasm$/,
    );
  });

  it('prefers WebGPU when an adapter is available and uses fp16', async () => {
    const { cache, fetchImpl } = harness();
    const loaded = await withNavigatorGpu({ requestAdapter: async () => ({}) }, () =>
      loadModel({
        task: 'image-segmentation',
        model: 'Xenova/modnet',
        cache,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    );
    expect(loaded.backend).toBe('webgpu');
    expect(loaded.dtype).toBe('fp16');
  });

  it('flags a fallback when WebGPU is explicitly requested but unavailable', async () => {
    const { cache, fetchImpl } = harness();
    const loaded = await loadModel({
      task: 'image-segmentation',
      model: 'Xenova/modnet',
      backend: 'webgpu',
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(loaded.backend).toBe('wasm');
    expect(loaded.fellBack).toBe(true);
  });

  it('retries on WASM when the GPU session fails at runtime', async () => {
    const { cache, fetchImpl, rt } = harness({ failWebgpu: true });
    const loaded = await withNavigatorGpu({ requestAdapter: async () => ({}) }, () =>
      loadModel({
        task: 'image-segmentation',
        model: 'Xenova/modnet',
        cache,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    );

    expect(loaded.backend).toBe('wasm');
    expect(loaded.fellBack).toBe(true);
    expect(rt.calls.map((c) => c.options.device)).toEqual(['webgpu', 'wasm']);
  });

  it('reports download progress and then a ready phase', async () => {
    const { cache, fetchImpl } = harness();
    const phases: string[] = [];
    await loadModel({
      task: 'image-segmentation',
      model: 'Xenova/modnet',
      cache,
      progressThrottleMs: 0,
      onProgress: (p) => phases.push(p.phase),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(phases).toContain('resolving');
    expect(phases).toContain('downloading');
    expect(phases).toContain('initializing');
    expect(phases.at(-1)).toBe('ready');
  });

  it('serves repeat loads from Cache Storage', async () => {
    const { cache, fetchImpl } = harness();
    const first = await loadModel({
      task: 'image-segmentation',
      model: 'Xenova/modnet',
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(first.fromCache).toBe(false);

    const second = await loadModel({
      task: 'image-segmentation',
      model: 'Xenova/modnet',
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(second.fromCache).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('loads offline from a warm cache but refuses a cold one', async () => {
    const storage = new FakeCacheStorage();
    const cache = new ModelCache({ cacheStorage: storage });
    const url = modelFileUrl('Xenova/modnet', 'config.json');
    await cache.write(url, new Blob(['{"ok":true}']), { url, bytes: 11, storedAt: 1 });

    const rt = makeRuntime();
    setMlRuntimeLoader(() => Promise.resolve(rt.runtime));

    await expect(
      loadModel({
        task: 'image-segmentation',
        model: 'Xenova/modnet',
        cache,
        offline: true,
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).resolves.toMatchObject({ fromCache: true });

    // Offline is enforced by our fetch, not by disabling remote models in the
    // runtime — that way a cold offline load fails with a friendly message.
    expect(rt.env.allowRemoteModels).toBe(true);
    expect(rt.env.allowLocalModels).toBe(false);

    await expect(
      loadModel({
        task: 'image-segmentation',
        model: 'Xenova/whisper-base',
        cache,
        offline: true,
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/has not been downloaded/i);
  });

  it('rethrows aborts and wraps unexpected runtime errors', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadModel({ task: 'x', model: 'Xenova/modnet', signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    const rt = makeRuntime();
    rt.runtime.pipeline = async () => {
      throw new Error('onnx runtime exploded');
    };
    setMlRuntimeLoader(() => Promise.resolve(rt.runtime));
    await expect(
      loadModel({ task: 'x', model: 'Xenova/modnet', backend: 'wasm', cache: null }),
    ).rejects.toThrow(/Could not load the model "Xenova\/modnet"/);
  });

  it('exposes a best-effort dispose', async () => {
    const { cache, fetchImpl } = harness();
    const dispose = vi.fn();
    const loaded = await loadModel({
      task: 'image-segmentation',
      model: 'Xenova/modnet',
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    (loaded.pipeline as { dispose?: () => void }).dispose = dispose;
    await loaded.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
});

describe('estimateDownloadSize', () => {
  it('sums known sizes, reuses the cache and tolerates unknown/blocked files', async () => {
    const storage = new FakeCacheStorage();
    const cache = new ModelCache({ cacheStorage: storage });
    const cachedUrl = modelFileUrl('Xenova/modnet', 'cached.bin');
    await cache.write(cachedUrl, new Blob([new Uint8Array(500)]), {
      url: cachedUrl,
      bytes: 500,
      storedAt: 1,
    });

    const openUrl = modelFileUrl('Xenova/modnet', 'open.bin');
    const failUrl = modelFileUrl('Xenova/modnet', 'fail.bin');
    const blockedUrl = 'https://evil.test/nope.bin';

    const fetchImpl = vi.fn(async (url: string) => {
      if (url === openUrl)
        return new Response(null, { status: 200, headers: { 'content-length': '1000' } });
      if (url === failUrl) return new Response(null, { status: 500 });
      return new Response(null, { status: 404 });
    });

    const estimate = await estimateDownloadSize([cachedUrl, openUrl, failUrl, blockedUrl], {
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(estimate.total).toBe(1500);
    expect(estimate.known).toBe(2);
    expect(estimate.unknown).toBe(2);
    expect(estimate.files.find((f) => f.url === cachedUrl)).toMatchObject({
      cached: true,
      size: 500,
    });
    expect(estimate.files.find((f) => f.url === blockedUrl)).toMatchObject({ size: null });
    expect(fetchImpl).not.toHaveBeenCalledWith(blockedUrl, expect.anything());
  });

  it('returns a zero estimate for an empty file list', async () => {
    await expect(estimateDownloadSize([], { cache: null })).resolves.toEqual({
      total: 0,
      known: 0,
      unknown: 0,
      files: [],
    });
  });
});
