import type { FileRunInput, FileRunResult, FileToolModule, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './image-ocr.meta';
import {
  cleanOcrText,
  joinOcrSections,
  ocrLanguageLabel,
  ocrOutputName,
  ocrTextStats,
  resolveOcrLanguage,
  resolveOcrMode,
} from './ocr-languages';
import {
  assertOcrFileSize,
  assertOcrImageSize,
  readImageSize,
  sniffImageFormat,
  supportsSimd,
} from './ocr-image';
import {
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  throwIfAborted,
} from './image-batch';

/**
 * The Tesseract engine, the language models and the worker script are all
 * served from this origin (see `scripts/vendor-tesseract.mjs`). Nothing is
 * ever fetched from a CDN.
 */
const SITE_BASE = import.meta.env.BASE_URL || '/';
const ASSET_BASE = `${SITE_BASE}vendor/tesseract`;
const WORKER_PATH = `${ASSET_BASE}/worker.min.js`;
const LANG_PATH = `${ASSET_BASE}/lang`;
const CORE_SIMD_PATH = `${ASSET_BASE}/core/tesseract-core-simd-lstm.wasm.js`;
const CORE_PLAIN_PATH = `${ASSET_BASE}/core/tesseract-core-lstm.wasm.js`;

/** Tesseract's LSTM-only engine mode. The legacy engine is not shipped. */
const OEM_LSTM_ONLY = 1;

/** How much of the progress bar the engine start-up takes. */
const SETUP_SHARE = 0.45;

/** The phases tesseract.js reports while it starts up, and their share of it. */
const SETUP_PHASES: Record<string, [number, number]> = {
  'loading tesseract core': [0, 0.55],
  'loading language traineddata': [0.55, 0.85],
  'initializing tesseract': [0.85, 0.95],
  'initializing api': [0.95, 1],
};

const SETUP_MESSAGES: Record<string, string> = {
  'loading tesseract core': 'Loading the OCR engine…',
  'loading language traineddata': 'Loading the language model…',
  'initializing tesseract': 'Starting the OCR engine…',
  'initializing api': 'Starting the OCR engine…',
};

/** The slice of the tesseract.js API this tool uses. */
interface OcrEngine {
  recognize(
    image: Blob,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>,
  ): Promise<{ data?: { text?: string; confidence?: number } }>;
  setParameters(params: Record<string, unknown>): Promise<unknown>;
  terminate(): Promise<unknown>;
}

type CreateWorker = (
  langs: string,
  oem: number,
  options: Record<string, unknown>,
) => Promise<OcrEngine>;

/** Turn anything thrown into an Error with a readable message. */
function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error('Unknown error');
  }
}

/** The message of a caught error, for warnings. */
function errorMessage(err: unknown): string {
  const message = toError(err).message;
  return message || 'That file could not be read.';
}

/** `DOMException` used to report a cancelled run. */
function abortError(): DOMException {
  return new DOMException('The operation was cancelled.', 'AbortError');
}

/**
 * Reject as soon as the caller cancels, instead of waiting for the promise it
 * is racing to settle. The work itself is stopped by the caller's abort
 * listener, which terminates the Tesseract worker.
 */
function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

/** Pull `createWorker` out of the dynamically imported module, whatever shape it takes. */
function pickCreateWorker(mod: unknown): CreateWorker {
  const candidates = [mod, (mod as { default?: unknown } | null)?.default];
  for (const candidate of candidates) {
    const fn = (candidate as { createWorker?: unknown } | null)?.createWorker;
    if (typeof fn === 'function') return fn as CreateWorker;
  }
  throw new ToolError('The OCR engine could not be loaded.', 'Reload the page and try again.');
}

/**
 * Explain a failure of the engine in words the visitor can act on. A missing
 * language model is the interesting case: it must never look like an empty
 * result.
 */
function explainEngineError(err: unknown, language: string): ToolError {
  const message = toError(err).message;
  if (/traineddata|initialization failed|language/i.test(message)) {
    return new ToolError(
      `The ${ocrLanguageLabel(language)} language model could not be loaded.`,
      'The model files are served from this site — reload the page and try again.',
    );
  }
  if (/core|wasm|WebAssembly|memory/i.test(message)) {
    return new ToolError(
      'The OCR engine could not be started.',
      'Reload the page and try again, or close other tabs that are using a lot of memory.',
    );
  }
  return new ToolError(`The OCR engine could not be started: ${message || 'unknown error'}.`);
}

/**
 * Check that the file really is an image, and that it is small enough to
 * decode, before anything heavy happens. The size comes from the file header
 * so an enormous photo never gets decoded at all.
 */
async function assertReadableHeader(file: File): Promise<void> {
  const head = new Uint8Array(await file.slice(0, 262_144).arrayBuffer());
  const format = sniffImageFormat(head);
  if (!format) {
    throw new ToolError(
      `“${file.name}” is not a PNG, JPEG, WebP, GIF or BMP image.`,
      'Convert it to one of those formats and try again.',
    );
  }
  const size = readImageSize(head);
  if (size) assertOcrImageSize(size.width, size.height);
}

/**
 * Decode the image with the browser's own decoder and hand Tesseract a PNG.
 *
 * Going through the browser fixes the orientation the camera stored (a photo
 * shot sideways comes out upright) and guarantees Tesseract gets a format it
 * can definitely read.
 */
async function toPngBlob(file: File): Promise<Blob> {
  const bitmap = await decodeOriented(file);
  try {
    assertOcrImageSize(bitmap.width, bitmap.height);
    const canvas = createCanvas(bitmap.width, bitmap.height, 'image');
    const ctx = context2d(canvas);
    ctx.drawImage(bitmap, 0, 0);
    return await encodeCanvas(canvas, 'image/png');
  } finally {
    bitmap.close();
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const files = input.files;
  if (!files.length) throw new ToolError('Choose an image to read.');

  const language = resolveOcrLanguage(o.language);
  const mode = resolveOcrMode(o.mode);
  const tidy = o.tidy !== false;
  const signal = input.signal;

  // Check every file before the engine is fetched, so a wrong file is
  // reported straight away instead of after a 4 MB download.
  const warnings: string[] = [];
  const candidates: File[] = [];
  for (const file of files) {
    throwIfAborted(signal);
    try {
      assertOcrFileSize(file.size, file.name);
      await assertReadableHeader(file);
      candidates.push(file);
    } catch (err) {
      if (signal?.aborted) throw err;
      warnings.push(`“${file.name}” — ${errorMessage(err)}`);
    }
  }
  if (!candidates.length) {
    throw new ToolError(
      warnings[0] ?? 'None of the selected files could be read.',
      'Choose a PNG, JPEG, WebP, GIF or BMP image.',
    );
  }

  input.onProgress?.(0, 'Loading the OCR engine…');

  const createWorker = pickCreateWorker(await import('tesseract.js'));

  let engine: OcrEngine | null = null;
  let engineReady = false;
  let rejectCreation: ((err: Error) => void) | null = null;
  const creationFailure = new Promise<never>((_, reject) => {
    rejectCreation = reject;
  });
  let currentIndex = 0;

  const logger = (event: { status?: string; progress?: number }) => {
    if (signal?.aborted) return;
    const status = String(event?.status ?? '');
    const progress = Math.min(1, Math.max(0, Number(event?.progress ?? 0)));
    if (status === 'recognizing text') {
      const file = candidates[currentIndex];
      const within = (currentIndex + progress) / candidates.length;
      input.onProgress?.(
        SETUP_SHARE + (1 - SETUP_SHARE) * within,
        `Reading ${file?.name ?? 'the image'}…`,
      );
      return;
    }
    const phase = SETUP_PHASES[status];
    if (!phase) return;
    const within = phase[0] + (phase[1] - phase[0]) * progress;
    input.onProgress?.(SETUP_SHARE * within, SETUP_MESSAGES[status] ?? 'Starting the OCR engine…');
  };

  const errorHandler = (err: unknown) => {
    const error = toError(err);
    if (!engineReady) rejectCreation?.(error);
  };

  const creating = createWorker(language, OEM_LSTM_ONLY, {
    workerPath: WORKER_PATH,
    corePath: supportsSimd() ? CORE_SIMD_PATH : CORE_PLAIN_PATH,
    langPath: LANG_PATH,
    workerBlobURL: false,
    gzip: true,
    logger,
    errorHandler,
  });

  // If the run is cancelled while the engine is still starting, stop it as
  // soon as it exists.
  creating.then(
    (created: OcrEngine) => {
      if (signal?.aborted) void created.terminate().catch(() => {});
    },
    () => {},
  );

  const onAbort = () => {
    void engine?.terminate().catch(() => {});
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    // A cancel during the start-up must not wait for the engine to be ready.
    engine = await raceAbort(Promise.race([creating, creationFailure]), signal);
    engineReady = true;
    const ocr: OcrEngine = engine;

    await ocr.setParameters({ tessedit_pageseg_mode: mode.psm });

    const outputs: OutputFile[] = [];
    const sections: { name: string; text: string }[] = [];
    let failed = 0;
    let characters = 0;
    let words = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;

    for (let index = 0; index < candidates.length; index++) {
      const file = candidates[index]!;
      throwIfAborted(signal);
      currentIndex = index;
      input.onProgress?.(
        SETUP_SHARE + (1 - SETUP_SHARE) * (index / candidates.length),
        `Reading ${file.name}…`,
      );

      try {
        const png = await toPngBlob(file);
        throwIfAborted(signal);
        const result = await raceAbort(ocr.recognize(png, {}, { text: true }), signal);
        const raw = result?.data?.text ?? '';
        const text = tidy ? cleanOcrText(raw) : raw.replace(/\r\n?/g, '\n');

        const textStats = ocrTextStats(text);
        characters += textStats.characters;
        words += textStats.words;
        const confidence = Number(result?.data?.confidence);
        if (Number.isFinite(confidence)) {
          confidenceSum += confidence;
          confidenceCount += 1;
        }

        outputs.push({
          filename: ocrOutputName(file.name),
          blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
        });
        sections.push({ name: file.name, text });
        if (!text.trim()) {
          warnings.push(`“${file.name}” — no text was found in that image.`);
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        failed += 1;
        warnings.push(`“${file.name}” — ${errorMessage(err)}`);
      }
    }

    input.onProgress?.(1, 'Done');

    if (!outputs.length && failed) {
      throw new ToolError(
        warnings[0] ?? 'None of the selected files could be read.',
        'Check that the files are PNG, JPEG, WebP, GIF or BMP images and try again.',
      );
    }

    const notes = [
      `Read with the ${ocrLanguageLabel(language)} model. The model is cached by your browser, so the next run starts faster.`,
      'OCR is never perfect — check names, numbers and totals before you rely on them.',
    ];
    if (failed) notes.push(`${failed} file(s) could not be read — see the notes above.`);

    const stats: Record<string, string | number> = {
      files: candidates.length,
      language: ocrLanguageLabel(language),
      characters,
      words,
    };
    if (confidenceCount) {
      stats.averageConfidence = Math.round(confidenceSum / confidenceCount);
    }

    return {
      outputs,
      report: {
        output: joinOcrSections(sections),
        render: 'text',
      },
      notes,
      warnings: warnings.length ? warnings : undefined,
      stats,
    };
  } catch (err) {
    if (signal?.aborted) throw err;
    // A worker that only appears after the failure is still stopped.
    creating.then(
      (created) => void created.terminate().catch(() => {}),
      () => {},
    );
    if (err instanceof ToolError) throw err;
    throw explainEngineError(err, language);
  } finally {
    signal?.removeEventListener('abort', onAbort);
    if (engine) {
      try {
        await engine.terminate();
      } catch {
        /* the worker is going away anyway */
      }
    }
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
