/**
 * Remove Background — on-device portrait matting with MODNet.
 *
 * single-channel alpha matte for the subject, and this tool composites it. On
 * the first run, the model weights are fetched from the Hugging Face Hub and
 * cached in the browser. The ONNX runtime assets are served by this static site,
 * and the images never leave the tab.
 *
 * The matte maths below is pure — unit-tested without a browser or a model.
 * Only `run()` (plus the preview encoder) touches canvas and model APIs.
 */
import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { loadModel, type LoadedModel, type LoadProgress } from '@/lib/ml';
import { checkAbort, checkFiles, extension, parseHexColor, stem } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  runBatch,
} from './image-batch';
import { meta } from './background-remover.meta';

/** Allow-listed MODNet export (Apache-2.0). RMBG-1.4 is non-commercial — not used. */
export const MODEL_ID = 'Xenova/modnet';

/** Fraction of the progress bar reserved for downloading/initialising the model. */
const LOAD_SHARE = 0.6;

/** Longest side of each panel in the before/after preview. */
const PREVIEW_PANEL_MAX = 260;
const PREVIEW_GAP = 6;
/** Backdrop painted behind the preview so transparent pixels stay visible. */
const PREVIEW_BACKDROP = '#e2e8f0';

/* -------------------------------------------------------------------------- */
/*  Model shapes                                                              */
/* -------------------------------------------------------------------------- */

/** A `RawImage`-shaped matte as returned by transformers.js. */
export interface MattingMask {
  data: ArrayLike<number>;
  width: number;
  height: number;
  /** 1 = grayscale alpha, 2 = gray+alpha, 3 = RGB, 4 = RGBA. */
  channels: number;
}

/** One segment of the `image-segmentation` pipeline output. */
export interface SegmentationSegment {
  label?: string | null;
  score?: number | null;
  mask: MattingMask;
}

/** The `image-segmentation` pipeline, narrowed to what this tool calls. */
export type SegmentationPipeline = (
  input: unknown,
) => Promise<SegmentationSegment[] | SegmentationSegment>;

/* -------------------------------------------------------------------------- */
/*  Options                                                                   */
/* -------------------------------------------------------------------------- */

/** What replaces the removed background. */
export type Background =
  { kind: 'transparent' } | { kind: 'solid'; r: number; g: number; b: number };

/**
 * Resolve the `background` / `backgroundColour` options into a background.
 * `'transparent'` keeps the alpha channel; `'solid'` needs a valid hex colour.
 */
export function resolveBackground(mode: unknown, colour: unknown): Background {
  const value = String(mode ?? 'transparent')
    .trim()
    .toLowerCase();
  if (value === 'transparent') return { kind: 'transparent' };
  if (value !== 'solid') {
    throw new ToolError(
      `“${String(mode)}” is not a valid background.`,
      'Choose “Transparent” or “Solid colour”.',
    );
  }
  const rgb = parseHexColor(String(colour ?? ''));
  if (!rgb) {
    throw new ToolError(
      'Enter a hex colour for the new background.',
      'Use a 3- or 6-digit hex value such as #ffffff.',
    );
  }
  return { kind: 'solid', r: rgb[0], g: rgb[1], b: rgb[2] };
}

/** Map the `format` option to an encodable MIME type. */
export function resolveFormat(value: unknown): string {
  const format = String(value ?? 'png')
    .trim()
    .toLowerCase();
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  throw new ToolError(
    `“${String(value)}” is not a supported output format.`,
    'Choose PNG or WebP.',
  );
}

/** Clamp the `quality` option to an encoder quality in 0..1 (WebP only). */
export function resolveQuality(value: unknown): number {
  const quality = Number(value);
  if (!Number.isFinite(quality)) return 0.9;
  return Math.min(100, Math.max(10, quality)) / 100;
}

/** Clamp the `threshold` option to an integer alpha cut-off in 0..255. Zero disables it. */
export function resolveThreshold(value: unknown): number {
  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold <= 0) return 0;
  return Math.round((Math.min(100, threshold) / 100) * 255);
}

/** Output filename: `<name>-no-bg.png` for transparency, `<name>-solid.png` otherwise. */
export function outputFilename(name: string, background: Background, mime: string): string {
  const suffix = background.kind === 'transparent' ? 'no-bg' : 'solid';
  return `${stem(name)}-${suffix}.${extension(mime)}`;
}

/* -------------------------------------------------------------------------- */
/*  Pure matte maths                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Enforce the shared canvas limits. There is no separate tool-specific pixel
 * ceiling: processing happens in this browser, so the canvas budget is the
 * only hard limit — anything beyond what a canvas can represent cannot run.
 */
export function assertCutoutBudget(width: number, height: number): void {
  assertCanvasBudget(width, height, 'source image');
}

/**
 * Effective coverage of one pixel. A matte can only ever remove coverage, so an
 * already-transparent source pixel (alpha 0) stays transparent even where the
 * model says "subject" (1.0).
 */
function effectiveAlpha(matte: number, sourceAlpha: number, threshold: number): number {
  const snapped = threshold > 0 ? (matte >= threshold ? 255 : 0) : matte;
  return (snapped * sourceAlpha) / 255;
}

/**
 * Collapse a pipeline mask (1–4 channels) into a single-channel alpha map of
 * `width × height`, nearest-neighbour sampling when the matte was predicted at
 * a different resolution than the source image.
 */
export function matteToAlpha(mask: MattingMask, width: number, height: number): Uint8ClampedArray {
  const mw = Math.round(Number(mask.width));
  const mh = Math.round(Number(mask.height));
  const channels = Math.round(Number(mask.channels));
  if (!Number.isFinite(mw) || !Number.isFinite(mh) || mw < 1 || mh < 1) {
    throw new ToolError(
      'The model returned an empty matte for this image.',
      'Try a different photo, or a portrait with a clearly visible subject.',
    );
  }
  if (channels !== 1 && channels !== 2 && channels !== 3 && channels !== 4) {
    throw new ToolError('The model returned a matte with an unsupported channel count.');
  }
  const available = Math.floor(mask.data.length / channels);
  if (available < mw * mh) {
    throw new ToolError('The model returned a truncated matte.');
  }

  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const my = mh === height ? y : Math.min(mh - 1, Math.floor((y * mh) / height));
    for (let x = 0; x < width; x++) {
      const mx = mw === width ? x : Math.min(mw - 1, Math.floor((x * mw) / width));
      const i = (my * mw + mx) * channels;
      if (channels === 2) {
        out[y * width + x] = mask.data[i + 1] ?? 0;
      } else if (channels === 3) {
        const r = mask.data[i] ?? 0;
        const g = mask.data[i + 1] ?? 0;
        const b = mask.data[i + 2] ?? 0;
        out[y * width + x] = Math.round(0.2989 * r + 0.587 * g + 0.114 * b);
      } else {
        // 1 channel = alpha; 4 channels = take the alpha plane.
        out[y * width + x] = mask.data[i + (channels === 4 ? 3 : 0)] ?? 0;
      }
    }
  }
  return out;
}

/**
 * Composite an alpha matte over the source pixels.
 *
 * - `transparent`: keep the source colour, replace alpha with the matte.
 * - `solid`: flatten the subject onto the colour (`src·a + bg·(1−a)`) and mark
 *   every pixel opaque, so the result is a normal photo on a flat backdrop.
 *
 * The blend uses the *effective* alpha — `matte × source alpha / 255` — so an
 * input that is already transparent (a PNG cut-out, a sprite) is never made
 * opaque by the model, and never painted over the replacement colour.
 *
 * `threshold` (0 = off) snaps the matte to fully transparent/opaque, which
 * turns the model's soft feathered edges into a hard cut-out.
 */
export function compositePixels(
  source: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  background: Background,
  threshold = 0,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha.length * 4);
  for (let p = 0, i = 0; i < alpha.length; i++, p += 4) {
    const coverage = effectiveAlpha(alpha[i]!, source[p + 3] ?? 255, threshold);
    const r = source[p] ?? 0;
    const g = source[p + 1] ?? 0;
    const b = source[p + 2] ?? 0;
    if (background.kind === 'transparent') {
      out[p] = r;
      out[p + 1] = g;
      out[p + 2] = b;
      out[p + 3] = coverage;
    } else {
      const f = coverage / 255;
      const rest = 1 - f;
      out[p] = r * f + background.r * rest;
      out[p + 1] = g * f + background.g * rest;
      out[p + 2] = b * f + background.b * rest;
      out[p + 3] = 255;
    }
  }
  return out;
}

export interface Cutout {
  /** Final RGBA pixels, `width * height * 4` bytes. */
  pixels: Uint8ClampedArray;
  /** Mean matte coverage in 0..1 — how much of the frame the subject fills. */
  coverage: number;
}

/** Matte + composite in one step. Throws when the source pixel buffer is short. */
export function cutout(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  mask: MattingMask,
  background: Background,
  threshold = 0,
): Cutout {
  if (source.length < width * height * 4) {
    throw new ToolError('The decoded image is incomplete.');
  }
  const alpha = matteToAlpha(mask, width, height);
  let total = 0;
  for (let i = 0; i < alpha.length; i++) total += alpha[i]!;
  return {
    pixels: compositePixels(source, alpha, background, threshold),
    coverage: alpha.length ? total / (alpha.length * 255) : 0,
  };
}

/* -------------------------------------------------------------------------- */
/*  Preview                                                                   */
/* -------------------------------------------------------------------------- */

/** Base64-encode bytes without overflowing the argument limit of `apply`. */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(binary);
}

/**
 * Side-by-side "before / after" preview as a PNG data URL. Best-effort: a
 * preview that cannot be encoded must never fail the run.
 */
async function beforeAfterDataUrl(
  before: OffscreenCanvas,
  after: OffscreenCanvas,
): Promise<string | undefined> {
  try {
    const scale = Math.min(1, PREVIEW_PANEL_MAX / Math.max(before.width, before.height));
    const panelW = Math.max(1, Math.round(before.width * scale));
    const panelH = Math.max(1, Math.round(before.height * scale));
    const canvas = createCanvas(panelW * 2 + PREVIEW_GAP, panelH, 'preview');
    const ctx = context2d(canvas);
    ctx.fillStyle = PREVIEW_BACKDROP;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(before, 0, 0, panelW, panelH);
    ctx.drawImage(after, panelW + PREVIEW_GAP, 0, panelW, panelH);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return `data:image/png;base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`;
  } catch {
    return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/*  Tool entry point                                                          */
/* -------------------------------------------------------------------------- */

interface ProcessedFile {
  filename: string;
  blob: Blob;
  coverage: number;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);
  checkAbort(input.signal);

  const background = resolveBackground(o.background, o.backgroundColour);
  const mime = resolveFormat(o.format);
  const quality = resolveQuality(o.quality);
  const threshold = resolveThreshold(o.threshold);

  const warnings: string[] = [];
  const notes: string[] = [];
  let pixels = 0;
  let coverage = 0;
  let previewName: string | undefined;
  let previewUrl: string | undefined;
  let loaded: LoadedModel<SegmentationPipeline> | undefined;
  let pending: Promise<LoadedModel<SegmentationPipeline>> | undefined;
  let loadFraction = 0;

  // The model is loaded lazily, on the first image that survives validation, so
  // an invalid or oversized file fails before ~25 MB of weights are fetched.
  const getModel = (): Promise<LoadedModel<SegmentationPipeline>> => {
    pending ??= loadModel<SegmentationPipeline>({
      task: 'image-segmentation',
      model: MODEL_ID,
      signal: input.signal,
      onProgress: (progress: LoadProgress) => {
        for (const warning of progress.warnings) {
          if (!warnings.includes(warning)) warnings.push(warning);
        }
        loadFraction = progress.phase === 'ready' ? 1 : (progress.fraction ?? loadFraction);
        input.onProgress?.(loadFraction * LOAD_SHARE, progress.message);
      },
    });
    return pending;
  };

  try {
    const outputs = await runBatch<ProcessedFile>(
      input.files,
      {
        signal: input.signal,
        onProgress: (fraction, message) =>
          input.onProgress?.(LOAD_SHARE + fraction * (1 - LOAD_SHARE), message),
      },
      'Removing the background from',
      async (file, index) => {
        if (!file.size) {
          throw new ToolError(`“${file.name}” is empty.`, 'Choose a real image file.');
        }
        const bitmap = await decodeOriented(file);
        try {
          assertCanvasBudget(bitmap.width, bitmap.height, 'source image');
          const width = bitmap.width;
          const height = bitmap.height;

          // Draw once: the canvas is both the source of our pixels and the
          // input handed to the model (it preserves the EXIF-corrected decode).
          const canvas = createCanvas(width, height, 'source image');
          const ctx = context2d(canvas);
          ctx.drawImage(bitmap, 0, 0);
          const source = ctx.getImageData(0, 0, width, height).data;

          const model = await getModel();
          loaded = model;
          const result = await model.pipeline(canvas);
          const segment = Array.isArray(result) ? result[0] : result;
          if (!segment?.mask) {
            throw new ToolError(
              `The model could not isolate a subject in “${file.name}”.`,
              'MODNet is a portrait model — photos of a single person work best.',
            );
          }

          const cut = cutout(source, width, height, segment.mask, background, threshold);

          const output = createCanvas(width, height, 'output image');
          const outCtx = context2d(output);
          const frame = outCtx.createImageData(width, height);
          frame.data.set(cut.pixels);
          outCtx.putImageData(frame, 0, 0);
          const blob = await encodeCanvas(output, mime, quality);
          if (index === 0) {
            previewName = file.name;
            previewUrl = await beforeAfterDataUrl(canvas, output);
          }

          pixels += width * height;
          coverage += cut.coverage;
          return {
            filename: outputFilename(file.name, background, mime),
            blob,
            coverage: cut.coverage,
          };
        } finally {
          bitmap.close();
        }
      },
    );

    if (previewUrl) {
      notes.push(
        outputs.length > 1
          ? `The preview above is “${previewName}” — save the other files to see them.`
          : 'The preview above shows the original and the cut-out side by side.',
      );
    }
    if (loaded) {
      notes.push(
        loaded.fromCache
          ? 'The matting model was reused from your browser’s cache.'
          : `The matting model (${MODEL_ID}) was downloaded from the Hugging Face Hub and cached for next time.`,
      );
      notes.push(
        loaded.backend === 'webgpu'
          ? 'Running on your GPU via WebGPU.'
          : 'Running on your CPU (WASM) — no WebGPU adapter was available.',
      );
      if (loaded.fellBack) {
        warnings.push('WebGPU could not start, so the model was retried on the CPU.');
      }
    }
    notes.push(
      'Only the model weights are downloaded from huggingface.co on first use — your images never leave this device.',
    );

    const averageCoverage = outputs.length ? coverage / outputs.length : 0;

    return {
      outputs: outputs.map(({ filename, blob }) => ({ filename, blob })),
      report: previewUrl ? { output: previewUrl, render: 'image' } : undefined,
      notes,
      warnings: warnings.length ? warnings : undefined,
      stats: {
        files: outputs.length,
        megapixels: Math.round((pixels / 1_000_000) * 100) / 100,
        subject: `${Math.round(averageCoverage * 100)}% of the frame`,
        background:
          background.kind === 'transparent'
            ? 'transparent'
            : `#${[background.r, background.g, background.b]
                .map((channel) => channel.toString(16).padStart(2, '0'))
                .join('')}`,
        format: extension(mime),
      },
    };
  } finally {
    await loaded?.dispose();
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
