import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, extension, parseHexColor, stem } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  flattenForJpeg,
  runBatch,
} from './image-batch';
import { meta } from './image-convert.meta';

const FORMATS = ['png', 'jpeg', 'webp', 'avif', 'bmp'] as const;

/** Identity helper kept for backwards-compatible imports. */
export function imageOutputType(mime: string): string {
  return mime;
}

/** Validate the requested target format and return its MIME type. */
export function convertMime(to: unknown): string {
  const value = String(to ?? 'webp');
  if (!(FORMATS as readonly string[]).includes(value)) {
    throw new ToolError(
      `“${value}” is not a supported output format.`,
      'Choose PNG, JPEG, WebP, AVIF or BMP.',
    );
  }
  return `image/${value}`;
}

/** Turn a hex colour into a CSS rgb() string for JPEG flattening. */
export function backgroundColor(value: unknown): string {
  const rgb = parseHexColor(String(value ?? '#ffffff'));
  if (!rgb) {
    throw new ToolError(
      'Enter the JPEG background as a hex colour, such as #ffffff.',
      'Use a 3- or 6-digit hex value.',
    );
  }
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  const targetMime = convertMime(o.to);
  const needsBackground = targetMime === 'image/jpeg';
  const background = needsBackground ? backgroundColor(o.background) : '#ffffff';
  const quality = Math.min(100, Math.max(10, Number(o.quality) || 90)) / 100;

  let originalBytes = 0;
  let outputBytes = 0;

  const outputs = await runBatch(input.files, input, 'Converting', async (file) => {
    originalBytes += file.size;
    const bitmap = await decodeOriented(file);
    try {
      assertCanvasBudget(bitmap.width, bitmap.height, 'source image');
      const canvas = createCanvas(bitmap.width, bitmap.height);
      const ctx = context2d(canvas);
      // JPEG has no alpha; flatten onto the chosen colour. PNG/WebP/AVIF keep alpha.
      flattenForJpeg(ctx, targetMime, canvas.width, canvas.height, background);
      ctx.drawImage(bitmap, 0, 0);
      const blob = await encodeCanvas(canvas, targetMime, quality);
      outputBytes += blob.size;
      return { filename: `${stem(file.name)}.${extension(targetMime)}`, blob };
    } finally {
      bitmap.close();
    }
  });

  return {
    outputs,
    stats: { files: outputs.length, originalBytes, outputBytes, format: targetMime },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
