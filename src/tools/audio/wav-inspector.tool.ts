import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './wav-inspector.meta';

const MAX_BYTES = 128 * 1024 * 1024;

const FMT_NAMES: Record<number, string> = {
  1: 'PCM',
  3: 'IEEE float',
  6: 'A-law',
  7: 'mu-law',
  0xfffe: 'extensible',
};

interface Chunk {
  offset: number;
  id: string;
  size: number;
  detail: string;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Fmt {
  codec: string;
  channels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
}

interface Model {
  size: number;
  riffOk: boolean;
  form: string;
  chunks: Chunk[];
  findings: Finding[];
  fmt: Fmt | null;
  dataSize: number;
  duration: number;
}

function ascii(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = b[off + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function u16le(b: Uint8Array, off: number): number {
  return ((b[off] ?? 0) + (b[off + 1] ?? 0) * 256) >>> 0;
}

function u32le(b: Uint8Array, off: number): number {
  return (
    ((b[off] ?? 0) +
      (b[off + 1] ?? 0) * 256 +
      (b[off + 2] ?? 0) * 65536 +
      (b[off + 3] ?? 0) * 16777216) >>>
    0
  );
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  const riffOk = size >= 12 && ascii(data, 0, 4) === 'RIFF' && ascii(data, 8, 4) === 'WAVE';
  if (!riffOk) {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file is not a RIFF/WAVE container (missing RIFF header or WAVE form).',
    });
  }
  const form = size >= 12 ? ascii(data, 8, 4) : '';
  const chunks: Chunk[] = [];
  let fmt: Fmt | null = null;
  let dataSize = 0;
  let i = 12;
  if (riffOk) {
    while (i + 8 <= size) {
      const id = ascii(data, i, 4);
      const csz = u32le(data, i + 4);
      const p = i + 8;
      const end = p + csz;
      const bound = Math.min(end, size);
      let overrun = false;
      if (end > size) {
        overrun = true;
        findings.push({
          severity: 'error',
          kind: 'overrun',
          detail:
            'Chunk ' +
            id +
            ' at offset ' +
            i +
            ' declares ' +
            csz +
            ' bytes but overruns the file (' +
            end +
            ' > ' +
            size +
            ').',
        });
      }
      let detail = '';
      if (id === 'fmt ' && bound >= p + 16) {
        const codecId = u16le(data, p);
        const channels = u16le(data, p + 2);
        const sampleRate = u32le(data, p + 4);
        const byteRate = u32le(data, p + 8);
        const blockAlign = u16le(data, p + 12);
        const bits = u16le(data, p + 14);
        const codec = FMT_NAMES[codecId] ?? 'unknown(' + codecId + ')';
        fmt = { codec, channels, sampleRate, byteRate, blockAlign, bitsPerSample: bits };
        detail = codec + ' ' + channels + 'ch ' + sampleRate + 'Hz ' + bits + 'bit';
        if (byteRate === 0 && sampleRate > 0 && blockAlign > 0) {
          findings.push({
            severity: 'warn',
            kind: 'byterate',
            detail: 'The byte rate is zero; the expected value is sampleRate x blockAlign.',
          });
        }
      } else if (id === 'data') {
        dataSize = csz;
        detail = 'pcm data';
      }
      chunks.push({ offset: i, id, size: csz, detail });
      const advance = 8 + csz;
      if (overrun) break;
      i += advance;
      if ((csz & 1) === 1 && i + 1 <= size) {
        if (data[i] === 0) {
          i += 1;
        } else {
          findings.push({
            severity: 'warn',
            kind: 'pad',
            detail: 'Chunk ' + id + ' is odd-sized and the pad byte at ' + i + ' is not zero.',
          });
          i += 1;
        }
      }
    }
    if (i < size) {
      findings.push({
        severity: 'warn',
        kind: 'trailing',
        detail: size - i + ' trailing byte(s) follow the last chunk.',
      });
    }
  }
  let duration = 0;
  if (fmt && fmt.byteRate > 0) {
    duration = dataSize / fmt.byteRate;
  }
  if (fmt && dataSize > 0 && fmt.byteRate === 0) {
    findings.push({
      severity: 'warn',
      kind: 'duration',
      detail: 'Cannot compute duration because the byte rate is zero.',
    });
  }
  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      kind: 'ok',
      detail: 'The WAV container structure looks well-formed.',
    });
  }
  return { size, riffOk, form, chunks, findings, fmt, dataSize, duration };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError('Choose a WAV audio file to inspect.', 'Drop a .wav file onto the tool.');
    if (file.size > MAX_BYTES)
      throw new ToolError('That WAV audio file is too large.', 'Use a file under 128 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'chunks');
    let headers: string[];
    let rows: string[][];
    if (view === 'summary') {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['RIFF header', m.riffOk ? 'valid' : 'INVALID'],
        ['Form type', m.form],
        ['Format', m.fmt ? m.fmt.codec : 'unknown'],
        ['Channels', m.fmt ? String(m.fmt.channels) : '-'],
        ['Sample rate', m.fmt ? String(m.fmt.sampleRate) + ' Hz' : '-'],
        ['Bits per sample', m.fmt ? String(m.fmt.bitsPerSample) : '-'],
        ['Byte rate', m.fmt ? String(m.fmt.byteRate) + ' B/s' : '-'],
        ['Chunks', String(m.chunks.length)],
        ['Duration', m.duration > 0 ? m.duration.toFixed(3) + ' s' : '-'],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Offset', 'Chunk', 'Size', 'Detail'];
      rows = m.chunks.map((c) => [String(c.offset), c.id, String(c.size), c.detail]);
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(m.chunks.length + ' chunk(s) parsed.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
