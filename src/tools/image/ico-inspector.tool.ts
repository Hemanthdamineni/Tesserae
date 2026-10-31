import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ico-inspector.meta';

const MAX_BYTES = 64 * 1024 * 1024;

interface Entry {
  index: number;
  offset: number;
  width: number;
  height: number;
  colors: number;
  planes: number;
  bpp: number;
  size: number;
  dataOffset: number;
  format: string;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  size: number;
  reserved: number;
  type: number;
  count: number;
  entries: Entry[];
  findings: Finding[];
}

function ascii(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = b[off + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  let reserved = 0;
  let type = 0;
  let count = 0;
  const entries: Entry[] = [];
  if (size >= 6) {
    reserved = (data[1] ?? 0) * 256 + (data[0] ?? 0);
    type = (data[3] ?? 0) * 256 + (data[2] ?? 0);
    count = (data[5] ?? 0) * 256 + (data[4] ?? 0);
  } else {
    findings.push({
      severity: 'error',
      kind: 'header',
      detail: 'The file is too short to contain an ICO header.',
    });
  }
  if (reserved !== 0) {
    findings.push({
      severity: 'warn',
      kind: 'reserved',
      detail: 'The reserved header field is ' + reserved + ' instead of 0.',
    });
  }
  if (type !== 1) {
    findings.push({
      severity: 'error',
      kind: 'type',
      detail: 'The type field is ' + type + ' instead of 1 (icon).',
    });
  }
  if (type !== 1 || size < 6) {
    return { size, reserved, type, count, entries, findings };
  }
  const dirSize = 6 + count * 16;
  if (dirSize > size) {
    findings.push({
      severity: 'error',
      kind: 'directory',
      detail:
        'The directory of ' +
        count +
        ' entries needs ' +
        dirSize +
        ' bytes but the file is only ' +
        size +
        ' bytes.',
    });
    return { size, reserved, type, count, entries, findings };
  }
  for (let i = 0; i < count; i += 1) {
    const e = 6 + i * 16;
    const w = data[e] ?? 0;
    const h = data[e + 1] ?? 0;
    const colors = data[e + 2] ?? 0;
    const planes = ((data[e + 5] ?? 0) * 256 + (data[e + 4] ?? 0)) >>> 0;
    const bpp = ((data[e + 7] ?? 0) * 256 + (data[e + 6] ?? 0)) >>> 0;
    const imsize =
      ((data[e + 11] ?? 0) * 16777216 +
        (data[e + 10] ?? 0) * 65536 +
        (data[e + 9] ?? 0) * 256 +
        (data[e + 8] ?? 0)) >>>
      0;
    const doff =
      ((data[e + 15] ?? 0) * 16777216 +
        (data[e + 14] ?? 0) * 65536 +
        (data[e + 13] ?? 0) * 256 +
        (data[e + 12] ?? 0)) >>>
      0;
    let format = 'unknown';
    if (doff + imsize <= size) {
      const pngSig =
        (data[doff] ?? 0) === 0x89 &&
        (data[doff + 1] ?? 0) === 0x50 &&
        (data[doff + 2] ?? 0) === 0x4e &&
        (data[doff + 3] ?? 0) === 0x47;
      if (pngSig) format = 'PNG';
      else if (ascii(data, doff, 2) === 'BM') format = 'BMP/DIB';
    } else {
      findings.push({
        severity: 'error',
        kind: 'data',
        detail:
          'Icon ' +
          i +
          ' at offset ' +
          doff +
          ' declares ' +
          imsize +
          ' bytes but overruns the file.',
      });
    }
    if (doff > size) {
      findings.push({
        severity: 'error',
        kind: 'offset',
        detail: 'Icon ' + i + ' data offset ' + doff + ' lies past the end of the file.',
      });
    }
    entries.push({
      index: i,
      offset: e,
      width: w,
      height: h,
      colors,
      planes,
      bpp,
      size: imsize,
      dataOffset: doff,
      format,
    });
  }
  if (findings.length === 0) {
    findings.push({ severity: 'info', kind: 'ok', detail: 'The ICO structure looks well-formed.' });
  }
  return { size, reserved, type, count, entries, findings };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose a Windows icon (.ico) to inspect.',
        'Drop a .ico file onto the tool.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That icon file is too large.', 'Use a file under 64 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'entries');
    let headers: string[];
    let rows: string[][];
    if (view === 'summary') {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Reserved', String(m.reserved)],
        ['Type', m.type === 1 ? '1 (icon)' : String(m.type)],
        ['Images', String(m.count)],
        ['Entries parsed', String(m.entries.length)],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = [
        '#',
        'Offset',
        'Width',
        'Height',
        'Colors',
        'Planes',
        'BPP',
        'Size',
        'Data off',
        'Format',
      ];
      rows = m.entries.map((x) => [
        String(x.index),
        String(x.offset),
        String(x.width),
        String(x.height),
        String(x.colors),
        String(x.planes),
        String(x.bpp),
        String(x.size),
        String(x.dataOffset),
        x.format,
      ]);
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(m.count + ' icon image(s) in the directory.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
