# ML runtime foundation (`src/lib/ml`)

Shared, reusable loader for [transformers.js](https://github.com/huggingface/transformers.js)
(`@huggingface/transformers`) / onnxruntime-web models. It is the foundation the
ML tools build on (background remover, speech-to-text, image upscale, …): tools
never talk to the runtime or the Hub directly, they call `loadModel()`.

Everything runs in the visitor's tab. The only external network traffic is model
files fetched from the permitted host — the Hugging Face Hub by default. The ONNX
WebAssembly runtime assets are served from this site's static `/vendor/onnxruntime/`
directory. User inputs never leave the device.

## Quick start

```ts
import { loadModel } from '@/lib/ml';

const { pipeline, backend, fromCache, dispose } = await loadModel<ImageSegmentationPipeline>({
  task: 'image-segmentation',
  model: 'Xenova/modnet', // must be on the reviewed allow-list
  onProgress: (p) => renderBar(p.fraction, p.message), // fraction: 0..1 | null
  signal: controller.signal,
});

try {
  const result = await pipeline(input);
} finally {
  await dispose();
}
```

`loadModel` is only reachable through a dynamic `import()`, so importing the
`@/lib/ml` barrel (or a tool's `.meta.ts`, for the types) costs nothing at load
time. The runtime chunk is fetched the first time a model is actually loaded.

## Module map

| File          | Responsibility                                                   |
| ------------- | ---------------------------------------------------------------- |
| `types.ts`    | `LoadProgress`, `FileProgress`, abort helpers. No browser APIs.  |
| `urls.ts`     | Hub URL ↔ cache-key derivation, host allow-list. Pure.           |
| `licenses.ts` | Model-licence allow-list and `assertAllowedModel`. Pure.         |
| `backend.ts`  | WebGPU detection + `resolveBackend` / dtype defaults.            |
| `progress.ts` | `ProgressTracker` (byte bookkeeping) + `throttleProgress`. Pure. |
| `cache.ts`    | `ModelCache`: Cache Storage with integrity checks + eviction.    |
| `fetch.ts`    | `createModelFetch`: the single network chokepoint.               |
| `body.ts`     | `readBodyWithProgress`: stream → blob with progress + abort.     |
| `loader.ts`   | `loadModel`, `estimateDownloadSize`, the runtime import seam.    |

## Public API

```ts
// loader.ts
function loadModel<P = unknown>(options: LoadModelOptions): Promise<LoadedModel<P>>;
function estimateDownloadSize(
  urls: readonly string[],
  options?: EstimateOptions,
): Promise<DownloadEstimate>;
function setMlRuntimeLoader(loader: MlRuntimeLoader | null): void; // tests only

interface LoadModelOptions {
  task: string; // transformers.js task, e.g. 'automatic-speech-recognition'
  model: string; // HF repo id; must be allow-listed
  revision?: string; // default 'main'
  backend?: 'auto' | 'webgpu' | 'wasm'; // default 'auto'
  dtype?: string | Record<string, string>; // default fp16 (WebGPU) / q8 (WASM)
  signal?: AbortSignal; // cancels the download and the load
  onProgress?: (p: LoadProgress) => void;
  refresh?: boolean; // ignore cache, re-download
  offline?: boolean; // cache-only; fail if not cached
  extraModels?: readonly ModelLicenseEntry[]; // call-specific allow-list entries
  cache?: ModelCache | null; // default: shared Cache Storage bucket
  remoteHost?: string; // default HF Hub
  allowHosts?: readonly string[]; // default ['huggingface.co', 'hf.co']
  progressThrottleMs?: number; // default 100; 0 = every update
  pipelineOptions?: Record<string, unknown>;
}

interface LoadedModel<P> {
  task: string;
  model: string;
  revision: string;
  backend: 'webgpu' | 'wasm'; // actually used
  requestedBackend: 'auto' | 'webgpu' | 'wasm';
  fellBack: boolean; // true if a WebGPU session was retried on WASM
  dtype: string | Record<string, string>;
  pipeline: P;
  fromCache: boolean; // every file came from Cache Storage
  dispose(): Promise<void>;
}

interface LoadProgress {
  phase: 'resolving' | 'downloading' | 'initializing' | 'ready' | 'error';
  fraction: number | null; // aggregate, null while the total is unknown
  loaded: number;
  total: number; // bytes
  files: FileProgress[]; // per-file detail (loaded/total/cached)
  message: string; // ready to render
  warnings: string[]; // e.g. cache quota exceeded
}
```

Render `loaded`/`total` with `formatBytes` from `src/lib/format.ts`;
`estimateDownloadSize(urls)` gives a pre-flight total when the file list is
known ahead of time.

## Backend selection

`resolveBackend(preference, webgpuAvailable)` is pure and fully unit-tested:

| preference | WebGPU available | result                         |
| ---------- | ---------------- | ------------------------------ |
| `auto`     | yes / no         | `webgpu` / `wasm`              |
| `webgpu`   | yes / no         | `webgpu` / `wasm` + `fellBack` |
| `wasm`     | either           | `wasm`                         |

Availability probes `navigator.gpu` and actually requests an adapter — a present
API with no adapter (or a blocked/insecure context) counts as unavailable. If a
WebGPU session fails _at runtime_ (lost device, unsupported operator), the loader
retries once on WASM and sets `fellBack: true`.

Default dtype follows the recommendation from the transformers.js docs: `fp16` on
WebGPU, `q8` on WASM. Override it when a model ships a different quantisation.

## Caching

Model files are cached in Cache Storage under `tesserae-ml-v1` (bump
`ModelCache.defaultName` to invalidate). Each entry records its byte length, URL,
timestamp, content type and, when the Hub provides one (LFS `ETag`), its SHA-256.

On read, `ModelCache.match` validates the entry — byte length, JSON
well-formedness for `.json` files, and the digest for entries up to 64 MiB
(`digestLimitBytes`) — and a failing entry is **evicted and reported as a miss**,
so the caller silently re-downloads instead of feeding garbage to ONNX. The
`verify: 'none' | 'size' | 'digest'` option trades safety for speed.

Cache Storage uses the browser's shared quota. If a write hits
`QuotaExceededError` the load still succeeds, uncached, and a warning surfaces in
`LoadProgress.warnings`.

## Privacy

All traffic flows through `createModelFetch`, which:

- refuses model URLs whose host is not on `allowHosts`,
- permits only the site's `/vendor/onnxruntime/` assets in addition to model hosts,
- passes the caller's `AbortSignal` to downloads,
- only ever requests public model/runtime files; user inputs never leave the device.

`meta.privacy.network` for an ML tool lists only external hosts, for example
`network: ['huggingface.co']`; same-origin runtime assets are part of the static
site and are not a third-party contact.

## Licences

Model weights are third-party artefacts with their own licences. The loader
**denies by default**: a model id must be on the curated allow-list
(`MODEL_ALLOWLIST`) or passed as an explicit, still-permissive `extraModels`
entry. `assertAllowedModel` rejects unknown ids and ids whose licence is not on
`PERMISSIVE_LICENSES` (Apache-2.0, MIT, BSD, ISC, MPL-2.0, CC0, Unlicense).

To add a model: verify `cardData.license` from
`https://huggingface.co/api/models/<id>`, add an entry with its URL, and note the
verification date. Non-commercial weights (e.g. `briaai/RMBG-1.4`, licensed
`other`) must stay out.

## Edge cases

| Case                            | Behaviour                                                  |
| ------------------------------- | ---------------------------------------------------------- |
| WebGPU absent / no adapter      | WASM used; `fellBack` only if `webgpu` was requested       |
| WebGPU session fails at runtime | one automatic retry on WASM, `fellBack: true`              |
| Offline, model cached           | loads from cache, `fromCache: true`, no network            |
| Offline, model not cached       | `ToolError` ("has not been downloaded yet")                |
| Cache entry corrupt             | evicted + treated as a miss, then re-downloaded            |
| Storage quota exceeded          | load succeeds uncached; `warnings` carries the message     |
| Aborted mid-download            | `AbortError`; the network request is cancelled             |
| Unknown / non-commercial model  | `ToolError` before the runtime is imported                 |
| Non-200 file response           | returned untouched (transformers.js treats 404s as absent) |
| Non-allow-listed host           | `ToolError` before any request is made                     |

## Tests

`npm test` covers the pure logic with the network, Cache Storage and WebGPU
mocked (`test/ml-fakes.ts`): URL/cache-key derivation, licence enforcement,
backend selection, progress aggregation + throttling, cache integrity/eviction/
quota handling, fetch allow-listing/abort/caching, and `loadModel` end-to-end
with an injected runtime.

## Limitations / follow-ups

- The runtime `env` is a module-global in transformers.js; two concurrent
  `loadModel` calls with different hosts/caches would race. Load one model at a
  time per page.
- Files are buffered in memory as a `Blob` before being returned; very large
  models peak at roughly 2× the file size. A streaming tee into the cache would
  remove one copy.
- `dispose()` is best-effort: transformers.js pipelines don't consistently expose
  the underlying ONNX session.
- `estimateDownloadSize` relies on `HEAD` + `Content-Length`; servers that omit
  it report `size: null` and the UI falls back to live byte progress.
- WebGPU dtype defaults (`fp16`) assume the model ships an fp16 variant; pass an
  explicit `dtype` for models that don't.
