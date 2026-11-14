import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import { getTool } from '@/lib/registry';
import { getContent } from '@/lib/content';
import {
  compressionPreset,
  compressOutputFilename,
  bitrateForTarget,
  estimateBytes,
  formatSizeChange,
  resolveCompressSettings,
  resolveFormat,
  sizeChangePercent,
  COMPRESSION_PRESETS,
  FORMAT_EXT,
  FORMAT_MIME,
  type CompressSourceInfo,
} from './audio-compress.core';
import { runAudioCompress } from './audio-compress.tool';
import { meta } from './audio-compress.meta';

/** A short stereo clip used as the mocked decode result. */
const source: CompressSourceInfo = {
  fileSize: 1_000_000, // ~1 MB
  durationSeconds: 30,
  channels: 2,
  sampleRate: 44100,
};

describe('audio-compress core — format selection', () => {
  it('accepts the two supported formats', () => {
    expect(resolveFormat('mp3')).toBe('mp3');
    expect(resolveFormat('opus')).toBe('opus');
    expect(resolveFormat('MP3')).toBe('mp3');
    expect(resolveFormat(undefined)).toBe('mp3');
  });

  it('rejects an unsupported format (WAV is lossless, so not a compress target)', () => {
    expect(() => resolveFormat('wav')).toThrow(ToolError);
    expect(() => resolveFormat('flac')).toThrow(ToolError);
  });
});

describe('audio-compress core — presets', () => {
  it('looks up a known preset', () => {
    expect(compressionPreset('size-50').id).toBe('size-50');
    expect(compressionPreset(undefined).id).toBe('size-50');
    expect(compressionPreset('quality-medium').bitrate?.mp3).toBe(192);
  });

  it('rejects an unknown preset', () => {
    expect(() => compressionPreset('size-90')).toThrow(ToolError);
  });

  it('exposes the full preset list for the picker', () => {
    expect(COMPRESSION_PRESETS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('audio-compress core — bitrate maths', () => {
  it('estimates bytes from a bitrate and duration', () => {
    // 128 kbps for 30 s = 128 * 1000 * 30 / 8 = 480,000 bytes.
    expect(estimateBytes(128, 30)).toBe(480_000);
  });

  it('picks a bitrate that hits a target size, clamped to the codec range', () => {
    // Target 480 KB in 30 s → exactly 128 kbps.
    expect(bitrateForTarget(480_000, 30, 'mp3')).toBe(128);
    // A tiny target clamps to the floor.
    expect(bitrateForTarget(1_000, 1000, 'mp3')).toBe(32);
    // A huge target clamps to the ceiling.
    expect(bitrateForTarget(10_000_000_000, 30, 'mp3')).toBe(320);
    expect(bitrateForTarget(10_000_000_000, 30, 'opus')).toBe(256);
  });
});

describe('audio-compress core — settings', () => {
  it('size-50 targets half the source bytes', () => {
    const s = resolveCompressSettings({ preset: 'size-50' }, source);
    expect(s.presetId).toBe('size-50');
    expect(s.format).toBe('mp3');
    expect(s.targetBytes).toBe(500_000);
    expect(s.estimatedBytes).toBeGreaterThan(0);
  });

  it('size-25 targets a quarter of the source bytes', () => {
    const s = resolveCompressSettings({ preset: 'size-25', format: 'opus' }, source);
    expect(s.format).toBe('opus');
    expect(s.extension).toBe('opus');
    expect(s.targetBytes).toBe(250_000);
  });

  it('size-target honours a specific size and clamps to the source ceiling', () => {
    const s = resolveCompressSettings({ preset: 'size-target', targetSize: '0.5' }, source);
    // 0.5 MB = 524,288 bytes — below the 1 MB source, so it stays.
    expect(s.targetBytes).toBe(524_288);

    // A target bigger than the source clamps down to the source and warns.
    const big = resolveCompressSettings({ preset: 'size-target', targetSize: '50' }, source);
    expect(big.targetBytes).toBe(source.fileSize);
    expect(big.warnings.some((w) => /bigger than the source/.test(w))).toBe(true);
  });

  it('rejects an invalid target size', () => {
    expect(() =>
      resolveCompressSettings({ preset: 'size-target', targetSize: '0' }, source),
    ).toThrow(ToolError);
    expect(() =>
      resolveCompressSettings({ preset: 'size-target', targetSize: '0.01' }, source),
    ).toThrow(ToolError);
  });

  it('quality presets pick a fixed bitrate per codec', () => {
    expect(resolveCompressSettings({ preset: 'quality-high' }, source).bitrate).toBe(320);
    expect(resolveCompressSettings({ preset: 'quality-medium' }, source).bitrate).toBe(192);
    expect(resolveCompressSettings({ preset: 'quality-low', format: 'opus' }, source).bitrate).toBe(
      64,
    );
  });

  it('rejects an empty file and a clip of unknown length', () => {
    expect(() =>
      resolveCompressSettings({}, { ...source, fileSize: 0 }),
    ).toThrow(/empty/);
    expect(() =>
      resolveCompressSettings({}, { ...source, durationSeconds: 0 }),
    ).toThrow(/length/);
  });
});

describe('audio-compress core — reporting', () => {
  it('describes the size change in words', () => {
    expect(formatSizeChange(1_000_000, 500_000)).toBe('50% smaller');
    expect(formatSizeChange(1_000_000, 1_000_000)).toBe('the same size');
    expect(formatSizeChange(1_000_000, 1_100_000)).toBe('10% larger');
  });

  it('computes a signed percentage (negative = smaller)', () => {
    expect(sizeChangePercent(1_000_000, 500_000)).toBe(-50);
    expect(sizeChangePercent(1_000_000, 1_100_000)).toBe(10);
  });

  it('names the output with a -compressed suffix', () => {
    expect(compressOutputFilename('holiday clip.wav', 'mp3')).toBe('holiday clip-compressed.mp3');
    expect(compressOutputFilename('song', 'opus')).toBe('song-compressed.opus');
    expect(compressOutputFilename('.hidden.wav', 'mp3')).toBe('.hidden-compressed.mp3');
  });
});

describe('audio-compress run', () => {
  /** A decode result whose channels sum to the source info above. */
  const decoded = {
    channels: [new Float32Array(44100 * 30), new Float32Array(44100 * 30)],
    sampleRate: 44100,
    byteSize: source.fileSize,
    mimeType: 'audio/wav',
  };

  it('rejects when no file is provided', async () => {
    await expect(runAudioCompress({ files: [], options: {} })).rejects.toThrow(ToolError);
  });

  it('rejects more than one file', async () => {
    await expect(
      runAudioCompress({
        files: [new File(['x'], 'a.wav'), new File(['x'], 'b.wav')],
        options: {},
      }),
    ).rejects.toThrow(/one audio file/);
  });

  it('encodes to MP3 and reports before/after sizes', async () => {
    const blob = new Blob([new Uint8Array(400_000)], { type: 'audio/mpeg' });
    const result = await runAudioCompress(
      { files: [new File(['x'], 'tone.wav')], options: { preset: 'size-50' } },
      {
        decode: async () => decoded,
        encode: async (_ch, _sr, _f, _b) => ({ blob, frames: 0, bytes: blob.size }),
      },
    );
    const output = result.outputs[0];
    expect(output).toBeDefined();
    expect(output!.filename).toBe('tone-compressed.mp3');
    expect(output!.blob.type).toBe('audio/mpeg');
    expect(result.report).toBeDefined();
    expect(result.stats?.sourceBytes).toBe(source.fileSize);
    expect(result.stats?.outputBytes).toBe(400_000);
    expect(result.stats?.savedBytes).toBe(source.fileSize - 400_000);
  });

  it('warns when the result is not smaller than the source', async () => {
    const blob = new Blob([new Uint8Array(source.fileSize + 10)], { type: 'audio/mpeg' });
    const result = await runAudioCompress(
      { files: [new File(['x'], 'tone.wav')], options: { preset: 'size-50' } },
      {
        decode: async () => decoded,
        encode: async () => ({ blob, frames: 0, bytes: blob.size }),
      },
    );
    expect(result.warnings?.some((w) => /same size as \(or bigger than\)/.test(w))).toBe(true);
  });
});

describe('audio-compress metadata contract', () => {
  it('declares the required content', () => {
    expect(meta.id).toBe('audio-compress');
    expect(meta.hidden).not.toBe(true);
    expect(meta.redirectTo).toBeUndefined();
    expect(meta.multiple).toBe(false);
    expect(meta.examples!.length).toBeGreaterThanOrEqual(3);
    expect(getContent(meta.id)?.faq?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(getContent(meta.id)?.article?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(getContent(meta.id)?.article?.length ?? 0).toBeLessThanOrEqual(5);
    expect(meta.credits?.some((c) => c.license === 'LGPL-3.0')).toBe(true);
    // Related ids must be visible tools.
    for (const rel of meta.related ?? []) {
      expect(getTool(rel)?.meta.hidden, `${rel} should be visible`).not.toBe(true);
    }
  });

  it('maps formats to extensions and MIME types', () => {
    expect(FORMAT_EXT.mp3).toBe('mp3');
    expect(FORMAT_EXT.opus).toBe('opus');
    expect(FORMAT_MIME.mp3).toBe('audio/mpeg');
    expect(FORMAT_MIME.opus).toBe('audio/ogg');
  });
});