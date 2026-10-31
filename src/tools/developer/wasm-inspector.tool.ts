import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './wasm-inspector.meta';

const MAX_BYTES = 256 * 1024 * 1024;

const SECTION_NAMES: Record<number, string> = {
  0: 'custom',
  1: 'type',
  2: 'import',
  3: 'function',
  4: 'table',
  5: 'memory',
  6: 'global',
  7: 'export',
  8: 'start',
  9: 'element',
  10: 'code',
  11: 'data',
  12: 'datacount',
};

interface Section {
  offset: number;
  id: number;
  name: string;
  size: number;
  detail: string;
  inOrder: boolean;
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
  sections: Section[];
  findings: Finding[];
}

/** Read an unsigned LEB128 from b starting at off; returns [value, nextOffset]. */
function uleb(b: Uint8Array, off: number): [number, number] {
  let v = 0;
  let shift = 0;
  let o = off;
  for (let i = 0; i < 5; i += 1) {
    const c = b[o] ?? 0;
    v |= (c & 0x7f) << shift;
    shift += 7;
    o += 1;
    if ((c & 0x80) === 0) break;
  }
  return [v >>> 0, o];
}

function latin1(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) s += String.fromCharCode(b[off + i] ?? 0);
  return s;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  const magicOk =
    size >= 4 && data[0] === 0x00 && data[1] === 0x61 && data[2] === 0x73 && data[3] === 0x6d;
  if (!magicOk) {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file does not begin with the WASM magic 0x00 61 73 6D.',
    });
  }
  const version =
    size >= 8
      ? ((data[4] ?? 0) +
          (data[5] ?? 0) * 256 +
          (data[6] ?? 0) * 65536 +
          (data[7] ?? 0) * 16777216) >>>
        0
      : 0;
  if (version !== 1) {
    findings.push({
      severity: 'error',
      kind: 'version',
      detail: 'Unsupported WASM version ' + version + ' (expected 1).',
    });
  }
  const sections: Section[] = [];
  const idsSeen = new Set<number>();
  let lastNonCustom = 0;
  let i = 8;
  while (i < size) {
    const sid = data[i] ?? 0;
    const [secSize, afterSize] = uleb(data, i + 1);
    const payloadStart = afterSize;
    const payloadEnd = payloadStart + secSize;
    let overrun = false;
    if (payloadEnd > size) {
      overrun = true;
      findings.push({
        severity: 'error',
        kind: 'overrun',
        detail:
          'Section ' +
          SECTION_NAMES[sid] +
          ' at offset ' +
          i +
          ' declares ' +
          secSize +
          ' bytes but overruns the file (' +
          payloadEnd +
          ' > ' +
          size +
          ').',
      });
    }
    const isCustom = sid === 0;
    let inOrder = true;
    if (!isCustom && sid < lastNonCustom) {
      inOrder = false;
      findings.push({
        severity: 'warn',
        kind: 'order',
        detail: 'Section ' + SECTION_NAMES[sid] + ' (id ' + sid + ') appears out of numeric order.',
      });
    }
    if (!isCustom) lastNonCustom = sid;
    if (!isCustom && idsSeen.has(sid)) {
      findings.push({
        severity: 'warn',
        kind: 'duplicate',
        detail: 'Non-custom section ' + SECTION_NAMES[sid] + ' appears more than once.',
      });
    }
    idsSeen.add(sid);
    let detail = '';
    const bound = Math.min(payloadEnd, size);
    if (sid === 0 && bound > payloadStart) {
      // custom section: name length + name
      const [nlen, noff] = uleb(data, payloadStart);
      const cname = latin1(data, noff, Math.min(nlen, bound - noff));
      detail = 'custom: ' + cname;
    } else if (sid === 2 && bound > payloadStart) {
      // import section: count
      const [cnt] = uleb(data, payloadStart);
      detail = cnt + ' import(s)';
    } else if (sid === 7 && bound > payloadStart) {
      const [cnt] = uleb(data, payloadStart);
      detail = cnt + ' export(s)';
    } else if (sid === 3 && bound > payloadStart) {
      const [cnt] = uleb(data, payloadStart);
      detail = cnt + ' function(s)';
    } else if (sid === 5 && bound > payloadStart) {
      const [cnt] = uleb(data, payloadStart);
      detail = cnt + ' memory(ies)';
    } else if (sid === 10 && bound > payloadStart) {
      const [cnt] = uleb(data, payloadStart);
      detail = cnt + ' code body(ies)';
    }
    sections.push({
      offset: i,
      id: sid,
      name: SECTION_NAMES[sid] ?? 'id-' + sid,
      size: secSize,
      detail,
      inOrder,
    });
    i = payloadEnd;
    if (overrun) break;
  }
  if (i > size) {
    findings.push({
      severity: 'error',
      kind: 'truncated',
      detail: 'A section overruns the end of the file.',
    });
  }
  if (i < size && magicOk) {
    findings.push({
      severity: 'warn',
      kind: 'trailing',
      detail: size - i + ' trailing byte(s) follow the last section.',
    });
  }
  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      kind: 'ok',
      detail: 'The WASM module structure looks well-formed.',
    });
  }
  return { size, magicOk, version, sections, findings };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose a WebAssembly module to inspect.',
        'Drop a .wasm file onto the tool.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That WASM module is too large.', 'Use a file under 256 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'sections');
    let headers: string[];
    let rows: string[][];
    if (view === 'summary') {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Magic', m.magicOk ? 'valid (0x00 61 73 6D)' : 'MISSING'],
        ['Version', String(m.version)],
        ['Sections', String(m.sections.length)],
        ['Custom sections', String(m.sections.filter((s) => s.id === 0).length)],
        ['Type sections', String(m.sections.filter((s) => s.id === 1).length)],
        ['Function sections', String(m.sections.filter((s) => s.id === 3).length)],
        ['Import sections', String(m.sections.filter((s) => s.id === 2).length)],
        ['Export sections', String(m.sections.filter((s) => s.id === 7).length)],
        ['Code sections', String(m.sections.filter((s) => s.id === 10).length)],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Offset', 'ID', 'Section', 'Size', 'Detail'];
      rows = m.sections.map((s) => [
        String(s.offset),
        String(s.id),
        s.name,
        String(s.size),
        s.detail,
      ]);
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(m.sections.length + ' section(s) parsed.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
