import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './asar-inspector.meta';

/**
 * Electron ASAR archive inspector.
 *
 * ASAR (Electron Archive) layout: a 4-byte little-endian length of the header
 * block, then the header block (a "pickle": a 4-byte LE JSON size followed by
 * the JSON header), then the concatenated file data. The JSON header stores a
 * "files" tree where every entry has "size" and "offset" (a string offset into
 * the data region); directories carry a nested "files" map. Expected values
 * come from the byte-exact fixture confirmed by an independent parser, never
 * from this one.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_ROWS = 5000;

interface AsarFile {
  path: string;
  size: number;
  offset: number;
}

interface Model {
  headerSize: number;
  jsonSize: number;
  files: AsarFile[];
  totalFiles: number;
  totalSize: number;
  dataStart: number;
}

function u32(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] ?? 0) |
      ((bytes[at + 1] ?? 0) << 8) |
      ((bytes[at + 2] ?? 0) << 16) |
      ((bytes[at + 3] ?? 0) << 24)) >>>
    0
  );
}

function decodeUtf8(bytes: Uint8Array): string {
  let s = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i] ?? 0;
    i += 1;
    if (b < 0x80) {
      s += String.fromCharCode(b);
    } else if (b < 0xe0 && i < bytes.length) {
      s += String.fromCharCode(((b & 0x1f) << 6) | ((bytes[i] ?? 0) & 0x3f));
      i += 1;
    } else if (b < 0xf0 && i + 1 < bytes.length) {
      s += String.fromCharCode(
        ((b & 0x0f) << 12) | (((bytes[i] ?? 0) & 0x3f) << 6) | ((bytes[i + 1] ?? 0) & 0x3f),
      );
      i += 2;
    } else if (i + 2 < bytes.length) {
      const cp =
        ((b & 0x07) << 18) |
        (((bytes[i] ?? 0) & 0x3f) << 12) |
        (((bytes[i + 1] ?? 0) & 0x3f) << 6) |
        ((bytes[i + 2] ?? 0) & 0x3f);
      s += String.fromCodePoint(cp);
      i += 3;
    }
  }
  return s;
}

function parseAsar(bytes: Uint8Array): Model {
  if (bytes.length < 5) throw new ToolError('That file is too short to be an ASAR archive.');
  const headerSize = u32(bytes, 0);
  if (headerSize < 8 || headerSize > bytes.length - 4) {
    throw new ToolError('That file has an invalid ASAR header length.');
  }
  const headerEnd = 4 + headerSize;
  const jsonSize = u32(bytes, 4);
  if (jsonSize < 2 || jsonSize > headerSize - 4) {
    throw new ToolError('That file has an invalid ASAR header JSON size.');
  }
  const jsonBytes = bytes.subarray(8, 8 + jsonSize);
  const jsonText = decodeUtf8(jsonBytes).trim();
  let root: { files?: Record<string, unknown> };
  try {
    root = JSON.parse(jsonText) as { files?: Record<string, unknown> };
  } catch {
    throw new ToolError('The ASAR header does not contain valid JSON.');
  }
  if (!root.files || typeof root.files !== 'object') {
    throw new ToolError('The ASAR header has no "files" tree.');
  }

  const files: AsarFile[] = [];
  let totalSize = 0;
  const walk = (node: Record<string, unknown>, prefix: string): void => {
    for (const key of Object.keys(node)) {
      const val = node[key] as Record<string, unknown> | undefined;
      if (!val || typeof val !== 'object') continue;
      const full = prefix + key;
      if (typeof (val as { files?: unknown }).files === 'object') {
        walk((val as { files: Record<string, unknown> }).files, full + '/');
      } else {
        const size =
          typeof (val as { size?: unknown }).size === 'number' ? (val as { size: number }).size : 0;
        const offStr = (val as { offset?: unknown }).offset;
        const offset = typeof offStr === 'string' ? Number(offStr) || 0 : 0;
        files.push({ path: full, size, offset });
        totalSize += size;
      }
    }
  };
  walk(root.files, '');

  return { headerSize, jsonSize, files, totalFiles: files.length, totalSize, dataStart: headerEnd };
}

function formatBytes(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KiB';
  return (n / (1024 * 1024)).toFixed(1) + ' MiB';
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'ASAR (Electron archive)'],
      ['Header size', String(m.headerSize) + ' bytes'],
      ['JSON size', String(m.jsonSize) + ' bytes'],
      ['Files', String(m.totalFiles)],
      ['Total size', formatBytes(m.totalSize)],
      ['Data start', String(m.dataStart)],
    ],
  };
}

function tableFiles(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.files.slice(0, max) : [];
  return {
    headers: ['File', 'Size', 'Offset'],
    rows: shown.map((f) => [f.path, formatBytes(f.size), String(f.offset)]),
  };
}

function tableHeader(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'ASAR (Electron archive)'],
      ['Header size', String(m.headerSize)],
      ['JSON size', String(m.jsonSize)],
      ['Files', String(m.totalFiles)],
      ['Total size', formatBytes(m.totalSize)],
    ],
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(MAX_ROWS, Number(options.maxRows ?? 200) || 0));
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No file was provided.', 'Choose an ASAR archive to inspect.');
  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 256 MB.');

  const bytes = new Uint8Array(await source.arrayBuffer());
  const m = parseAsar(bytes);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'files':
      table = tableFiles(m, maxRows);
      break;
    case 'header':
      table = tableHeader(m);
      break;
    case 'summary':
    default:
      table = tableSummary(m);
  }

  return {
    outputs: [] as OutputFile[],
    report: { output: JSON.stringify(table), render: 'table' },
    notes: [
      'ASAR with ' +
        m.totalFiles +
        ' file(s), ' +
        formatBytes(m.totalSize) +
        ' unpacked, header ' +
        m.headerSize +
        ' bytes.',
    ],
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { files: m.totalFiles, size: m.totalSize, headerSize: m.headerSize },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
