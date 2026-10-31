import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './class-inspector.meta';

const MAX_BYTES = 64 * 1024 * 1024;

const TAG_NAMES: Record<number, string> = {
  1: 'Utf8',
  3: 'Integer',
  4: 'Float',
  5: 'Long',
  6: 'Double',
  7: 'Class',
  8: 'String',
  9: 'Fieldref',
  10: 'Methodref',
  11: 'InterfaceMethodref',
  12: 'NameAndType',
  15: 'MethodHandle',
  16: 'MethodType',
  17: 'Dynamic',
  18: 'InvokeDynamic',
  19: 'Module',
  20: 'Package',
};

function tagName(t: number): string {
  return TAG_NAMES[t] ?? 'unknown(' + t + ')';
}

interface CpEntry {
  index: number;
  tag: number;
  tagName: string;
  value: string;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  size: number;
  magicOk: boolean;
  minor: number;
  major: number;
  versionLabel: string;
  cpCount: number;
  cp: CpEntry[];
  access: number;
  accessFlags: string[];
  thisIdx: number;
  superIdx: number;
  ifaceCount: number;
  fieldCount: number;
  methodCount: number;
  findings: Finding[];
}

function u2(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) * 256 + (b[o + 1] ?? 0)) >>> 0;
}

function utf8(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = b[off + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function accessFlags(v: number): string[] {
  const out: string[] = [];
  if ((v & 0x0001) !== 0) out.push('public');
  if ((v & 0x0010) !== 0) out.push('final');
  if ((v & 0x0020) !== 0) out.push('super');
  if ((v & 0x0200) !== 0) out.push('interface');
  if ((v & 0x0400) !== 0) out.push('abstract');
  if ((v & 0x1000) !== 0) out.push('synthetic');
  if ((v & 0x2000) !== 0) out.push('annotation');
  if ((v & 0x4000) !== 0) out.push('enum');
  return out;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  let magicOk = false;
  let minor = 0;
  let major = 0;
  let cpCount = 0;
  const cp: CpEntry[] = [];
  let access = 0;
  let thisIdx = 0;
  let superIdx = 0;
  let ifaceCount = 0;
  let fieldCount = 0;
  let methodCount = 0;
  if (size >= 4 && data[0] === 0xca && data[1] === 0xfe && data[2] === 0xba && data[3] === 0xbe) {
    magicOk = true;
    minor = u2(data, 4);
    major = u2(data, 6);
    if (size < 10) {
      findings.push({
        severity: 'error',
        kind: 'header',
        detail: 'The file is too short to contain a constant-pool count.',
      });
    } else {
      cpCount = u2(data, 8);
      let p = 10;
      let i = 1;
      while (i < cpCount) {
        if (p >= size) {
          findings.push({
            severity: 'error',
            kind: 'cp',
            detail: 'Constant-pool entry ' + i + ' overruns the file.',
          });
          break;
        }
        const tag = data[p] ?? 0;
        let value = '';
        let skip = 0;
        if (tag === 1) {
          const ln = u2(data, p + 1);
          value = utf8(data, p + 3, ln);
          skip = 3 + ln;
        } else if (tag === 7 || tag === 8 || tag === 16 || tag === 19 || tag === 20) {
          value = '#' + String(u2(data, p + 1));
          skip = 3;
        } else if (
          tag === 9 ||
          tag === 10 ||
          tag === 11 ||
          tag === 12 ||
          tag === 17 ||
          tag === 18
        ) {
          value = '#' + String(u2(data, p + 1)) + '.#' + String(u2(data, p + 3));
          skip = 5;
        } else if (tag === 15) {
          value = 'kind ' + String(data[p + 1] ?? 0) + ' #' + String(u2(data, p + 2));
          skip = 4;
        } else if (tag === 3 || tag === 4) {
          value = 'bytes';
          skip = 5;
        } else if (tag === 5 || tag === 6) {
          value = 'bytes';
          skip = 9;
          i += 1; // Long/Double take two cp slots
        } else {
          findings.push({
            severity: 'warn',
            kind: 'cp',
            detail: 'Unknown constant-pool tag ' + tag + ' at entry ' + i + '.',
          });
          skip = 3;
        }
        if (p + skip > size) {
          findings.push({
            severity: 'error',
            kind: 'cp',
            detail: 'Constant-pool entry ' + i + ' overruns the file.',
          });
          break;
        }
        cp.push({ index: i, tag, tagName: tagName(tag), value });
        p += skip;
        i += 1;
      }
      if (p + 8 <= size) {
        access = u2(data, p);
        thisIdx = u2(data, p + 2);
        superIdx = u2(data, p + 4);
        ifaceCount = u2(data, p + 6);
        let q = p + 8;
        for (let k = 0; k < ifaceCount; k += 1) q += 2;
        if (q + 2 <= size) {
          fieldCount = u2(data, q);
          methodCount = u2(data, q + 2);
        }
      } else if (size > p) {
        findings.push({
          severity: 'warn',
          kind: 'truncated',
          detail: 'A trailing partial structure follows the constant pool.',
        });
      }
    }
  } else {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file does not begin with the CAFEBABE magic.',
    });
  }
  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      kind: 'ok',
      detail: 'The class structure looks well-formed.',
    });
  }
  return {
    size,
    magicOk,
    minor,
    major,
    versionLabel: major + '.' + minor,
    cpCount,
    cp,
    access,
    accessFlags: accessFlags(access),
    thisIdx,
    superIdx,
    ifaceCount,
    fieldCount,
    methodCount,
    findings,
  };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose a Java class file to inspect.',
        'Drop a .class file onto the tool.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That class file is too large.', 'Use a file under 64 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'constant-pool');
    let headers: string[];
    let rows: string[][];
    if (view === 'constant-pool') {
      headers = ['#', 'Tag', 'Value'];
      rows = m.cp.map((c) => [String(c.index), c.tagName, c.value]);
      if (rows.length === 0) rows.push(['-', 'none', 'No constant-pool entries.']);
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Magic', m.magicOk ? 'CAFEBABE (valid)' : 'INVALID'],
        ['Version', String(m.major) + '.' + String(m.minor)],
        ['Constant-pool count', String(m.cpCount)],
        ['Constant-pool entries', String(m.cp.length)],
        ['Access flags', m.accessFlags.length > 0 ? m.accessFlags.join(', ') : String(m.access)],
        ['This class', '#' + String(m.thisIdx)],
        ['Super class', '#' + String(m.superIdx)],
        ['Interfaces', String(m.ifaceCount)],
        ['Fields', String(m.fieldCount)],
        ['Methods', String(m.methodCount)],
      ];
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(
      'Java class version ' +
        m.major +
        '.' +
        m.minor +
        ' with ' +
        m.cp.length +
        ' constant-pool entrie(s).',
    );
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
