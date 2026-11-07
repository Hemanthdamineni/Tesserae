/**
 * `loadModel()` — the public entry point of the ML runtime loader.
 *
 * Responsibilities, in order:
 *  1. Enforce the model-licence allow-list (`assertAllowedModel`).
 *  2. Choose WebGPU or WASM (with a clean CPU retry if a GPU session fails).
 *  3. Dynamically `import('@huggingface/transformers')` on first use — the whole
 *     runtime is far too large to sit in the main bundle.
 *  4. Point the runtime at our cache-aware, abort-aware `ModelFetch`.
 *  5. Report download size + progress and return a disposable pipeline.
 *
 * Nothing here uploads user data: the only network traffic is model files from
 * the permitted host, fetched through `createModelFetch`.
 */
import { ToolError } from '../types';
import { isAbortError, throwIfAborted } from './types';
import type { LoadProgress, MlBackend, MlBackendPreference } from './types';
import { resolveBackend, resolveDtype, webGpuAvailable } from './backend';
import type { Dtype } from './backend';
import type { ModelLicenseEntry } from './licenses';
import { assertAllowedModel } from './licenses';
import { ModelCache } from './cache';
import { createModelFetch } from './fetch';
import type { ModelFetch } from './fetch';
import { ProgressTracker, throttleProgress } from './progress';
import {
  DEFAULT_ALLOWED_HOSTS,
  DEFAULT_REMOTE_HOST,
  DEFAULT_REVISION,
  HF_PATH_TEMPLATE,
  cacheKeyForUrl,
  isAllowedHost,
} from './urls';

/** The subset of transformers.js's `env` we configure. */
export interface MlRuntimeEnv {
  allowLocalModels: boolean;
  allowRemoteModels: boolean;
  useBrowserCache: boolean;
  useCustomCache: boolean;
  customCache: unknown;
  useWasmCache?: boolean;
  backends?: {
    onnx?: {
      wasm?: { wasmPaths?: { mjs: string; wasm: string }; proxy?: boolean };
    };
  };
  remoteHost: string;
  remotePathTemplate: string;
  fetch: ModelFetch;
}

/** Same-origin ONNX WASM assets, resolved against the deployed site base path. */
const LOCAL_ONNX_WASM_BASE = `${import.meta.env.BASE_URL}vendor/onnxruntime/`;

function configureOnnxWasm(runtime: MlRuntime): void {
  const onnx = runtime.env.backends?.onnx;
  if (!onnx?.wasm) return;
  onnx.wasm.wasmPaths = {
    mjs: `${LOCAL_ONNX_WASM_BASE}ort-wasm-simd-threaded.asyncify.mjs`,
    wasm: `${LOCAL_ONNX_WASM_BASE}ort-wasm-simd-threaded.asyncify.wasm`,
  };
  runtime.env.useWasmCache = true;
}

/** The subset of the transformers.js module the loader uses. */
export interface MlRuntime {
  env: MlRuntimeEnv;
  pipeline(task: string, model: string, options?: Record<string, unknown>): Promise<unknown>;
}

/** Loads the runtime module. Overridable in tests. */
export type MlRuntimeLoader = () => Promise<MlRuntime>;

/**
 * Default loader: a dynamic import, evaluated only when a model is first loaded.
 * This is what keeps transformers.js / onnxruntime-web out of the main bundle.
 */
async function defaultRuntimeLoader(): Promise<MlRuntime> {
  const mod = (await import('@huggingface/transformers')) as unknown as MlRuntime;
  return mod;
}

let runtimeLoader: MlRuntimeLoader = defaultRuntimeLoader;

/** Replace the runtime loader (tests). Pass `null` to restore the default. */
export function setMlRuntimeLoader(loader: MlRuntimeLoader | null): void {
  runtimeLoader = loader ?? defaultRuntimeLoader;
}

export interface LoadModelOptions {
  /** transformers.js task, e.g. `'image-segmentation'`, `'automatic-speech-recognition'`. */
  task: string;
  /** Hugging Face repo id; must be on the permissive allow-list. */
  model: string;
  /** Git revision. Defaults to `'main'`. */
  revision?: string;
  /** Backend preference. Defaults to `'auto'` (WebGPU, then WASM). */
  backend?: MlBackendPreference;
  /** Model dtype; defaults to `fp16` on WebGPU and `q8` on WASM. */
  dtype?: Dtype;
  /** Cancels the load, including the in-flight download. */
  signal?: AbortSignal;
  /** Progress sink — see `LoadProgress` for a progress-bar-ready snapshot. */
  onProgress?: (progress: LoadProgress) => void;
  /** Ignore existing cache entries and re-download. */
  refresh?: boolean;
  /** Serve the model from cache only; never touch the network. */
  offline?: boolean;
  /** Extra allow-listed models for this call (still licence-checked). */
  extraModels?: readonly ModelLicenseEntry[];
  /** Cache backend; defaults to a `ModelCache` on the shared bucket. */
  cache?: ModelCache | null;
  /** Host serving model files. Defaults to the Hugging Face Hub. */
  remoteHost?: string;
  /** Hosts permitted to serve model files. Defaults to the HF Hub hosts. */
  allowHosts?: readonly string[];
  /** Minimum gap between progress events, in ms. `0` emits every update. */
  progressThrottleMs?: number;
  /** Extra options forwarded verbatim to `pipeline()`. */
  pipelineOptions?: Record<string, unknown>;
  /** Underlying fetch override (tests). */
  fetchImpl?: typeof fetch;
}

/** A loaded, ready-to-use model pipeline. */
export interface LoadedModel<P = unknown> {
  task: string;
  model: string;
  revision: string;
  /** Backend that actually produced the pipeline. */
  backend: MlBackend;
  /** Backend that was requested (may differ after a fallback). */
  requestedBackend: MlBackendPreference;
  /** True when WebGPU was requested/tried but WASM was used instead. */
  fellBack: boolean;
  dtype: Dtype;
  /** The transformers.js pipeline object. */
  pipeline: P;
  /** True when every file came from Cache Storage (no network download). */
  fromCache: boolean;
  /** Release the pipeline's resources (best effort). */
  dispose(): Promise<void>;
}

function configureEnv(runtime: MlRuntime, fetch: ModelFetch, remoteHost: string): void {
  const env = runtime.env;
  env.allowLocalModels = false;
  // Always allow remote requests; our fetch is the model-network chokepoint.
  env.allowRemoteModels = true;
  // We own model caching through fetch + ModelCache.
  env.useBrowserCache = false;
  env.useCustomCache = false;
  env.customCache = null;
  env.remoteHost = remoteHost;
  env.remotePathTemplate = HF_PATH_TEMPLATE;
  env.fetch = fetch;
  configureOnnxWasm(runtime);
}

/** Turn an arbitrary runtime failure into a friendly, user-facing error. */
function mapError(error: unknown, model: string): unknown {
  if (error instanceof ToolError || isAbortError(error)) return error;
  const detail = error instanceof Error ? error.message : String(error);
  const trimmed = detail.length > 160 ? `${detail.slice(0, 157)}…` : detail;
  return new ToolError(
    `Could not load the model "${model}"${trimmed ? `: ${trimmed}` : '.'}`,
    'The model may be unavailable, or this browser may not support it. Try a recent Chrome, Edge, Firefox or Safari.',
  );
}

/**
 * Load a model pipeline entirely on-device.
 *
 * @example
 * const { pipeline } = await loadModel({
 *   task: 'image-segmentation',
 *   model: 'Xenova/modnet',
 *   onProgress: (p) => renderBar(p.fraction, p.message),
 * });
 */
export async function loadModel<P = unknown>(options: LoadModelOptions): Promise<LoadedModel<P>> {
  const {
    task,
    model,
    revision = DEFAULT_REVISION,
    backend: preference = 'auto',
    signal,
    onProgress,
    refresh = false,
    offline = false,
    extraModels = [],
    remoteHost = DEFAULT_REMOTE_HOST,
    progressThrottleMs = 100,
    pipelineOptions = {},
    fetchImpl,
  } = options;

  assertAllowedModel(model, extraModels);
  throwIfAborted(signal);

  const emit = throttleProgress(onProgress ?? (() => {}), progressThrottleMs);
  const tracker = new ProgressTracker(emit);
  tracker.setPhase('resolving', `Preparing ${model}…`);

  const cache =
    options.cache === undefined
      ? new ModelCache({ onWarning: (message) => tracker.warn(message) })
      : options.cache;

  const decision = resolveBackend(preference, await webGpuAvailable());
  const modelFetch = createModelFetch({
    cache,
    signal,
    tracker,
    allowHosts: options.allowHosts ?? DEFAULT_ALLOWED_HOSTS,
    sameOriginPrefixes: [
      new URL(LOCAL_ONNX_WASM_BASE, globalThis.location?.href ?? 'http://localhost').pathname,
    ],
    remoteHost,
    offline,
    refresh,
    fetchImpl,
  });

  const runtime = await runtimeLoader();

  let backend = decision.backend;
  let fellBack = decision.fellBack;
  let dtype = resolveDtype(options.dtype, backend);

  const attempt = (target: MlBackend, targetDtype: Dtype): Promise<unknown> => {
    configureEnv(runtime, modelFetch, remoteHost);
    return runtime.pipeline(task, model, {
      device: target,
      dtype: targetDtype,
      revision,
      ...pipelineOptions,
    });
  };

  tracker.setPhase('initializing', 'Starting the model…');
  let pipeline: unknown;
  try {
    pipeline = await attempt(backend, dtype);
  } catch (error) {
    if (backend === 'webgpu' && !isAbortError(error) && !(error instanceof ToolError)) {
      // A GPU session can fail at runtime (lost device, unsupported operator).
      // Fall back to the CPU path once before giving up.
      fellBack = true;
      backend = 'wasm';
      dtype = resolveDtype(options.dtype, backend);
      tracker.reset();
      tracker.setPhase('initializing', 'WebGPU could not start — retrying on CPU (WASM)…');
      try {
        pipeline = await attempt(backend, dtype);
      } catch (retryError) {
        tracker.setPhase('error', 'Model load failed');
        emit.flush();
        throw mapError(retryError, model);
      }
    } else {
      tracker.setPhase('error', 'Model load failed');
      emit.flush();
      throw mapError(error, model);
    }
  }

  tracker.setPhase('ready', `${model} is ready`);
  emit.flush();

  return {
    task,
    model,
    revision,
    backend,
    requestedBackend: preference,
    fellBack,
    dtype,
    pipeline: pipeline as P,
    fromCache: tracker.networkBytes === 0,
    async dispose(): Promise<void> {
      const target = pipeline as { dispose?: () => unknown } | null;
      try {
        await target?.dispose?.();
      } catch {
        /* best effort */
      }
      pipeline = null;
    },
  };
}

export interface DownloadEstimateFile {
  url: string;
  /** Content-Length in bytes, or `null` when the server did not report one. */
  size: number | null;
  /** Whether the file is already in Cache Storage. */
  cached: boolean;
}

export interface DownloadEstimate {
  /** Sum of the known sizes. */
  total: number;
  /** Number of files with a known size. */
  known: number;
  /** Number of files whose size could not be determined. */
  unknown: number;
  files: DownloadEstimateFile[];
}

export interface EstimateOptions {
  signal?: AbortSignal;
  cache?: ModelCache | null;
  fetchImpl?: typeof fetch;
  /** Hosts permitted to answer the probe. Defaults to the HF Hub hosts. */
  allowHosts?: readonly string[];
}

/**
 * Pre-flight download size for a set of file URLs, so a tool can warn the user
 * *before* a large download. Cache hits are reported without a network call;
 * missing `Content-Length` yields `size: null` (the bar then falls back to
 * live byte progress at download time).
 */
export async function estimateDownloadSize(
  urls: readonly string[],
  options: EstimateOptions = {},
): Promise<DownloadEstimate> {
  const cache = options.cache ?? new ModelCache();
  const fetchImpl = (options.fetchImpl ?? globalThis.fetch) as typeof fetch | undefined;
  const allowHosts = options.allowHosts ?? DEFAULT_ALLOWED_HOSTS;
  const files: DownloadEstimateFile[] = [];

  for (const url of urls) {
    throwIfAborted(options.signal);
    const key = cacheKeyForUrl(url);
    const cached = await cache.match(key);
    if (cached) {
      const recorded =
        cached.headers.get('x-tesserae-bytes') ?? cached.headers.get('content-length');
      files.push({ url, size: recorded ? Number(recorded) || null : null, cached: true });
      continue;
    }
    if (!isAllowedHost(url, allowHosts) || !fetchImpl) {
      files.push({ url, size: null, cached: false });
      continue;
    }
    try {
      const head = await fetchImpl(url, { method: 'HEAD', signal: options.signal });
      const length = head.headers.get('content-length');
      const size = length ? Number.parseInt(length, 10) : Number.NaN;
      files.push({ url, size: Number.isFinite(size) && size > 0 ? size : null, cached: false });
    } catch {
      files.push({ url, size: null, cached: false });
    }
  }

  let total = 0;
  let known = 0;
  let unknown = 0;
  for (const file of files) {
    if (file.size != null) {
      total += file.size;
      known++;
    } else {
      unknown++;
    }
  }
  return { total, known, unknown, files };
}
