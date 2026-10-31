import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './icns-inspector.meta';

const MAX_BYTES = 256 * 1024 * 1024;

function chunkDesc(typ: string): string {
  const png: Record<string, string> = {
    icp4: 'PNG 16x16',
    icp5: 'PNG 32x32',
    ic07: 'PNG 128x128',
    ic08: 'PNG 256x256',
    ic09: 'PNG 512x512',
    ic10: 'PNG 32x32 (Retina)',
    ic11: 'PNG 64x64',
    ic12: 'PNG 256x256 (Retina)',
    ic13: 'PNG 512x512 (Retina)',
    icp6: 'PNG 1024x1024',
  };
  const jp2: Record<string, string> = {
    ics4: 'JPEG 2000 16x16',
    ics5: 'JPEG 2000 32x32',
    ic04: 'JPEG 2000 16x16',
    ic05: 'JPEG 2000 32x32',
    ic06: 'JPEG 2000 64x64',
    ic07: 'JPEG 2000 128x128',
    ic08: 'JPEG 2000 256x256',
    ic09: 'JPEG 2000 512x512',
    ic10: 'JPEG 2000 1024x1024',
    ic11: 'JPEG 2000 32x32 (Retina)',
    ic12: 'JPEG 2000 64x64',
    ic13: 'JPEG 2000 512x512 (Retina)',
    ic14: 'JPEG 2000 256x256 (Retina)',
    icp5: 'JPEG 2000 512x512',
    icp6: 'JPEG 2000 1024x1024',
  };
  if (png[typ] !== undefined) return png[typ] ?? '';
  if (jp2[typ] !== undefined) return jp2[typ] ?? '';
  return 'unknown';
}

interface Chunk {
  index: number;
  offset: number;
  type: string;
  len: number;
  dataLen: number;
  desc: string;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  size: number;
  magicOk: boolean;
  total: number;
  chunks: Chunk[];
  findings: Finding[];
}

function ascii4(b: Uint8Array, off: number): string {
  let s = '';
  for (let i = 0; i < 4; i += 1) {
    const c = b[off + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  let magicOk = false;
  let total = 0;
  const chunks: Chunk[] = [];
  if (size >= 8 && ascii4(data, 0) === 'icns') {
    magicOk = true;
    total =
      ((data[4] ?? 0) * 16777216 +
        (data[5] ?? 0) * 65536 +
        (data[6] ?? 0) * 256 +
        (data[7] ?? 0)) >>>
      0;
    if (total !== size) {
      findings.push({
        severity: 'warn',
        kind: 'size',
        detail:
          'The declared total length ' + total + ' disagrees with the real file size ' + size + '.',
      });
    }
    let p = 8;
    let idx = 0;
    while (p + 8 <= size) {
      const typ = ascii4(data, p);
      const clen =
        ((data[p + 4] ?? 0) * 16777216 +
          (data[p + 5] ?? 0) * 65536 +
          (data[p + 6] ?? 0) * 256 +
          (data[p + 7] ?? 0)) >>>
        0;
      if (clen < 8) {
        findings.push({
          severity: 'error',
          kind: 'chunk',
          detail: 'Chunk ' + idx + ' at offset ' + p + ' declares an invalid length ' + clen + '.',
        });
        break;
      }
      if (p + clen > size) {
        findings.push({
          severity: 'error',
          kind: 'chunk',
          detail:
            'Chunk ' +
            idx +
            ' at offset ' +
            p +
            ' declares ' +
            clen +
            ' bytes but overruns the file.',
        });
        break;
      }
      chunks.push({
        index: idx,
        offset: p,
        type: typ,
        len: clen,
        dataLen: clen - 8,
        desc: chunkDesc(typ),
      });
      p += clen;
      idx += 1;
    }
    if (p + 8 > size && p < size) {
      findings.push({
        severity: 'warn',
        kind: 'truncated',
        detail: 'A trailing partial chunk header was found at offset ' + p + '.',
      });
    }
  } else {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file does not begin with an ICNS magic (icns).',
    });
  }
  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      kind: 'ok',
      detail: 'The ICNS structure looks well-formed.',
    });
  }
  return { size, magicOk, total, chunks, findings };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose an ICNS icon set to inspect.',
        'Drop a .icns file onto the tool.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That ICNS icon set is too large.', 'Use a file under 256 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'chunks');
    let headers: string[];
    let rows: string[][];
    if (view === 'summary') {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Magic', m.magicOk ? 'icns (valid)' : 'INVALID'],
        ['Declared length', String(m.total) + ' B'],
        ['Icon resources', String(m.chunks.length)],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['#', 'Offset', 'Type', 'Meaning', 'Chunk len', 'Data len'];
      rows = m.chunks.map((c) => [
        String(c.index),
        String(c.offset),
        c.type,
        c.desc,
        String(c.len),
        String(c.dataLen),
      ]);
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(m.chunks.length + ' icon resource(s) found.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
