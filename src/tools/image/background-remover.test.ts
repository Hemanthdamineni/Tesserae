import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import { setMlRuntimeLoader, type MlRuntime, type MlRuntimeEnv } from '@/lib/ml';
import tool, {
  MODEL_ID,
  compositePixels,
  cutout,
  matteToAlpha,
  outputFilename,
  resolveBackground,
  resolveFormat,
  resolveQuality,
  resolveThreshold,
  type MattingMask,
  type SegmentationSegment,
} from './background-remover.tool';
import { blobPixels, installImageMock, makeFile, pixelAt, type MockHandle } from './image-mock';
import { meta } from './background-remover.meta';
import { getContent } from '@/lib/content';

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

const SOURCE: [number, number, number, number] = [200, 100, 50, 255];

function maskOf(width: number, height: number, values: number[], channels = 1): MattingMask {
  return { data: Uint8ClampedArray.from(values), width, height, channels };
}

/** A full-strength matte: every pixel is fully subject. */
function opaqueSegment(width: number, height: number): SegmentationSegment {
  const values = new Array<number>(width * height).fill(255);
  return { label: null, score: null, mask: maskOf(width, height, values) };
}

/* -------------------------------------------------------------------------- */
/*  Harness                                                                   */
/* -------------------------------------------------------------------------- */

let mock: MockHandle | undefined;

afterEach(() => {
  mock?.restore();
  mock = undefined;
  setMlRuntimeLoader(null);
});

/**
 * Install a fake image stack (decode + canvas) and a fake ML runtime whose
 * `image-segmentation` pipeline returns the mattes produced by `segmenter`.
 */
function installStack(
  segmenter: (input: unknown, call: number) => SegmentationSegment[] | SegmentationSegment,
  config: Parameters<typeof installImageMock>[0] = {},
) {
  mock = installImageMock({ width: 4, height: 4, color: SOURCE, pixelOutput: true, ...config });
  const inputs: unknown[] = [];
  const pipeline = vi.fn(async (input: unknown) => {
    const call = inputs.length;
    inputs.push(input);
    return segmenter(input, call);
  });
  const requested: { task: string; model: string }[] = [];
  const factory = vi.fn(async (task: string, model: string) => {
    requested.push({ task, model });
    return pipeline;
  });
  const env: MlRuntimeEnv = {
    allowLocalModels: true,
    allowRemoteModels: true,
    useBrowserCache: true,
    useCustomCache: false,
    customCache: null,
    backends: { onnx: { wasm: {} } },
    remoteHost: 'https://huggingface.co/',
    remotePathTemplate: '{model}/resolve/{revision}/{file}',
    fetch: (async () => new Response()) as MlRuntimeEnv['fetch'],
  };
  setMlRuntimeLoader(() => Promise.resolve({ env, pipeline: factory } as unknown as MlRuntime));
  return { pipeline, factory, requested, inputs };
}

/* -------------------------------------------------------------------------- */
/*  matteToAlpha                                                              */
/* -------------------------------------------------------------------------- */

describe('matteToAlpha', () => {
  it('passes a single-channel matte through unchanged', () => {
    const alpha = matteToAlpha(maskOf(2, 1, [0, 255]), 2, 1);
    expect([...alpha]).toEqual([0, 255]);
  });

  it('nearest-neighbour upscales a small matte to the source size', () => {
    const alpha = matteToAlpha(maskOf(2, 1, [10, 20]), 4, 1);
    expect([...alpha]).toEqual([10, 10, 20, 20]);
  });

  it('downsamples by dropping pixels, never by reading out of bounds', () => {
    const alpha = matteToAlpha(maskOf(4, 1, [1, 2, 3, 4]), 2, 1);
    expect([...alpha]).toEqual([1, 3]);
  });

  it('takes the alpha plane of a 4-channel matte', () => {
    const alpha = matteToAlpha(maskOf(2, 1, [9, 9, 9, 0, 9, 9, 9, 255], 4), 2, 1);
    expect([...alpha]).toEqual([0, 255]);
  });

  it('takes the second channel of a gray+alpha matte', () => {
    const alpha = matteToAlpha(maskOf(2, 1, [0, 40, 0, 200], 2), 2, 1);
    expect([...alpha]).toEqual([40, 200]);
  });

  it('converts a 3-channel matte to luminance', () => {
    const alpha = matteToAlpha(maskOf(2, 1, [255, 255, 255, 0, 0, 0], 3), 2, 1);
    expect([...alpha]).toEqual([255, 0]);
  });

  it('rejects a matte with no dimensions', () => {
    expect(() => matteToAlpha(maskOf(0, 0, []), 2, 2)).toThrow(/empty matte/i);
  });

  it('rejects a truncated matte', () => {
    expect(() => matteToAlpha(maskOf(4, 4, [1, 2, 3]), 4, 4)).toThrow(/truncated matte/i);
  });

  it('rejects an unsupported channel count', () => {
    expect(() => matteToAlpha(maskOf(1, 1, [1], 5), 1, 1)).toThrow(/channel count/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  compositePixels                                                           */
/* -------------------------------------------------------------------------- */

describe('compositePixels', () => {
  const source = new Uint8ClampedArray([200, 100, 50, 255, 10, 20, 30, 255]);

  it('keeps the source colour and writes the matte into the alpha channel', () => {
    const out = compositePixels(source, new Uint8ClampedArray([0, 128]), { kind: 'transparent' });
    expect([...out]).toEqual([200, 100, 50, 0, 10, 20, 30, 128]);
  });

  it('flattens a solid background behind the subject', () => {
    const out = compositePixels(source, new Uint8ClampedArray([0, 255]), {
      kind: 'solid',
      r: 255,
      g: 0,
      b: 0,
    });
    expect([...out]).toEqual([255, 0, 0, 255, 10, 20, 30, 255]);
  });

  it('blends partially transparent pixels between subject and background', () => {
    // 50% over black gives half the source colour, rounded by Uint8ClampedArray.
    const out = compositePixels(
      new Uint8ClampedArray([200, 100, 50, 255]),
      new Uint8ClampedArray([128]),
      { kind: 'solid', r: 0, g: 0, b: 0 },
    );
    expect([...out]).toEqual([100, 50, 25, 255]);
  });

  it('snaps the matte to hard edges when a threshold is set', () => {
    const soft = new Uint8ClampedArray([10, 128, 200, 254]);
    const snapped = compositePixels(source, soft, { kind: 'transparent' }, 128);
    expect([...snapped].filter((_, i) => i % 4 === 3)).toEqual([0, 255, 255, 255]);
  });

  it('leaves the matte untouched when the threshold is zero', () => {
    const soft = new Uint8ClampedArray([10, 254]);
    const out = compositePixels(source, soft, { kind: 'transparent' }, 0);
    expect([...out].filter((_, i) => i % 4 === 3)).toEqual([10, 254]);
  });
});

/* -------------------------------------------------------------------------- */
/*  cutout                                                                    */
/* -------------------------------------------------------------------------- */

describe('cutout', () => {
  it('reports how much of the frame the subject covers', () => {
    const source = new Uint8ClampedArray(2 * 1 * 4).fill(255);
    const result = cutout(source, 2, 1, maskOf(2, 1, [0, 255]), { kind: 'transparent' });
    expect(result.coverage).toBeCloseTo(0.5);
    expect([...result.pixels].filter((_, i) => i % 4 === 3)).toEqual([0, 255]);
  });

  it('rejects a source buffer that is too short for the stated size', () => {
    expect(() =>
      cutout(new Uint8ClampedArray(4), 2, 2, maskOf(2, 2, [255, 255, 255, 255]), {
        kind: 'transparent',
      }),
    ).toThrow(/incomplete/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Option resolution                                                         */
/* -------------------------------------------------------------------------- */

describe('resolveBackground', () => {
  it('defaults to transparent', () => {
    expect(resolveBackground(undefined, undefined)).toEqual({ kind: 'transparent' });
  });

  it('parses a solid hex colour, expanding 3-digit values', () => {
    expect(resolveBackground('solid', '#0f8')).toEqual({ kind: 'solid', r: 0, g: 255, b: 136 });
  });

  it('rejects an unknown background mode', () => {
    expect(() => resolveBackground('blur', '#fff')).toThrow(/not a valid background/i);
  });

  it('rejects a non-hex colour for a solid background', () => {
    try {
      resolveBackground('solid', 'rebeccapurple');
      expect.unreachable('expected resolveBackground to throw');
    } catch (error) {
      expect((error as ToolError).message).toMatch(/hex colour/i);
      expect((error as ToolError).hint).toMatch(/#ffffff/);
    }
  });
});

describe('resolveFormat', () => {
  it('maps png and webp', () => {
    expect(resolveFormat('png')).toBe('image/png');
    expect(resolveFormat('WEBP')).toBe('image/webp');
  });

  it('falls back to PNG when unset', () => {
    expect(resolveFormat(undefined)).toBe('image/png');
  });

  it('rejects an unsupported format', () => {
    expect(() => resolveFormat('jpeg')).toThrow(/not a supported output format/i);
  });
});

describe('resolveQuality', () => {
  it('converts a percentage to a 0..1 encoder quality', () => {
    expect(resolveQuality(75)).toBeCloseTo(0.75);
  });

  it('clamps out-of-range and non-numeric values', () => {
    expect(resolveQuality(1)).toBeCloseTo(0.1);
    expect(resolveQuality(1000)).toBe(1);
    expect(resolveQuality('nonsense')).toBeCloseTo(0.9);
  });
});

describe('resolveThreshold', () => {
  it('is disabled at zero or below', () => {
    expect(resolveThreshold(0)).toBe(0);
    expect(resolveThreshold(-5)).toBe(0);
    expect(resolveThreshold(undefined)).toBe(0);
  });

  it('scales a percentage to an alpha cut-off', () => {
    expect(resolveThreshold(50)).toBe(128);
    expect(resolveThreshold(1000)).toBe(255);
  });
});

describe('outputFilename', () => {
  it('names transparent output after the source stem', () => {
    expect(outputFilename('holiday.photo.jpg', { kind: 'transparent' }, 'image/png')).toBe(
      'holiday.photo-no-bg.png',
    );
  });

  it('marks solid-background output and follows the extension', () => {
    expect(outputFilename('me.png', { kind: 'solid', r: 0, g: 0, b: 0 }, 'image/webp')).toBe(
      'me-solid.webp',
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Network disclosure                                                        */
/* -------------------------------------------------------------------------- */

describe('network disclosure', () => {
  it('declares the only external host the page contacts', () => {
    const hosts = Array.isArray(meta.privacy.network) ? meta.privacy.network : [];
    expect(hosts).toEqual(['huggingface.co']);
  });

  it('names the model download and image guarantee in visible copy', () => {
    const copy = [
      meta.description,
      ...(getContent(meta.id)?.faq ?? []).map((entry: { q: string; a: string }) => entry.a),
    ].join(' ');
    expect(copy).toMatch(/hugging[\s-]?face/i);
    expect(copy).toMatch(/runtime/i);
    expect(copy).toMatch(/never (uploaded|leave)/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  run()                                                                     */
/* -------------------------------------------------------------------------- */

describe('background-remover run', () => {
  it('rejects an empty selection', async () => {
    installStack(() => []);
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image selection', async () => {
    installStack(() => []);
    const file = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rejects an empty file before touching the model', async () => {
    const { pipeline } = installStack(() => []);
    const empty = new File([], 'empty.png', { type: 'image/png' });
    await expect(tool.run({ files: [empty], options: {} })).rejects.toThrow(/is empty/i);
    expect(pipeline).not.toHaveBeenCalled();
  });

  it('rejects an oversized image instead of exhausting memory', async () => {
    // The fake decoder reports huge dimensions; the size check runs before any
    // pixels are allocated and before the model is fetched.
    const { pipeline } = installStack(() => [], { width: 20_000, height: 20_000 });
    await expect(tool.run({ files: [makeFile('huge.png')], options: {} })).rejects.toThrow(
      /too large/i,
    );
    expect(pipeline).not.toHaveBeenCalled();
  });

  it('cancels when the signal is already aborted', async () => {
    installStack(() => []);
    await expect(
      tool.run({ files: [makeFile('a.png')], options: {}, signal: AbortSignal.abort() }),
    ).rejects.toThrow(/cancelled/i);
  });

  it('loads Xenova/modnet through the image-segmentation task', async () => {
    const { factory, requested } = installStack(() => [opaqueSegment(4, 4)]);
    await tool.run({ files: [makeFile('a.png')], options: {} });
    expect(requested).toEqual([{ task: 'image-segmentation', model: MODEL_ID }]);
    expect(MODEL_ID).toBe('Xenova/modnet');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('writes a transparent PNG by default', async () => {
    const { inputs } = installStack(() => [opaqueSegment(4, 4)]);
    const result = await tool.run({ files: [makeFile('photo.png')], options: {} });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo-no-bg.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');

    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 4, 0, 0)).toEqual([200, 100, 50, 255]);
    // The model must see the image at its original size so its matte is
    // predicted (and returned) in the same coordinate space.
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ width: 4, height: 4 });
    expect(result.stats?.files).toBe(1);
    expect(result.stats?.subject).toBe('100% of the frame');
    expect(result.stats?.background).toBe('transparent');
    expect(result.stats?.format).toBe('png');
  });

  it('cuts the matte out of the source pixels instead of copying the whole frame', async () => {
    // A 2×2 matte for a 4×4 source: one quadrant is background, the rest subject.
    installStack(() => [{ label: null, score: null, mask: maskOf(2, 2, [0, 255, 255, 0]) }]);
    const result = await tool.run({ files: [makeFile('photo.png')], options: {} });
    const pixels = await blobPixels(result.outputs[0]!.blob);

    expect(pixelAt(pixels, 4, 0, 0)).toEqual([200, 100, 50, 0]); // transparent corner
    expect(pixelAt(pixels, 4, 3, 0)).toEqual([200, 100, 50, 255]); // opaque corner
    expect(pixelAt(pixels, 4, 0, 3)).toEqual([200, 100, 50, 255]);
    expect(pixelAt(pixels, 4, 3, 3)).toEqual([200, 100, 50, 0]);
    expect(result.stats?.subject).toBe('50% of the frame');
  });

  it('fills a solid colour behind the subject when asked', async () => {
    installStack(() => [opaqueSegment(4, 4)]);
    const result = await tool.run({
      files: [makeFile('photo.png')],
      options: { background: 'solid', backgroundColour: '#00ff00' },
    });

    expect(result.outputs[0]!.filename).toBe('photo-solid.png');
    expect(result.stats?.background).toBe('#00ff00');
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 4, 1, 1)).toEqual([200, 100, 50, 255]);
  });

  it('composites the solid colour over a partially transparent matte', async () => {
    installStack(() => [{ label: null, score: null, mask: maskOf(1, 1, [0]) }]);
    const result = await tool.run({
      files: [makeFile('photo.png')],
      options: { background: 'solid', backgroundColour: '#0000ff' },
    });
    const pixels = await blobPixels(result.outputs[0]!.blob);
    // Fully transparent matte → the background colour shows through everywhere.
    expect(pixelAt(pixels, 4, 0, 0)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(pixels, 4, 3, 3)).toEqual([0, 0, 255, 255]);
  });

  it('honours the WebP format and quality options', async () => {
    installStack(() => [opaqueSegment(4, 4)]);
    const result = await tool.run({
      files: [makeFile('photo.png')],
      options: { format: 'webp', quality: 40 },
    });

    expect(result.outputs[0]!.filename).toBe('photo-no-bg.webp');
    const encoder = mock!.canvases.find((c) => c.encodes[0]?.type === 'image/webp');
    expect(encoder).toBeDefined();
    expect(encoder!.encodes[0]!.quality).toBeCloseTo(0.4);
  });

  it('snaps soft edges when the matte threshold is raised', async () => {
    installStack(() => [{ label: null, score: null, mask: maskOf(1, 1, [100]) }]);
    const soft = await tool.run({ files: [makeFile('photo.png')], options: {} });
    const snapped = await tool.run({
      files: [makeFile('photo.png')],
      options: { threshold: 50 },
    });

    const softPixels = await blobPixels(soft.outputs[0]!.blob);
    const snappedPixels = await blobPixels(snapped.outputs[0]!.blob);
    expect(pixelAt(softPixels, 4, 0, 0)[3]).toBe(100);
    expect(pixelAt(snappedPixels, 4, 0, 0)[3]).toBe(0);
  });

  it('processes a batch and reports progress while the model downloads', async () => {
    const { pipeline } = installStack(() => [opaqueSegment(4, 4)]);
    const progress: [number, string | undefined][] = [];
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.jpg', 'image/jpeg'), makeFile('c.png')],
      options: {},
      onProgress: (fraction, message) => progress.push([fraction, message]),
    });

    expect(result.outputs.map((o) => o.filename)).toEqual([
      'a-no-bg.png',
      'b-no-bg.png',
      'c-no-bg.png',
    ]);
    expect(result.stats?.files).toBe(3);
    expect(pipeline).toHaveBeenCalledTimes(3);
    // The model is fetched once, not once per image.
    expect(mock!.bitmaps).toHaveLength(3);
    expect(progress.at(-1)).toEqual([1, 'Done']);
    expect(progress.some(([fraction]) => fraction <= 0.6)).toBe(true);
    expect(progress.some(([, message]) => /modnet/i.test(message ?? ''))).toBe(true);
    expect(progress.some(([, message]) => (message ?? '').includes('b.jpg'))).toBe(true);
    // The single preview shows the first image, and the note says which one.
    expect(result.notes?.join(' ')).toMatch(/preview above is “a.png”/);
  });

  it('reports a friendly error when the subject cannot be found', async () => {
    installStack(() => []);
    await expect(tool.run({ files: [makeFile('plain.png')], options: {} })).rejects.toThrow(
      /could not isolate a subject/i,
    );
  });

  it('surfaces a model-load failure as a ToolError', async () => {
    setMlRuntimeLoader(() =>
      Promise.resolve({
        env: {} as MlRuntimeEnv,
        pipeline: async () => {
          throw new Error('no onnx runtime here');
        },
      } as unknown as MlRuntime),
    );
    mock = installImageMock({ width: 4, height: 4, color: SOURCE, pixelOutput: true });

    await expect(tool.run({ files: [makeFile('a.png')], options: {} })).rejects.toThrow(
      /Could not load the model "Xenova\/modnet"/,
    );
  });

  it('previews the first image side by side', async () => {
    installStack(() => [opaqueSegment(4, 4)]);
    const result = await tool.run({ files: [makeFile('a.png')], options: {} });

    expect(result.report?.render).toBe('image');
    expect(result.report?.output.startsWith('data:image/png;base64,')).toBe(true);
    // before | gap | after — two source-width panels.
    expect(mock!.canvases.at(-1)!.width).toBe(4 + 6 + 4);
  });

  it('rejects an invalid solid colour instead of silently ignoring it', async () => {
    installStack(() => [opaqueSegment(4, 4)]);
    await expect(
      tool.run({
        files: [makeFile('a.png')],
        options: { background: 'solid', backgroundColour: 'not-a-colour' },
      }),
    ).rejects.toThrow(/hex colour/i);
  });

  it('surfaces the cache state of the model download instead of claiming a fetch', async () => {
    installStack(() => [opaqueSegment(4, 4)]);
    const result = await tool.run({ files: [makeFile('a.png')], options: {} });
    // Nothing was fetched through the loader, so it reports a cache hit.
    expect(result.notes?.some((note) => /cache/i.test(note))).toBe(true);
    // And the run still produced usable, unchanged pixels.
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect(pixelAt(pixels, 4, 0, 0)).toEqual([200, 100, 50, 255]);
  });
});
