/**
 * Audio compressor.
 *
 * The file is decoded (Web Audio), down-mixed / re-sampled to the chosen
 * layout, then re-encoded to MP3 (lazy-loaded lamejs) or Opus/OGG (WebCodecs)
 * by the shared `./encode` module — the same encoders `audio-convert` uses, so
 * the two tools stay consistent. Nothing leaves the device.
 *
 * The pure parts — the presets, the bitrate maths flagged above the actual
 * encode and the output file name — live in `./audio-compress.core` so they
 * can be unit-tested without a browser codec.
 */

import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes } from '@/lib/format';
import { decodeFile, formatDuration, type DecodedAudio } from './lib';
import { encodeFormat, prepare, type PrepareOptions } from './encode';
import {
  compressOutputFilename,
  formatSizeChange,
  resolveCompressSettings,
  sizeChangePercent,
  COMPRESS_MAX_SOURCE_BYTES,
  type CompressSourceInfo,
} from './audio-compress.core';
import { resolveChannelMode, resolveSampleRate } from './audio-convert.core';
import { meta } from './audio-compress.meta';

/** The seams the tests use to drive the tool without a browser codec. */
export interface AudioCompressDeps {
  /** Decodes the source file (the shared Web-Audio decoder). */
  decode?: (file: File) => Promise<DecodedAudio>;
  /** Encodes prepared channels to a Blob. */
  encode?: (
    channels: Float32Array[],
    sampleRate: number,
    format: 'mp3' | 'opus',
    bitrate: number,
    onProgress: ((fraction: number, message?: string) => void) | undefined,
  ) => Promise<{ blob: Blob; frames: number; bytes: number }>;
}

/** Turn decoded audio into the source info the bitrate maths needs. */
function sourceInfoFromAudio(audio: DecodedAudio): CompressSourceInfo {
  const channels = audio.channels.length;
  const frames = audio.channels[0]?.length ?? 0;
  return {
    fileSize: audio.byteSize,
    durationSeconds: audio.sampleRate > 0 ? frames / audio.sampleRate : 0,
    channels,
    sampleRate: audio.sampleRate,
  };
}

/**
 * Compress one file and turn it into the workbench's result shape: the
 * compressed file as a download, an inline before/after table and the notes.
 */
export async function runAudioCompress(
  input: FileRunInput,
  deps: AudioCompressDeps = {},
): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options) as Record<string, unknown>;
  const { files, signal, onProgress } = input;

  if (!files.length) throw new ToolError('Choose an audio file.');
  if (files.length > 1) {
    throw new ToolError(`Choose one audio file — ${files.length} were selected.`);
  }
  const file = files[0]!;
  if (file.size > COMPRESS_MAX_SOURCE_BYTES) {
    throw new ToolError('That file is too large to compress on this device.');
  }
  signal?.throwIfAborted?.();

  onProgress?.(0.1, 'Decoding the audio');
  const decode = deps.decode ?? decodeFile;
  const audio = await decode(file);
  const source = sourceInfoFromAudio(audio);

  onProgress?.(0.4, 'Working out the settings');
  const settings = resolveCompressSettings(o, source);
  signal?.throwIfAborted?.();

  const prep = prepare(audio, {
    channelMode: resolveChannelMode(o.channels),
    sampleRate: resolveSampleRate(o.sampleRate, audio.sampleRate),
  } satisfies PrepareOptions);

  const encode = deps.encode ?? encodeFormat;
  const encoded = await encode(
    prep.channels,
    prep.sampleRate,
    settings.format,
    settings.bitrate,
    (fraction, message) => onProgress?.(0.4 + fraction * 0.6, message),
  );

  const sourceBytes = source.fileSize;
  const outputBytes = encoded.bytes > 0 ? encoded.bytes : encoded.blob.size;
  const filename = compressOutputFilename(file.name, settings.extension);
  const blob = encoded.blob;
  const outDuration = source.durationSeconds;

  const warnings = [...settings.warnings];
  if (outputBytes >= sourceBytes) {
    warnings.push(
      'The compressed file came out the same size as (or bigger than) the original — the source was already compressed hard, so there was little to gain.',
    );
  }

  const notes = [
    `Source ${formatBytes(sourceBytes)} → compressed ${formatBytes(outputBytes)} (${formatSizeChange(sourceBytes, outputBytes)}).`,
    `Re-encoded as ${settings.extension.toUpperCase()} at ${settings.bitrate} kbps (${settings.presetId}).`,
    `Duration ${formatDuration(outDuration)} · ${settings.bitrate} kbps → roughly ${formatBytes(settings.estimatedBytes)}.`,
  ];

  const report = {
    output: JSON.stringify({
      headers: ['Property', 'Value'],
      rows: [
        [
          'Source size',
          `${formatBytes(sourceBytes)} (${sourceBytes.toLocaleString('en-US')} bytes)`,
        ],
        [
          'Compressed size',
          `${formatBytes(outputBytes)} (${outputBytes.toLocaleString('en-US')} bytes)`,
        ],
        [
          'Change',
          `${formatSizeChange(sourceBytes, outputBytes)} (${sizeChangePercent(sourceBytes, outputBytes)}%)`,
        ],
        ['Duration', formatDuration(outDuration)],
        ['Format', settings.extension.toUpperCase()],
        ['Bitrate', `${settings.bitrate} kbps`],
        ['Preset', settings.presetId],
        ['Estimated size', formatBytes(settings.estimatedBytes)],
      ],
    }),
    render: 'table' as const,
  };

  return {
    outputs: [{ filename, blob }],
    report,
    notes,
    warnings: warnings.length ? warnings : undefined,
    stats: {
      sourceBytes,
      outputBytes,
      savedBytes: sourceBytes - outputBytes,
      savedPercent: sizeChangePercent(sourceBytes, outputBytes),
      durationSeconds: Math.round(outDuration * 100) / 100,
      bitrate: settings.bitrate,
      format: settings.format,
    },
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runAudioCompress(input);
}

const tool: FileToolModule = { meta, run };
export default tool;