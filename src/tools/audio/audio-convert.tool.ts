import type { FileRunInput, FileRunResult, FileToolModule, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { decodeFile, remixChannels, resampleChannel } from './lib';
import {
  encodeWav,
  FORMAT_MIME,
  Mp3ByteCounter,
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

/** Convert float32 samples (-1..1) to asymmetric-scaled Int16, like the WAV writer. */
function toInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = input[i]!;
    const clamped = s < -1 ? -1 : s > 1 ? 1 : s;
    out[i] = Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
  }
  return out;
}

/** Apply the chosen sample rate and channel layout to decoded audio. */
function prepare(
  audio: { channels: Float32Array[]; sampleRate: number },
  o: Record<string, unknown>,
): { channels: Float32Array[]; sampleRate: number } {
  let channels = audio.channels;
  const targetChannels = resolveChannelMode(o.channels);
  if (targetChannels === 1) channels = remixChannels(channels, 1);
  else if (targetChannels === 2) channels = remixChannels(channels, 2);
  const targetRate = resolveSampleRate(o.sampleRate, audio.sampleRate);
  channels = channels.map((ch) => resampleChannel(ch, audio.sampleRate, targetRate));
  return { channels, sampleRate: targetRate };
}

/** Encode WAV — header + samples come from the shared writer (see `encodeWav`). */
function toWav(channels: Float32Array[], sampleRate: number): Blob {
  const bytes = encodeWav(channels, sampleRate);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: FORMAT_MIME.wav });
}

let lamePromise: Promise<typeof import('@breezystack/lamejs')> | undefined;

/** Lazy-load the LGPL MP3 encoder chunk — only on the first MP3 conversion. */
function loadLame(): Promise<typeof import('@breezystack/lamejs')> {
  lamePromise ??= import('@breezystack/lamejs');
  return lamePromise;
}

/** Encode to MP3 with lamejs, tracking frames/bytes as chunks arrive. */
async function toMp3(
  channels: Float32Array[],
  sampleRate: number,
  bitrate: number,
  onProgress: ((fraction: number, message?: string) => void) | undefined,
): Promise<{ blob: Blob; frames: number; bytes: number }> {
  onProgress?.(0, 'Loading the MP3 encoder…');
  let mod;
  try {
    mod = await loadLame();
  } catch {
    throw new ToolError(
      'The MP3 encoder could not be loaded.',
      'This build of the app may be missing its MP3 chunk.',
    );
  }
  const encoder = new mod.Mp3Encoder(channels.length, sampleRate, bitrate);
  const left = toInt16(channels[0]!);
  const right = channels.length > 1 ? toInt16(channels[1]!) : undefined;
  const count = new Mp3ByteCounter(left.length);
  const parts: Uint8Array[] = [];

  const push = (chunk: Uint8Array) => {
    if (chunk.length > 0) parts.push(chunk);
    count.add(chunk);
  };

  push(encoder.encodeBuffer(left, right ?? new Int16Array(0)));
  push(encoder.flush());

  const blob = new Blob(parts as Uint8Array<ArrayBuffer>[], { type: FORMAT_MIME.mp3 });
  return { blob, frames: count.count, bytes: count.size };
}

/* ------------------------------------------------------------------ */
/*  Opus / OGG — WebCodecs AudioEncoder + a minimal Ogg muxer          */
/* ------------------------------------------------------------------ */

/** CRC-32 (IEEE 802.3, reflected, polynomial 0xEDB88320) — Ogg page checksum. */
function crc32(bytes: Uint8Array): number {
  let c = 0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i]!;
    for (let b = 0; b < 8; b++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return c >>> 0;
}

/** The LEB128-style lacing values Ogg uses to size each packet in a page. */
function lacingFor(packet: Uint8Array): number[] {
  const lacing: number[] = [];
  const n = packet.length;
  let remaining = n;
  while (remaining >= 255) {
    lacing.push(255);
    remaining -= 255;
  }
  if (remaining > 0) lacing.push(remaining);
  // A packet that is an exact multiple of 255 bytes needs a trailing 0 to mark
  // the end of its segment lacing.
  if (n > 0 && n % 255 === 0) lacing.push(0);
  return lacing;
}

/** Assemble one Ogg page. `granule` is the absolute granule position. */
function oggPage(
  serial: number,
  sequence: number,
  headerType: number,
  granule: number,
  packets: Uint8Array[],
): Uint8Array {
  const lacing: number[] = [];
  let bodyLen = 0;
  for (const packet of packets) {
    lacing.push(...lacingFor(packet));
    bodyLen += packet.length;
  }
  const page = new Uint8Array(27 + lacing.length + bodyLen);
  const view = new DataView(page.buffer);
  let o = 0;
  const ascii = (s: string) => {
    for (let i = 0; i < s.length; i++) page[o++] = s.charCodeAt(i);
  };
  ascii('OggS');
  page[o++] = 0; // stream structure version
  page[o++] = headerType; // 2 = continued, 1 = first page, 0 = normal, 4 = last
  view.setBigUint64(o, BigInt(granule), true);
  o += 8;
  view.setUint32(o, serial, true);
  o += 4;
  view.setUint32(o, sequence, true);
  o += 4;
  view.setUint32(o, 0, true); // checksum placeholder
  o += 4;
  page[o++] = lacing.length;
  for (const lace of lacing) page[o++] = lace;
  for (const packet of packets) {
    page.set(packet, o);
    o += packet.length;
  }
  view.setUint32(22, crc32(page), true); // CRC over the page with checksum zeroed
  return page;
}

/** Pack a UTF-8 string as a little-endian length-prefixed OpusTags entry. */
function opusString(s: string): Uint8Array {
  const bytes = new TextEncoder().encode(s);
  const out = new Uint8Array(4 + bytes.length);
  new DataView(out.buffer).setUint32(0, bytes.length, true);
  out.set(bytes, 4);
  return out;
}

/** Build the `OpusHead` identification header (RFC 7845 §5.1). */
function opusHead(channels: number, sampleRate: number, preSkip: number): Uint8Array {
  const out = new Uint8Array(19);
  const view = new DataView(out.buffer);
  let o = 0;
  const ascii = (s: string) => {
    for (let i = 0; i < s.length; i++) out[o++] = s.charCodeAt(i);
  };
  ascii('OpusHead');
  out[o++] = 1; // version
  out[o++] = channels;
  view.setUint16(o, preSkip, true);
  o += 2;
  view.setUint32(o, sampleRate, true); // input sample rate
  o += 4;
  view.setInt16(o, 0, true); // output gain
  o += 2;
  out[o++] = 0; // channel mapping family 0 (mono/stereo)
  return out;
}

/** Build the `OpusTags` comment header (RFC 7845 §5.2). */
function opusTags(): Uint8Array {
  const vendor = opusString('Tesserae');
  const count = new Uint8Array(4);
  new DataView(count.buffer).setUint32(0, 0, true); // zero user comments
  const parts = [new TextEncoder().encode('OpusTags'), vendor, count];
  return concatBytes(parts);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Serial number for the Ogg stream; any non-zero 32-bit value works. */
const OPUS_SERIAL = 0x4f505553; // "OPUS" as an integer

/**
 * Encode Float32 channels to Opus in an Ogg container using the browser's
 * WebCodecs `AudioEncoder` (Chrome 94+). `opusSupported()` must have returned
 * true before this is called. No test exercises real encoding — the Ogg framing
 * is verified structurally in the core tests instead.
 */
async function toOpus(
  channels: Float32Array[],
  sampleRate: number,
  bitrate: number,
  onProgress: ((fraction: number, message?: string) => void) | undefined,
): Promise<Blob> {
  const numberOfChannels = channels.length;
  const frames = channels[0]!.length;
  const encoderConfig: AudioEncoderConfig = {
    codec: 'opus',
    sampleRate,
    numberOfChannels,
    bitrate: bitrate * 1000,
  };
  const supported = await AudioEncoder.isConfigSupported(encoderConfig);
  if (!supported.supported) {
    throw new ToolError(
      'The Opus encoder is not available in this browser.',
      'Choose WAV or MP3 here instead.',
    );
  }

  const packets: { data: Uint8Array; granule: number }[] = [];
  let position = 0; // granule position of the last encoded sample

  const encoder = new AudioEncoder({
    output: (chunk) => {
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      position += framesPerPacket(chunk.duration ?? 0, sampleRate);
      packets.push({ data: bytes, granule: position });
    },
    error: () => {
      // The real failure surfaces at flush().
    },
  });
  encoder.configure(encoderConfig);

  const data = new AudioData({
    format: 'f32-planar',
    sampleRate,
    numberOfFrames: frames,
    numberOfChannels,
    timestamp: 0,
    data: concatFloat32(channels).buffer as ArrayBuffer,
  });
  encoder.encode(data);
  data.close();
  await encoder.flush();
  encoder.close();

  onProgress?.(0.8, 'Muxing OGG');

  const preSkip = 3840; // 80 ms of pre-skip at 48 kHz (RFC 7845 §5.1 default)
  const pages: Uint8Array[] = [];
  let seq = 0;
  // BOS page carries OpusHead; a normal page carries OpusTags.
  pages.push(oggPage(OPUS_SERIAL, seq++, 2, 0, [opusHead(numberOfChannels, sampleRate, preSkip)]));
  pages.push(oggPage(OPUS_SERIAL, seq++, 0, 0, [opusTags()]));
  // One audio page per packet; the last page is flagged EOS.
  const lastIndex = packets.length - 1;
  for (let i = 0; i < packets.length; i++) {
    const granule = preSkip + packets[i]!.granule;
    pages.push(oggPage(OPUS_SERIAL, seq++, i === lastIndex ? 4 : 0, granule, [packets[i]!.data]));
  }

  onProgress?.(1, 'Done');
  return new Blob(pages as Uint8Array<ArrayBuffer>[], { type: FORMAT_MIME.opus });
}

/** Estimate granule advancement from a chunk's microsecond duration. */
function framesPerPacket(durationMicros: number, _sampleRate: number): number {
  if (durationMicros > 0) return Math.round((durationMicros / 1_000_000) * 48000);
  return 960; // default: 20 ms at 48 kHz
}

/** Pack planar Float32 channels into one buffer for `format: 'f32-planar'`. */
function concatFloat32(channels: Float32Array[]): Float32Array {
  const frames = Math.max(...channels.map((c) => c.length));
  const out = new Float32Array(frames * channels.length);
  for (let c = 0; c < channels.length; c++) {
    const ch = channels[c]!;
    for (let i = 0; i < frames; i++) {
      out[c * frames + i] = ch[i] ?? 0;
    }
  }
  return out;
}

/** Encode one file and return its output Blob plus a short format label. */
async function encodeOne(
  audio: { channels: Float32Array[]; sampleRate: number },
  format: ConvertFormat,
  o: Record<string, unknown>,
  onProgress: ((fraction: number, message?: string) => void) | undefined,
): Promise<Blob> {
  const { channels, sampleRate } = prepare(audio, o);
  if (format === 'wav') {
    onProgress?.(1, 'Writing WAV');
    return toWav(channels, sampleRate);
  }
  if (format === 'mp3') {
    const { blob } = await toMp3(channels, sampleRate, resolveBitrate(o.mp3Bitrate), onProgress);
    return blob;
  }
  return toOpus(channels, sampleRate, resolveBitrate(o.opusBitrate), onProgress);
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
