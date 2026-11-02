import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './sqlite-structure-inspector.meta';

const MAX_BYTES = 512 * 1024 * 1024;

function u16(b: Uint8Array, off: number): number {
  return ((b[off] ?? 0) * 256 + (b[off + 1] ?? 0)) >>> 0;
}

function u32(b: Uint8Array, off: number): number {
  return (
    ((b[off] ?? 0) * 16777216 +
      (b[off + 1] ?? 0) * 65536 +
      (b[off + 2] ?? 0) * 256 +
      (b[off + 3] ?? 0)) >>>
    0
  );
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

const MAGIC = [
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
];

interface Page {
  num: number;
  type: number;
  className: string;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  data: Uint8Array;
  size: number;
  magicOk: boolean;
  pageSize: number;
  fileWriteVer: number;
  fileReadVer: number;
  reserved: number;
  dbSizePages: number;
  freelistPages: number;
  schemaCookie: number;
  schemaFormat: number;
  textEncoding: number;
  userVersion: number;
  applicationId: number;
  pages: Page[];
  findings: Finding[];
}

function classNameOf(type: number): string {
  switch (type) {
    case 2:
      return 'interior-index';
    case 5:
      return 'interior-table';
    case 10:
      return 'leaf-index';
    case 13:
      return 'leaf-table';
    case 0:
      return 'unused';
    default:
      return 'invalid';
  }
}

function buildModel(data: Uint8Array): Model {
  const size = data.length;
  const findings: Finding[] = [];
  const magicOk = MAGIC.every((c, i) => (data[i] ?? 0) === c);
  if (!magicOk) {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file does not begin with the SQLite format magic header.',
    });
  }
  const pageSizeField = u16(data, 16);
  const pageSize = pageSizeField === 1 ? 65536 : pageSizeField;
  if (!isPowerOfTwo(pageSize) || pageSize < 512 || pageSize > 65536) {
    findings.push({
      severity: 'error',
      kind: 'page-size',
      detail:
        'The declared page size ' + pageSize + ' is not a power of two between 512 and 65536.',
    });
  }
  const fileWriteVer = data[18] ?? 0;
  const fileReadVer = data[19] ?? 0;
  const reserved = data[20] ?? 0;
  if (reserved !== 0) {
    findings.push({
      severity: 'warn',
      kind: 'reserved',
      detail: 'The file reserves ' + reserved + ' extra byte(s) per page (unusual).',
    });
  }
  const dbSizePages = u32(data, 28);
  const freelistPages = u32(data, 32);
  const schemaCookie = u32(data, 40);
  const schemaFormat = u32(data, 44);
  if (schemaFormat !== 1 && schemaFormat !== 2 && schemaFormat !== 3 && schemaFormat !== 4) {
    findings.push({
      severity: 'warn',
      kind: 'schema-format',
      detail: 'Unusual schema format number ' + schemaFormat + '.',
    });
  }
  const textEncoding = u32(data, 56);
  const userVersion = u32(data, 60);
  const applicationId = u32(data, 68);

  // Inventory pages. Page 1 is preceded by the 100-byte file header.
  const pages: Page[] = [];
  let unused = 0;
  let invalid = 0;
  const n = dbSizePages;
  for (let pg = 1; pg <= n; pg += 1) {
    const off = (pg - 1) * pageSize + (pg === 1 ? 100 : 0);
    if (off >= size) {
      invalid += 1;
      pages.push({ num: pg, type: -1, className: 'truncated' });
      continue;
    }
    const t = data[off] ?? 0;
    const cls = classNameOf(t);
    if (cls === 'unused') unused += 1;
    else invalid += 1;
    pages.push({ num: pg, type: t, className: cls });
  }

  // Integrity checks.
  const impliedPages = Math.ceil(size / pageSize);
  if (dbSizePages !== impliedPages) {
    if (dbSizePages > impliedPages) {
      findings.push({
        severity: 'error',
        kind: 'size',
        detail:
          'Header declares ' +
          dbSizePages +
          ' pages but the file only holds ' +
          impliedPages +
          '; the file is truncated.',
      });
    } else {
      findings.push({
        severity: 'warn',
        kind: 'size',
        detail:
          'Header declares ' +
          dbSizePages +
          ' pages but the file can hold ' +
          impliedPages +
          '; trailing bytes are present.',
      });
    }
  }
  if (freelistPages !== 0 && unused === 0) {
    findings.push({
      severity: 'warn',
      kind: 'freelist',
      detail:
        'The header lists ' + freelistPages + ' freelist page(s) but none were found in the file.',
    });
  }
  if (invalid > 0) {
    findings.push({
      severity: 'error',
      kind: 'page-type',
      detail: invalid + ' page(s) have an illegal or truncated b-tree type byte.',
    });
  }
  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      kind: 'ok',
      detail: 'The database file structure looks consistent.',
    });
  }
  const model: Model = {
    data,
    size,
    magicOk,
    pageSize,
    fileWriteVer,
    fileReadVer,
    reserved,
    dbSizePages,
    freelistPages,
    schemaCookie,
    schemaFormat,
    textEncoding,
    userVersion,
    applicationId,
    pages,
    findings,
  };
  return model;
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose a SQLite database file to inspect.',
        'Drop a .db, .sqlite or .sqlite3 file onto the tool.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That database file is too large.', 'Use a file under 512 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'summary');
    let headers: string[];
    let rows: string[][];
    if (view === 'pages') {
      headers = ['Page', 'Type', 'Class'];
      rows = m.pages.map((p) => [String(p.num), p.type === -1 ? '-' : String(p.type), p.className]);
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Property', 'Value'];
      rows = [];
      rows.push(['File size', m.size + ' B']);
      rows.push(['SQLite magic', m.magicOk ? 'valid' : 'MISSING']);
      rows.push(['Page size', String(m.pageSize) + ' B']);
      rows.push(['File format write', String(m.fileWriteVer)]);
      rows.push(['File format read', String(m.fileReadVer)]);
      rows.push(['Reserved space/page', String(m.reserved)]);
      rows.push(['Database size', m.dbSizePages + ' page(s)']);
      rows.push(['Freelist pages', String(m.freelistPages)]);
      rows.push(['Schema cookie', String(m.schemaCookie)]);
      rows.push(['Schema format', String(m.schemaFormat)]);
      rows.push([
        'Text encoding',
        m.textEncoding === 1
          ? 'UTF-8'
          : m.textEncoding === 2
            ? 'UTF-16le'
            : m.textEncoding === 3
              ? 'UTF-16be'
              : String(m.textEncoding),
      ]);
      rows.push(['User version', String(m.userVersion)]);
      rows.push(['Application id', String(m.applicationId)]);
      rows.push([
        'Leaf-table pages',
        String(m.pages.filter((p) => p.className === 'leaf-table').length),
      ]);
      rows.push([
        'Interior-table pages',
        String(m.pages.filter((p) => p.className === 'interior-table').length),
      ]);
      rows.push([
        'Leaf-index pages',
        String(m.pages.filter((p) => p.className === 'leaf-index').length),
      ]);
      rows.push([
        'Interior-index pages',
        String(m.pages.filter((p) => p.className === 'interior-index').length),
      ]);
      rows.push(['Unused pages', String(m.pages.filter((p) => p.className === 'unused').length)]);
      rows.push([
        'Invalid pages',
        String(
          m.pages.filter((p) => p.className === 'invalid' || p.className === 'truncated').length,
        ),
      ]);
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push('Parsed ' + m.pages.length + ' page(s) of ' + m.pageSize + ' bytes.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
