import type { RegisteredTool, ToolModule } from '../types';
import { capabilities } from '../capabilities';

export interface RunOptions {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

let worker: Worker | null = null;

/**
 * Lazy loaders for every tool implementation. The client never imports the
 * eager meta registry — `src/lib/registry.ts` is build-time only — so a tool
 * page downloads just its own code when it runs, and the entry chunk carries
 * no tool metadata at all.
 */
const toolLoaders = import.meta.glob<{ default: ToolModule }>('../../tools/**/*.tool.ts');

function findLoader(toolId: string): (() => Promise<{ default: ToolModule }>) | undefined {
  const suffix = `/${toolId}.tool.ts`;
  for (const [key, loader] of Object.entries(toolLoaders)) {
    if (key.endsWith(suffix)) return loader;
  }
  return undefined;
}

/** Load a tool implementation without running it. */
export async function loadToolModule(toolId: string): Promise<ToolModule> {
  const loader = findLoader(toolId);
  if (!loader) throw new Error(`Unknown tool: ${toolId}`);
  return (await loader()).default;
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./tool.worker.ts', import.meta.url), {
      type: 'module',
      name: 'tesserae-tool',
    });
  }
  return worker;
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `t-${Math.random().toString(36).slice(2)}-${performance.now()}`;
}

function runInWorker<T>(
  toolId: string,
  payload: Record<string, unknown>,
  opts: RunOptions,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // A run can be cancelled while its tool module is still downloading, before
    // this function attaches the abort listener. Adding a listener to a signal
    // that has already fired does nothing, so check up front and refuse to
    // start work that was already cancelled.
    if (opts.signal?.aborted) {
      reject(new DOMException('The operation was cancelled.', 'AbortError'));
      return;
    }

    const w = getWorker();
    const id = uid();

    const cleanup = () => {
      w.removeEventListener('message', onMessage);
      opts.signal?.removeEventListener('abort', onAbort);
    };
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.id !== id) return;
      if (data.type === 'progress') {
        opts.onProgress?.(data.fraction, data.message);
      } else if (data.type === 'result') {
        cleanup();
        resolve(data.result as T);
      } else if (data.type === 'error') {
        cleanup();
        const err = new Error(data.message);
        err.name = data.name || 'Error';
        (err as Error & { hint?: string }).hint = data.hint;
        reject(err);
      }
    };
    const onAbort = () => {
      cleanup();
      // Terminate so an in-flight heavy job actually stops; next run respawns.
      w.terminate();
      worker = null;
      reject(new DOMException('The operation was cancelled.', 'AbortError'));
    };

    w.addEventListener('message', onMessage);
    opts.signal?.addEventListener('abort', onAbort);
    w.postMessage({ id, toolId, payload });
  });
}

/**
 * Execute a tool. File tools (and any tool with `meta.worker === true`) run in a
 * Web Worker so the UI never freezes; everything else runs inline.
 */
export async function runTool<T>(
  tool: RegisteredTool,
  payload: Record<string, unknown>,
  opts: RunOptions = {},
): Promise<T> {
  const useWorker = tool.meta.worker ?? tool.meta.input === 'file';

  if (useWorker && capabilities.workers) {
    return runInWorker<T>(tool.meta.id, payload, opts);
  }

  const mod = await tool.load();
  if (opts.signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
  return (await mod.default.run({
    ...payload,
    signal: opts.signal,
    onProgress: opts.onProgress,
  } as never)) as T;
}

export async function runToolById<T>(
  id: string,
  payload: Record<string, unknown>,
  opts: RunOptions = {},
): Promise<T> {
  const mod = await loadToolModule(id);
  const useWorker = mod.meta.worker ?? mod.meta.input === 'file';

  if (useWorker && capabilities.workers) {
    return runInWorker<T>(id, payload, opts);
  }

  if (opts.signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
  return (await mod.run({
    ...payload,
    signal: opts.signal,
    onProgress: opts.onProgress,
  } as never)) as T;
}

export function disposeWorker(): void {
  worker?.terminate();
  worker = null;
}
