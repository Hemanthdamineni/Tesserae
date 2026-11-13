/**
 * Pure, dependency-light logic for the audio-compress tool.
 *
 * Nothing here touches the DOM, a codec or the network: every export is a plain
 * computation over numbers and strings, so the presets, the bitrate maths, the
 * size estimates and the output file name can all be unit-tested in Node
 * without a browser codec. The browser-only parts (decoding, preparing and
 * encoding) live in `audio-compress.tool.ts` and reuse the shared `./encode`.
 */

import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                     */
/* -------------------------------------------------------------------------- */

/** Largest source file we are willing to decode and re-encode (2 GB). */
export const COMPRESS_MAX_SOURCE_BYTES = 2 * 1024 ** 3;
/** Longest clip we re-encode (1 hour). */
export const COMPRESS_MAX_DURATION_SECONDS = 3600;
/** Smallest target size the "specific size" preset accepts (megabytes). */
export const COMPRESS_MIN_TARGET_MB = 0.1;
/** Largest target size the "specific size" preset accepts (megabytes). */
export const COMPRESS_MAX_TARGET_MB = 2048;

/* -------------------------------------------------------------------------- */
/*  Formats                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Compressing an audio file only makes sense with a lossy codec — WAV is
 * lossless and never shrinks. MP3 is the most compatible; Opus sounds better
 * at the same bitrate and is usually smaller.
 */
export type CompressFormat = 'mp3' | 'opus';

/** The output formats, in the order they appear in the UI select. */
export const COMPRESS_FORMATS: readonly CompressFormat[] = ['mp3', 'opus'];

/** Human name for each format. */
export const FORMAT_LABELS: Record<CompressFormat, string> = {
  mp3: 'MP3',
  opus: 'Opus / OGG',
};

/** File extension for each output format. */
export const FORMAT_EXT: Record<CompressFormat, string> = {
  mp3: 'mp3',
  opus: 'opus',
};

/** MIME type used for each output Blob. */
export const FORMAT_MIME: Record<CompressFormat, string> = {
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
};

/** Floor / ceiling for each codec's bitrate, in kbps. */
export const BITRATE_RANGE: Record<CompressFormat, readonly [number, number]> = {
  mp3: [32, 320],
  opus: [32, 256],
};

/** Validate the requested output format and return the canonical key. */
export function resolveFormat(value: unknown): CompressFormat {
  const format = String(value ?? 'mp3').toLowerCase();
  if (!(COMPRESS_FORMATS as readonly string[]).includes(format)) {
    throw new ToolError(
      `“${format}” is not a supported output format.`,
      'Choose MP3 or Opus/OGG.',
    );
  }
  return format as CompressFormat;
}

/* -------------------------------------------------------------------------- */
/*  Presets                                                                    */
/* -------------------------------------------------------------------------- */

export type CompressionPresetId =
  | 'size-50'
  | 'size-25'
  | 'size-target'
  | 'quality-high'
  | 'quality-medium'
  | 'quality-low';

export interface CompressionPreset {
  id: CompressionPresetId;
  /** Shown in the option picker. */
  label: string;
  /** One line explaining what the preset does. */
  description: string;
  /** Fraction of the source size this preset aims for (size presets only). */
  sizeFactor: number | null;
  /** A fixed bitrate in kbps per format (quality presets only). */
  bitrate: Partial<Record<CompressFormat, number>> | null;
}

/**
 * The compression presets.
 *
 * The size presets aim at a concrete file size, which is what people usually
 * mean by "compress this audio" (mail attachments, upload limits). The quality
 * presets aim at a bitrate instead and let the size fall where it may.
 */
export const COMPRESSION_PRESETS: readonly CompressionPreset[] = [
  {
    id: 'size-50',
    label: '50% smaller — half the size of the original',
    description: 'Halves the file size by lowering the bitrate.',
    sizeFactor: 0.5,
    bitrate: null,
  },
  {
    id: 'size-25',
    label: '25% smaller — a quarter of the original size',
    description: 'A quarter of the original size. Audible quality loss on music.',
    sizeFactor: 0.25,
    bitrate: null,
  },
  {
    id: 'size-target',
    label: 'A specific target size',
    description: 'Encodes to the size you ask for, in megabytes.',
    sizeFactor: null,
    bitrate: null,
  },
  {
    id: 'quality-high',
    label: 'High quality — keep the sound, spend the bits',
    description: 'A generous bitrate. Rarely much smaller than the original.',
    sizeFactor: null,
    bitrate: { mp3: 320, opus: 192 },
  },
  {
    id: 'quality-medium',
    label: 'Medium quality — a good everyday balance',
    description: 'Roughly 192 kbps MP3. Barely audible difference on most speakers.',
    sizeFactor: null,
    bitrate: { mp3: 192, opus: 128 },
  },
  {
    id: 'quality-low',
    label: 'Low quality — smallest possible file',
    description: 'Best for speech and for sharing on slow links.',
    sizeFactor: null,
    bitrate: { mp3: 96, opus: 64 },
  },
];

/** Look up a preset, failing loudly on an unknown value. */
export function compressionPreset(value: unknown): CompressionPreset {
  const id = String(value ?? 'size-50').trim() || 'size-50';
  const preset = COMPRESSION_PRESETS.find((p) => p.id === id);
  if (!preset) {
    throw new ToolError(
      `“${id}” is not a known compression preset.`,
      `Choose one of: ${COMPRESSION_PRESETS.map((p) => p.id).join(', ')}.`,
    );
  }
  return preset;
}

/* -------------------------------------------------------------------------- */
/*  Source information                                                         */
/* -------------------------------------------------------------------------- */

/** What we know about the clip before we can plan the re-encode. */
export interface CompressSourceInfo {
  /** Size of the source file in bytes. */
  fileSize: number;
  /** Duration in seconds. */
  durationSeconds: number;
  /** Channel count of the source, when known. */
  channels: number | null;
  /** Sample rate of the source, when known. */
  sampleRate: number | null;
}

/** The concrete plan for the re-encode. */
export interface CompressSettings {
  /** The preset the plan was derived from. */
  presetId: CompressionPresetId;
  /** Format the result is written into. */
  format: CompressFormat;
  /** File extension of the result. */
  extension: string;
  /** Output bitrate in kbps. */
  bitrate: number;
  /** The size the preset aims for, when it is a size preset. */
  targetBytes: number | null;
  /** Rough estimate of the produced file size, in bytes. */
  estimatedBytes: number;
  /** Things worth telling the user before/after the run. */
  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/*  Option reading                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Read a numeric option.
 *
 * An empty value means "use the default" — the shared form submits an empty
 * string for a field the user cleared. Anything else that is not a number is an
 * error: silently falling back to the default would hand the user a file they
 * did not ask for.
 */
function readNumber(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') {
    throw new ToolError(`${label} must be a number.`, `Enter a number, not “${String(value)}”.`);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return fallback;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new ToolError(`${label} must be a number.`, `“${trimmed}” is not a number.`);
    }
    return parsed;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ToolError(`${label} must be a number.`, 'Enter a number, such as 10.');
  }
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Estimated encoded bytes from a bitrate (kbps) and a duration (seconds). */
export function estimateBytes(bitrateKbps: number, durationSeconds: number): number {
  return Math.round((bitrateKbps * 1000 * durationSeconds) / 8);
}

/** Bitrate in kbps that hits a target byte count within a codec's range. */
export function bitrateForTarget(
  targetBytes: number,
  durationSeconds: number,
  format: CompressFormat,
): number {
  const [min, max] = BITRATE_RANGE[format];
  if (durationSeconds <= 0) return min;
  const kbps = Math.round((targetBytes * 8) / durationSeconds / 1000);
  return clamp(kbps, min, max);
}

/**
 * Turn the user's options into a concrete re-encode plan.
 *
 * Every failure is a `ToolError` with a human hint: an unknown preset, an empty
 * file, a clip of unknown length and so on must never silently produce a wrong
 * file.
 */
export function resolveCompressSettings(
  options: Record<string, unknown>,
  source: CompressSourceInfo,
): CompressSettings {
  const preset = compressionPreset(options.preset);
  const format = resolveFormat(options.format);
  const warnings: string[] = [];

  if (!Number.isFinite(source.fileSize) || source.fileSize <= 0) {
    throw new ToolError('This file is empty (0 bytes).');
  }
  if (!Number.isFinite(source.durationSeconds) || source.durationSeconds <= 0) {
    throw new ToolError(
      'The length of this clip could not be read, so the size cannot be calculated.',
      'Re-export the audio — the file may be truncated.',
    );
  }
  if (source.durationSeconds > COMPRESS_MAX_DURATION_SECONDS) {
    throw new ToolError(
      `This clip is ${Math.round(source.durationSeconds / 60)} minutes long — longer than the ${COMPRESS_MAX_DURATION_SECONDS / 60} minute limit.`,
      'Trim the clip first, or split it into parts and compress them one by one.',
    );
  }

  const [bitrateMin, bitrateMax] = BITRATE_RANGE[format];
  let targetBytes: number | null = null;
  let bitrate: number;

  if (preset.id === 'size-target') {
    const targetMb = readNumber(options.targetSize, 0, 'The target size');
    if (!Number.isFinite(targetMb) || targetMb <= 0) {
      throw new ToolError(
        'Enter the target size in megabytes.',
        `Pick a size between ${COMPRESS_MIN_TARGET_MB} MB and ${COMPRESS_MAX_TARGET_MB} MB.`,
      );
    }
    if (targetMb < COMPRESS_MIN_TARGET_MB) {
      throw new ToolError(
        `The target size must be at least ${COMPRESS_MIN_TARGET_MB} MB.`,
        'A file that small cannot hold usable audio.',
      );
    }
    if (targetMb > COMPRESS_MAX_TARGET_MB) {
      throw new ToolError(
        `The target size must be ${COMPRESS_MAX_TARGET_MB} MB or less (you asked for ${targetMb} MB).`,
      );
    }
    targetBytes = Math.round(targetMb * 1024 * 1024);
    if (targetBytes >= source.fileSize) {
      warnings.push(
        `The target size (${targetMb} MB) is bigger than the source file, so the original size was used as the ceiling — a re-encode never needs to make a file larger.`,
      );
      targetBytes = source.fileSize;
    }
    bitrate = bitrateForTarget(targetBytes, source.durationSeconds, format);
  } else if (preset.sizeFactor != null) {
    targetBytes = Math.round(source.fileSize * preset.sizeFactor);
    bitrate = bitrateForTarget(targetBytes, source.durationSeconds, format);
  } else {
    // Quality preset: a fixed, codec-appropriate bitrate.
    bitrate = clamp(
      preset.bitrate?.[format] ?? (format === 'mp3' ? 192 : 128),
      bitrateMin,
      bitrateMax,
    );
  }

  const estimatedBytes = estimateBytes(bitrate, source.durationSeconds);

  if (targetBytes != null && estimatedBytes > targetBytes * 1.05) {
    warnings.push(
      `Even at the lowest bitrate this tool allows, the clip comes out around ${(estimatedBytes / 1024 / 1024).toFixed(1)} MB — a little larger than the ${(targetBytes / 1024 / 1024).toFixed(1)} MB target.`,
    );
  }
  if (targetBytes != null && estimatedBytes >= source.fileSize) {
    warnings.push(
      'The compressed file is expected to be the same size as (or bigger than) the original — the source was already compressed hard, so there is little to gain.',
    );
  }

  return {
    presetId: preset.id,
    format,
    extension: FORMAT_EXT[format],
    bitrate,
    targetBytes,
    estimatedBytes,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/*  Reporting                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * How much smaller (or bigger) the result is, in words.
 * `42% smaller`, `3% larger` or `the same size`.
 */
export function formatSizeChange(sourceBytes: number, outputBytes: number): string {
  if (!Number.isFinite(sourceBytes) || sourceBytes <= 0) return 'an unknown size';
  if (!Number.isFinite(outputBytes) || outputBytes < 0) return 'an unknown size';
  const delta = (outputBytes - sourceBytes) / sourceBytes;
  const percent = Math.round(Math.abs(delta) * 100);
  if (percent === 0) return 'the same size';
  return delta < 0 ? `${percent}% smaller` : `${percent}% larger`;
}

/** The signed change in size, as a percentage (negative = smaller). */
export function sizeChangePercent(sourceBytes: number, outputBytes: number): number {
  if (!Number.isFinite(sourceBytes) || sourceBytes <= 0) return 0;
  if (!Number.isFinite(outputBytes)) return 0;
  return Math.round(((outputBytes - sourceBytes) / sourceBytes) * 1000) / 10;
}

/**
 * `holiday clip.wav` → `holiday clip-compressed.mp3`.
 * Unicode is preserved and path separators are neutralised.
 */
export function compressOutputFilename(sourceName: string, extension: string): string {
  const cleaned = String(sourceName ?? '').replace(/[\\/]/g, '_');
  const base = cleaned.replace(/\.[^.]*$/, '').trim();
  const ext = String(extension ?? 'mp3').replace(/^\./, '') || 'mp3';
  return `${base || 'audio'}-compressed.${ext}`;
}