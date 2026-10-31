import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ogg-inspector.meta';

const MAX_BYTES = 256 * 1024 * 1024;

interface Page {
  index: number;
  offset: number;
  type: number;
  typeFlags: string;
  granule: number;
  serial: number;
  seq: number;
  crc: number;
  nsegs: number;
  segLens: number[];
  bodyLen: number;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  size: number;
  magicOk: boolean;
  version: number;
  pages: Page[];
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
  let version = 0;
  const pages: Page[] = [];
  if (size >= 27 && ascii4(data, 0) === 'OggS') {
    magicOk = true;
    version = data[4] ?? 0;
    if (version !== 0)
      findings.push({
        severity: 'warn',
        kind: 'version',
        detail: 'Unusual Ogg stream version ' + version + '.',
      });
    let p = 0;
    let idx = 0;
    while (p + 27 <= size) {
      if (ascii4(data, p) !== 'OggS') {
        findings.push({
          severity: 'error',
          kind: 'magic',
          detail: 'A page at offset ' + p + ' is missing the OggS capture pattern.',
        });
        break;
      }
      const type = data[p + 5] ?? 0;
      const lo =
        ((data[p + 6] ?? 0) +
          (data[p + 7] ?? 0) * 256 +
          (data[p + 8] ?? 0) * 65536 +
          (data[p + 9] ?? 0) * 16777216) >>>
        0;
      const hi =
        ((data[p + 10] ?? 0) +
          (data[p + 11] ?? 0) * 256 +
          (data[p + 12] ?? 0) * 65536 +
          (data[p + 13] ?? 0) * 16777216) >>>
        0;
      const granule = hi * 4294967296 + lo;
      const serial =
        ((data[p + 14] ?? 0) +
          (data[p + 15] ?? 0) * 256 +
          (data[p + 16] ?? 0) * 65536 +
          (data[p + 17] ?? 0) * 16777216) >>>
        0;
      const seq =
        ((data[p + 18] ?? 0) +
          (data[p + 19] ?? 0) * 256 +
          (data[p + 20] ?? 0) * 65536 +
          (data[p + 21] ?? 0) * 16777216) >>>
        0;
      const crc =
        ((data[p + 22] ?? 0) +
          (data[p + 23] ?? 0) * 256 +
          (data[p + 24] ?? 0) * 65536 +
          (data[p + 25] ?? 0) * 16777216) >>>
        0;
      const nsegs = data[p + 26] ?? 0;
      if (p + 27 + nsegs > size) {
        findings.push({
          severity: 'error',
          kind: 'page',
          detail:
            'Page ' +
            idx +
            ' at offset ' +
            p +
            ' declares ' +
            nsegs +
            ' segments but overruns the file.',
        });
        break;
      }
      const segLens: number[] = [];
      let bodyLen = 0;
      for (let s = 0; s < nsegs; s += 1) {
        const l = data[p + 27 + s] ?? 0;
        segLens.push(l);
        bodyLen += l;
      }
      if (p + 27 + nsegs + bodyLen > size) {
        findings.push({
          severity: 'error',
          kind: 'page',
          detail:
            'Page ' +
            idx +
            ' at offset ' +
            p +
            ' declares ' +
            bodyLen +
            ' body bytes but overruns the file.',
        });
        break;
      }
      const flags: string[] = [];
      if ((type & 0x01) !== 0) flags.push('continuation');
      if ((type & 0x02) !== 0) flags.push('BOS');
      if ((type & 0x04) !== 0) flags.push('EOS');
      if (flags.length === 0) flags.push('normal');
      pages.push({
        index: idx,
        offset: p,
        type,
        typeFlags: flags.join(', '),
        granule,
        serial,
        seq,
        crc,
        nsegs,
        segLens,
        bodyLen,
      });
      p += 27 + nsegs + bodyLen;
      idx += 1;
    }
    if (p + 27 > size && p < size) {
      findings.push({
        severity: 'warn',
        kind: 'truncated',
        detail: 'A trailing partial page header was found at offset ' + p + '.',
      });
    }
  } else {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file does not begin with an Ogg capture pattern (OggS).',
    });
  }
  if (findings.length === 0) {
    findings.push({ severity: 'info', kind: 'ok', detail: 'The Ogg stream looks well-formed.' });
  }
  return { size, magicOk, version, pages, findings };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose an Ogg container to inspect.',
        'Drop a .ogg, .oga, or .opus file onto the tool.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That Ogg container is too large.', 'Use a file under 256 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'pages');
    let headers: string[];
    let rows: string[][];
    if (view === 'summary') {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Capture pattern', m.magicOk ? 'OggS (valid)' : 'INVALID'],
        ['Stream version', String(m.version)],
        ['Pages', String(m.pages.length)],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = [
        '#',
        'Offset',
        'Type',
        'Flags',
        'Granule',
        'Serial',
        'Seq',
        'Segments',
        'Body len',
      ];
      rows = m.pages.map((g) => [
        String(g.index),
        String(g.offset),
        String(g.type),
        g.typeFlags,
        String(g.granule),
        String(g.serial),
        String(g.seq),
        String(g.nsegs),
        String(g.bodyLen),
      ]);
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(m.pages.length + ' Ogg page(s) found.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
