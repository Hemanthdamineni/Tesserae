import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './avi-inspector.meta';

/**
 * AVI (RIFF) inspector.
 *
 * An AVI file is a RIFF container: a 'RIFF' header, the 'AVI ' form type, and
 * a tree of LISTs and chunks. Expected values in the tests come from the
 * `file`(1) reference tool and a byte-level chunk walk, never from this
 * parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_CHUNKS = 200000;

const STREAM_TYPES: Record<string, string> = {
  vids: 'Video',
  auds: 'Audio',
  mids: 'MIDI',
  txts: 'Text',
};

const AUDIO_FORMATS: Record<number, string> = {
  1: 'PCM',
  3: 'IEEE float',
  6: 'A-law',
  7: 'mu-law',
  0x50: 'MPEG-1',
  0x55: 'MP3',
  0x2000: 'AC-3',
};

function fourcc(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o] ?? 0, b[o + 1] ?? 0, b[o + 2] ?? 0, b[o + 3] ?? 0);
}

function u16le(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) + ((b[o + 1] ?? 0) << 8)) >>> 0;
}

function u32le(b: Uint8Array, o: number): number {
  return (u16le(b, o) + u16le(b, o + 2) * 65536) >>> 0;
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'chunks');

    const file = input.files[0];
    if (!file) throw new ToolError('Choose an AVI video file to inspect.', 'Pick a .avi file.');
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 12) throw new ToolError('File is too short to be an AVI file.');

    const riffMagic = fourcc(buf, 0);
    const form = fourcc(buf, 8);
    if (riffMagic !== 'RIFF' || form !== 'AVI ') {
      throw new ToolError(
        'Not an AVI file (missing RIFF/AVI header).',
        'An AVI file must start with "RIFF" and a form type of "AVI ".',
      );
    }

    interface Chunk {
      offset: number;
      fourcc: string;
      size: number;
      depth: number;
      kind: string;
    }
    const chunks: Chunk[] = [];
    const warnings: string[] = [];

    // ---- main header fields ----
    let width = 0;
    let height = 0;
    let fps = 0;
    let totalFrames = 0;
    let streamCount = 0;
    let microsec = 0;

    // ---- stream details ----
    interface Stream {
      index: number;
      type: string;
      handler: string;
      rate: number;
      detail: string;
    }
    const streams: Stream[] = [];

    // walk helper: (fourcc,size) headers, LISTs recurse into their children
    let guard = 0;
    function walk(o: number, end: number, depth: number): void {
      while (o + 8 <= end && chunks.length < MAX_CHUNKS && guard++ < 300000) {
        const cc = fourcc(buf, o);
        const sz = u32le(buf, o + 4);
        if (o + 8 + sz > buf.length) {
          warnings.push('Chunk "' + cc + '" at offset ' + o + ' overruns the end of the file.');
          break;
        }
        const isList = cc === 'LIST' || cc === 'RIFF';
        chunks.push({ offset: o, fourcc: cc, size: sz, depth, kind: isList ? 'list' : 'chunk' });
        if (isList) {
          const listType = fourcc(buf, o + 8);
          chunks.push({
            offset: o + 8,
            fourcc: listType,
            size: sz,
            depth: depth + 1,
            kind: 'listtype',
          });
          walk(o + 12, o + 8 + sz, depth + 1);
        } else {
          decodeChunk(cc, o + 8, sz);
        }
        o += 8 + sz + (sz % 2); // pad to even
      }
    }

    function decodeChunk(cc: string, dataOff: number, sz: number): void {
      if (cc === 'avih' && sz >= 40) {
        microsec = u32le(buf, dataOff);
        totalFrames = u32le(buf, dataOff + 16);
        streamCount = u32le(buf, dataOff + 24);
        width = u32le(buf, dataOff + 32);
        height = u32le(buf, dataOff + 36);
        if (microsec > 0) fps = 1000000 / microsec;
      } else if (cc === 'strh' && sz >= 40) {
        const type = fourcc(buf, dataOff);
        const handler = fourcc(buf, dataOff + 4);
        const scale = u32le(buf, dataOff + 20);
        const rate = u32le(buf, dataOff + 24);
        const s: Stream = {
          index: streams.length,
          type,
          handler,
          rate: scale > 0 ? rate / scale : 0,
          detail: '',
        };
        streams.push(s);
      } else if (cc === 'strf') {
        const s = streams[streams.length - 1];
        if (s) {
          if (s.type === 'vids' && sz >= 40) {
            const bitCount = u16le(buf, dataOff + 14);
            const comp = fourcc(buf, dataOff + 16);
            s.detail =
              'video, ' +
              bitCount +
              '-bit, compression ' +
              (comp === '\0\0\0\0' ? 'uncompressed' : comp);
          } else if (s.type === 'auds' && sz >= 16) {
            const fmt = u16le(buf, dataOff);
            const channels = u16le(buf, dataOff + 2);
            const sampleRate = u32le(buf, dataOff + 4);
            s.detail =
              'audio, ' +
              channels +
              ' ch, ' +
              sampleRate +
              ' Hz, ' +
              (AUDIO_FORMATS[fmt] ?? 'format ' + fmt);
          }
        }
      }
    }

    // start walking from offset 0 so the top-level RIFF chunk is included
    walk(0, buf.length, 0);

    if (chunks.length === 0) {
      throw new ToolError('No chunks could be parsed from the AVI file.');
    }

    // ---- views ----
    if (view === 'streams') {
      const rows = streams.map((s) => [
        String(s.index),
        STREAM_TYPES[s.type] ?? s.type,
        s.handler || '-',
        s.rate ? s.rate.toFixed(2) + ' fps' : '-',
        s.detail || '-',
      ]);
      return renderTable(
        ['#', 'type', 'codec/handler', 'rate', 'detail'],
        rows,
        'AVI streams',
        undefined,
        warnings,
      );
    }

    if (view === 'chunks') {
      const rows = chunks.map((c) => [
        String(c.offset),
        c.kind === 'list' ? (c.fourcc === 'RIFF' ? 'RIFF' : 'LIST') : c.fourcc,
        c.kind === 'listtype' ? '(list type)' : String(c.size),
        c.kind,
      ]);
      return renderTable(
        ['offset', 'fourcc', 'size', 'kind'],
        rows,
        'AVI chunk tree',
        undefined,
        warnings,
      );
    }

    // summary view
    const codec = streams.find((s) => s.type === 'vids')?.handler ?? '-';
    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['Container', 'RIFF / AVI'],
      ['Dimensions', (width ? String(width) : '?') + ' x ' + (height ? String(height) : '?')],
      ['Frame rate', fps ? fps.toFixed(2) + ' fps' : '-'],
      ['Total frames', String(totalFrames)],
      ['Streams', String(streamCount || streams.length)],
      ['Video codec', codec],
    ];
    for (let i = 0; i < streams.length; i += 1) {
      const s = streams[i] ?? { index: i, type: '', handler: '', rate: 0, detail: '' };
      summary.push([
        'Stream ' + i,
        ((STREAM_TYPES[s.type] ?? s.type) || '?') +
          (s.handler ? ' / ' + s.handler : '') +
          (s.detail ? ' / ' + s.detail : ''),
      ]);
    }

    const notes: string[] = [];
    if (fps > 0)
      notes.push(
        'Frame rate derived from the avih microseconds-per-frame value (' +
          Math.round(microsec) +
          ' us).',
      );

    return renderTable(['field', 'value'], summary, 'AVI summary', notes, warnings);
  },
};

function renderTable(
  headers: string[],
  rows: string[][],
  title: string,
  notes: string[] | undefined,
  warnings: string[],
): FileRunResult {
  const output = JSON.stringify({ title, headers, rows });
  return {
    outputs: [] as OutputFile[],
    report: { output, render: 'table' },
    notes: notes && notes.length > 0 ? notes : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { rows: rows.length },
  };
}

export default tool;
