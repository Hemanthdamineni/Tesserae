import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './webp-inspector.meta';

const MAX_BYTES = 128 * 1024 * 1024;

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

interface Model {
  size: number;
  riffOk: boolean;
  form: string;
  chunks: Chunk[];
  findings: Finding[];
  canvas: string;
  animLoop: number;
  animBg: number;
}

function ascii(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = b[off + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function u24le(b: Uint8Array, off: number): number {
  return ((b[off] ?? 0) + (b[off + 1] ?? 0) * 256 + (b[off + 2] ?? 0) * 65536) >>> 0;
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
  const riffOk = size >= 12 && ascii(data, 0, 4) === 'RIFF' && ascii(data, 8, 4) === 'WEBP';
  if (!riffOk) {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file is not a RIFF/WEBP container (missing RIFF header or WEBP form).',
    });
  }
  const form = size >= 12 ? ascii(data, 8, 4) : '';
  const chunks: Chunk[] = [];
  let i = 12;
  let vp8xW = 0;
  let vp8xH = 0;
  const flags: string[] = [];
  let animLoop = -1;
  let animBg = -1;
  let frameCount = 0;
  if (riffOk) {
    while (i + 8 <= size) {
      const id = ascii(data, i, 4);
      const csz = u32le(data, i + 4);
      const p = i + 8;
      const end = p + csz;
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
      const bound = Math.min(end, size);
      if (id === 'VP8X' && bound >= p + 10) {
        const b = data[p] ?? 0;
        if (b & 0x02) flags.push('alpha');
        if (b & 0x10) flags.push('animation');
        if (b & 0x20) flags.push('icc');
        if (b & 0x40) flags.push('exif');
        if (b & 0x80) flags.push('xmp');
        vp8xW = 1 + u24le(data, p + 4);
        vp8xH = 1 + u24le(data, p + 7);
        detail =
          'flags=[' + (flags.length ? flags.join(',') : 'none') + '] ' + vp8xW + 'x' + vp8xH + '';
      } else if (id === 'ANIM' && bound >= p + 6) {
        animBg = u32le(data, p);
        animLoop = u16le(data, p + 4);
        detail = 'bg=' + animBg + ' loop=' + animLoop;
      } else if (id === 'ANMF' && bound >= p) {
        frameCount += 1;
        detail = 'frame';
      } else if (id === 'VP8 ' || id === 'VP8L') {
        frameCount += 1;
        detail = id === 'VP8L' ? 'lossless frame' : 'lossy frame';
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
  if (frameCount === 0) {
    findings.push({
      severity: 'warn',
      kind: 'noframes',
      detail: 'No VP8, VP8L, or ANMF frame chunk was found.',
    });
  }
  const canvas = vp8xW > 0 ? vp8xW + ' x ' + vp8xH : 'unknown';
  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      kind: 'ok',
      detail: 'The WebP container structure looks well-formed.',
    });
  }
  return { size, riffOk, form, chunks, findings, canvas, animLoop, animBg };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError('Choose a WebP image to inspect.', 'Drop a .webp file onto the tool.');
    if (file.size > MAX_BYTES)
      throw new ToolError('That WebP image is too large.', 'Use a file under 128 MB.');
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
        ['Canvas', m.canvas],
        ['Chunks', String(m.chunks.length)],
        ['Animation frames', String(m.chunks.filter((c) => c.id === 'ANMF').length)],
        ['Animation loop', m.animLoop === -1 ? 'none' : String(m.animLoop)],
        ['Frame chunks', String(m.chunks.filter((c) => c.id === 'VP8 ' || c.id === 'VP8L').length)],
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
