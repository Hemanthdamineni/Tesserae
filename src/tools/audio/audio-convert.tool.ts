import type { FileRunInput, FileRunResult, FileToolModule, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { decodeFile } from './lib';
import { encodeFormat, prepare, type PrepareOptions } from './encode';
import {
  opusSupported,
  outputFilename,
  outputMime,
  resolveBitrate,
  resolveChannelMode,
  resolveFormat,
  resolveSampleRate,
  type ConvertFormat,
} from './audio-convert.core';
import { meta } from './audio-convert.meta';

/** Resolve the shared preparation targets from the tool's own option names. */
function prepareOptions(o: Record<string, unknown>, sourceRate: number): PrepareOptions {
  return {
    channelMode: resolveChannelMode(o.channels),
    sampleRate: resolveSampleRate(o.sampleRate, sourceRate),
  };
}

/**
 * Encode one file and return its output Blob plus a short format label.
 * WAV, MP3 and Opus reuse the shared encoders; each lossy format selects its
 * own bitrate option, matching the convert UI (mp3Bitrate vs opusBitrate).
 */
async function encodeOne(
  audio: { channels: Float32Array[]; sampleRate: number },
  format: ConvertFormat,
  o: Record<string, unknown>,
  onProgress: ((fraction: number, message?: string) => void) | undefined,
): Promise<Blob> {
  const prep = prepare(audio, prepareOptions(o, audio.sampleRate));
  const bitrate = format === 'mp3' ? resolveBitrate(o.mp3Bitrate) : resolveBitrate(o.opusBitrate);
  const { blob } = await encodeFormat(prep.channels, prep.sampleRate, format, bitrate, onProgress);
  return blob;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options) as Record<string, unknown>;
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose at least one audio file.');

  const format = resolveFormat(o.format);
  if (format === 'opus' && !opusSupported()) {
    throw new ToolError(
      'Opus export is not supported in this browser.',
      'It needs the WebCodecs AudioEncoder (Chrome 94+). Choose WAV or MP3 here instead.',
    );
  }

  const outputs: OutputFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const start = i / files.length;
    onProgress?.(start, `Decoding ${file.name}`);
    const audio = await decodeFile(file);
    onProgress?.(start + 0.5 / files.length, `Encoding ${file.name}`);
    outputs.push({
      filename: outputFilename(file.name, format),
      blob: await encodeOne(audio, format, o, (fraction, message) =>
        onProgress?.(start + (0.5 + fraction * 0.5) / files.length, message),
      ),
    });
  }

  onProgress?.(1, 'Done');
  return {
    outputs,
    stats: { files: outputs.length, format, mime: outputMime(format) },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;