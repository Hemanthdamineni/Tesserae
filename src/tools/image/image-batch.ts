/**
 * Shared helpers for the batch image tools (compress / convert / resize /
 * crop / rotate / metadata / palette).
 *
 * Deliberately kept in a new module rather than editing `src/lib/image.ts` or
 * `./common.ts` — those are owned by separate workstreams. Everything here is
 * pure except the canvas/bitmap calls, and every failure path raises a friendly
 * `ToolError` instead of crashing the tab.
 */
import { ToolError } from '@/lib/types';

/** Practical per-side canvas limit shared by all major browsers (~16k px). */
export const MAX_CANVAS_EDGE = 16_384;
/** Pixel budget: refuse anything above this so a huge image cannot crash the tab. */
export const MAX_CANVAS_PIXELS = 100_000_000;

const UNSUPPORTED = 'Try a recent Chrome, Edge, Firefox or Safari.';

/**
 * Guard a canvas/bitmap size against browser limits. Called both for the
 * decoded source (a huge decode is what usually exhausts memory) and for the
 * output canvas (e.g. an aggressive upscale).
 */
export function assertCanvasBudget(width: number, height: number, label = 'image'): void {
  const w = Math.round(width);
  const h = Math.round(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
    throw new ToolError(`The ${label} has no measurable size.`);
  }
  if (w > MAX_CANVAS_EDGE || h > MAX_CANVAS_EDGE || w * h > MAX_CANVAS_PIXELS) {
    throw new ToolError(
      `That ${label} is too large to process safely (${w}×${h} pixels).`,
      `The limit is ${MAX_CANVAS_PIXELS.toLocaleString()} pixels and ${MAX_CANVAS_EDGE.toLocaleString()} px per side. Resize it first, then try again.`,
    );
  }
}

/** Create a fresh OffscreenCanvas after enforcing the pixel budget. */
export function createCanvas(width: number, height: number, label = 'output'): OffscreenCanvas {
  assertCanvasBudget(width, height, label);
  if (typeof OffscreenCanvas === 'undefined') {
    throw new ToolError('Your browser does not support OffscreenCanvas.', UNSUPPORTED);
  }
  return new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
}

/** Get a 2D context, or fail with a friendly message. */
export function context2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ToolError('Your browser could not create a 2D drawing context.', UNSUPPORTED);
  return ctx;
}

/**
 * Decode a Blob into an ImageBitmap, honouring EXIF orientation when the
 * browser supports it. We ask for `imageOrientation: 'from-image'` explicitly so
 * phone photos are not sideways. If the engine rejects the option bag we fall
 * back to a plain decode rather than guessing an angle and flipping wrongly.
 */
export async function decodeOriented(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'function') {
    throw new ToolError('Your browser does not support createImageBitmap.', UNSUPPORTED);
  }
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // Older engines throw when handed an options bag — retry with defaults.
  }
  try {
    return await createImageBitmap(blob);
  } catch {
    throw new ToolError(
      'That file could not be decoded as an image.',
      'Check that it is a valid PNG, JPEG, WebP, GIF or BMP file.',
    );
  }
}

/** True when a canvas-encodable format keeps an alpha channel. */
export function keepsAlpha(mime: string): boolean {
  return mime !== 'image/jpeg';
}

/**
 * JPEG has no alpha channel, so transparent pixels must be flattened onto a
 * solid colour first. PNG / WebP / AVIF keep transparency, so this is a no-op
 * for them.
 */
export function flattenForJpeg(
  ctx: OffscreenCanvasRenderingContext2D,
  mime: string,
  width: number,
  height: number,
  background = '#ffffff',
): void {
  if (keepsAlpha(mime)) return;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Encode RGBA pixel data as a 32-bit bottom-up Windows BMP (BGRA, no
 * compression). The 40-byte BITMAPINFOHEADER keeps the file as lean as
 * possible while still carrying full alpha.
 */
function encodeBmpPixels(width: number, height: number, pixels: Uint8ClampedArray): Uint8Array {
  const rowSize = width * 4; // 32-bit pixels are always 4-byte aligned
  const dataSize = rowSize * height;
  const offset = 14 + 40; // BITMAPFILEHEADER + BITMAPINFOHEADER
  const fileSize = offset + dataSize;
  const out = new Uint8Array(fileSize);
  const dv = new DataView(out.buffer);

  // BITMAPFILEHEADER
  dv.setUint8(0, 0x42); // 'B'
  dv.setUint8(1, 0x4d); // 'M'
  dv.setUint32(2, fileSize, true); // bfSize
  dv.setUint32(6, 0, true); // bfReserved1+2
  dv.setUint32(10, offset, true); // bfOffBits

  // BITMAPINFOHEADER
  dv.setUint32(14, 40, true); // biSize
  dv.setInt32(18, width, true); // biWidth
  dv.setInt32(22, height, true); // biHeight (positive = bottom-up)
  dv.setUint16(26, 1, true); // biPlanes
  dv.setUint16(28, 32, true); // biBitCount
  dv.setUint32(30, 0, true); // biCompression (BI_RGB)
  dv.setUint32(34, dataSize, true); // biSizeImage
  dv.setInt32(38, 2835, true); // biXPelsPerMeter (72 dpi)
  dv.setInt32(42, 2835, true); // biYPelsPerMeter
  dv.setUint32(46, 0, true); // biClrUsed
  dv.setUint32(50, 0, true); // biClrImportant

  // Pixels: bottom-up, BGRA. Each row starts at offset + (height - 1 - y) * rowSize.
  for (let y = 0; y < height; y++) {
    const srcRow = y * width * 4;
    const dstRow = offset + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const s = srcRow + x * 4;
      const d = dstRow + x * 4;
      out[d] = pixels[s + 2] ?? 0; // B
      out[d + 1] = pixels[s + 1] ?? 0; // G
      out[d + 2] = pixels[s] ?? 0; // R
      out[d + 3] = pixels[s + 3] ?? 0; // A
    }
  }
  return out;
}

/** Encode a canvas, failing with a friendly message when the format is unsupported. */
export async function encodeCanvas(
  canvas: OffscreenCanvas,
  mime: string,
  quality?: number,
): Promise<Blob> {
  // BMP is not browser-encodable via convertToBlob, so hand-encode it from the
  // 2d context pixels. This gives the tool true client-side BMP output.
  if (mime === 'image/bmp') {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = context2d(canvas);
    const img = ctx.getImageData(0, 0, w, h);
    const bmpBytes = encodeBmpPixels(w, h, img.data);
    return new Blob([bmpBytes.buffer as ArrayBuffer], { type: 'image/bmp' });
  }
  const blob = await canvas.convertToBlob({ type: mime, quality });
  if (blob.type !== mime) {
    const label = mime.replace('image/', '').toUpperCase();
    throw new ToolError(
      `This browser cannot encode ${label} images.`,
      'Try PNG or WebP, which every modern browser supports.',
    );
  }
  return blob;
}

export interface BatchEnv {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/** Throw an AbortError when the caller has cancelled. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
}

/**
 * Process every file in order, reporting progress and honouring cancellation.
 * Results come back in input order so callers can map them 1:1.
 */
export async function runBatch<T>(
  files: File[],
  env: BatchEnv,
  verb: string,
  process: (file: File, index: number) => Promise<T>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < files.length; i++) {
    throwIfAborted(env.signal);
    const file = files[i]!;
    env.onProgress?.(i / files.length, `${verb} ${file.name}`);
    out.push(await process(file, i));
  }
  env.onProgress?.(1, 'Done');
  return out;
}
