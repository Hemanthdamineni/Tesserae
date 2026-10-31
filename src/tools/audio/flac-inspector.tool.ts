import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './flac-inspector.meta';

const MAX_BYTES = 128 * 1024 * 1024;

const BLOCK_NAMES: Record<number, string> = {
  0: 'STREAMINFO',
  1: 'PADDING',
  2: 'APPLICATION',
  3: 'SEEKTABLE',
  4: 'VORBIS_COMMENT',
  5: 'CUESHEET',
  6: 'PICTURE',
};

interface Block {
  offset: number;
  type: number;
  name: string;
  size: number;
  last: boolean;
  detail: string;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface StreamInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  totalSamples: number;
  md5: string;
}

interface Model {
  size: number;
  magicOk: boolean;
  blocks: Block[];
  findings: Finding[];
  stream: StreamInfo | null;
  duration: number;
  streamOffset: number;
}

function ascii(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = b[off + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function be24(b: Uint8Array, off: number): number {
  return ((b[off] ?? 0) * 65536 + (b[off + 1] ?? 0) * 256 + (b[off + 2] ?? 0)) >>> 0;
}

function hex16(b: Uint8Array, off: number): string {
  let s = '';
  for (let i = 0; i < 16; i += 1) {
    const v = b[off + i] ?? 0;
    s += v.toString(16).padStart(2, '0');
  }
  return s;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  const magicOk = size >= 4 && ascii(data, 0, 4) === 'fLaC';
  if (!magicOk) {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file does not begin with the fLaC magic.',
    });
  }
  const blocks: Block[] = [];
  let stream: StreamInfo | null = null;
  let i = 4;
  let seenStream = false;
  if (magicOk) {
    while (i + 4 <= size) {
      const hdr = data[i] ?? 0;
      const last = (hdr & 0x80) !== 0;
      const type = hdr & 0x7f;
      const blen = be24(data, i + 1);
      const p = i + 4;
      const end = p + blen;
      const bound = Math.min(end, size);
      let overrun = false;
      if (end > size) {
        overrun = true;
        findings.push({
          severity: 'error',
          kind: 'overrun',
          detail:
            'Block ' +
            (BLOCK_NAMES[type] ?? 'type-' + type) +
            ' at offset ' +
            i +
            ' declares ' +
            blen +
            ' bytes but overruns the file (' +
            end +
            ' > ' +
            size +
            ').',
        });
      }
      if (type !== 0 && !seenStream) {
        findings.push({
          severity: 'warn',
          kind: 'order',
          detail:
            'A ' +
            (BLOCK_NAMES[type] ?? 'type-' + type) +
            ' block appears before the STREAMINFO block.',
        });
      }
      let detail = '';
      if (type === 0 && bound >= p + 34) {
        const sampleRate = be24(data, p + 10) >> 4;
        const channels = (((data[p + 12] ?? 0) >> 1) & 7) + 1;
        const bits = ((((data[p + 12] ?? 0) & 1) << 4) | ((data[p + 13] ?? 0) >> 4)) + 1;
        const hi = (data[p + 13] ?? 0) & 0x0f;
        const lo =
          ((data[p + 14] ?? 0) * 16777216 +
            (data[p + 15] ?? 0) * 65536 +
            (data[p + 16] ?? 0) * 256 +
            (data[p + 17] ?? 0)) >>>
          0;
        const total = hi * 4294967296 + lo;
        const md5 = hex16(data, p + 18);
        stream = { sampleRate, channels, bitsPerSample: bits, totalSamples: total, md5 };
        detail = sampleRate + 'Hz ' + channels + 'ch ' + bits + 'bit ' + total + ' samples';
        seenStream = true;
      } else if (type === 4 && bound >= p + 8) {
        const vlen =
          ((data[p] ?? 0) +
            (data[p + 1] ?? 0) * 256 +
            (data[p + 2] ?? 0) * 65536 +
            (data[p + 3] ?? 0) * 16777216) >>>
          0;
        const vstart = p + 4;
        const vendor = ascii(data, vstart, Math.min(vlen, bound - vstart));
        const cpos = p + 4 + vlen;
        const comments =
          cpos + 4 <= bound
            ? ((data[cpos] ?? 0) +
                (data[cpos + 1] ?? 0) * 256 +
                (data[cpos + 2] ?? 0) * 65536 +
                (data[cpos + 3] ?? 0) * 16777216) >>>
              0
            : 0;
        detail = 'vendor "' + vendor + '" ' + comments + ' comment(s)';
      } else if (type === 3) {
        detail = blen / 18 + ' seek point(s)';
      }
      blocks.push({
        offset: i,
        type,
        name: BLOCK_NAMES[type] ?? 'type-' + type,
        size: blen,
        last,
        detail,
      });
      i = end;
      if (overrun) break;
      if (last) break;
    }
    if (!seenStream) {
      findings.push({
        severity: 'error',
        kind: 'streaminfo',
        detail: 'No STREAMINFO block was found.',
      });
    }
    if (i + 4 > size && i <= size && size > 4) {
      findings.push({
        severity: 'warn',
        kind: 'truncated',
        detail: 'A metadata block header overruns the end of the file.',
      });
    }
  }
  let duration = 0;
  if (stream && stream.sampleRate > 0) {
    duration = stream.totalSamples / stream.sampleRate;
  }
  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      kind: 'ok',
      detail: 'The FLAC metadata structure looks well-formed.',
    });
  }
  return { size, magicOk, blocks, findings, stream, duration, streamOffset: i };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose a FLAC audio file to inspect.',
        'Drop a .flac file onto the tool.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That FLAC audio file is too large.', 'Use a file under 128 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'blocks');
    let headers: string[];
    let rows: string[][];
    if (view === 'summary') {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Magic', m.magicOk ? 'valid (fLaC)' : 'INVALID'],
        ['Metadata blocks', String(m.blocks.length)],
        ['Sample rate', m.stream ? String(m.stream.sampleRate) + ' Hz' : '-'],
        ['Channels', m.stream ? String(m.stream.channels) : '-'],
        ['Bits per sample', m.stream ? String(m.stream.bitsPerSample) : '-'],
        ['Total samples', m.stream ? String(m.stream.totalSamples) : '-'],
        ['Duration', m.duration > 0 ? m.duration.toFixed(3) + ' s' : '-'],
        ['Stream offset', String(m.streamOffset)],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Offset', 'Type', 'Block', 'Size', 'Last', 'Detail'];
      rows = m.blocks.map((b) => [
        String(b.offset),
        String(b.type),
        b.name,
        String(b.size),
        b.last ? 'yes' : 'no',
        b.detail,
      ]);
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(m.blocks.length + ' metadata block(s) parsed.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
