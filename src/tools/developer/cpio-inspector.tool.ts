import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cpio-inspector.meta';

/**
 * cpio archive inspector.
 *
 * Parses the SVR4 "newc" (magic 070701) and the old ASCII (magic 070707)
 * formats: each entry has a fixed 110-byte (newc) or 76-byte (odc) ASCII
 * header whose fields are 8-hex-digit ASCII values (inode, mode, uid, gid,
 * nlink, mtime, filesize, ...), followed by a null-terminated name padded to a
 * 4-byte boundary, then the file data likewise padded. The archive ends with
 * a "TRAILER!!!" entry. Expected values come from the byte-exact fixture
 * confirmed by `file`(1) and an independent parser, never from this one.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_ROWS = 5000;

interface CpioEntry {
  name: string;
  mode: number;
  type: string;
  uid: number;
  gid: number;
  nlink: number;
  mtime: number;
  size: number;
  ino: number;
}

interface Model {
  format: string;
  magic: string;
  entries: CpioEntry[];
  trailer: boolean;
  totalSize: number;
}

const TYPE_NAMES: Record<number, string> = {
  0o0140000: 'Socket',
  0o0120000: 'Symbolic link',
  0o0100000: 'Regular file',
  0o0060000: 'Block device',
  0o0040000: 'Directory',
  0o0020000: 'Character device',
  0o0010000: 'FIFO',
};

function typeOf(mode: number): string {
  const mask = mode & 0o170000;
  return TYPE_NAMES[mask] ?? 'Type 0' + mask.toString(8);
}

function hexField(bytes: Uint8Array, at: number, len: number): number {
  let v = 0;
  for (let i = 0; i < len; i += 1) {
    const c = bytes[at + i] ?? 0;
    let d = 0;
    if (c >= 48 && c <= 57) d = c - 48;
    else if (c >= 97 && c <= 102) d = c - 87;
    else if (c >= 65 && c <= 70) d = c - 55;
    else return v;
    v = v * 16 + d;
  }
  return v;
}

function octField(bytes: Uint8Array, at: number, len: number): number {
  let v = 0;
  for (let i = 0; i < len; i += 1) {
    const c = bytes[at + i] ?? 0;
    if (c < 48 || c > 55) break;
    v = v * 8 + (c - 48);
  }
  return v;
}

function nameAt(bytes: Uint8Array, at: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = bytes[at + i] ?? 0;
    if (c === 0) break;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function pad4(n: number): number {
  return ((n + 3) >> 2) << 2;
}

function formatBytes(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KiB';
  return (n / (1024 * 1024)).toFixed(1) + ' MiB';
}

function parseCpio(bytes: Uint8Array): Model {
  if (bytes.length < 14) throw new ToolError('That file is too short to be a cpio archive.');

  let format: string;
  let magic: string;
  let hdrLen: number;
  let fieldLen: number;
  const head = nameAt(bytes, 0, 6);
  if (head === '070701') {
    format = 'newc (SVR4)';
    magic = '070701';
    hdrLen = 110;
    fieldLen = 8;
  } else if (head === '070707') {
    format = 'odc (old ASCII)';
    magic = '070707';
    hdrLen = 76;
    fieldLen = 6;
  } else {
    throw new ToolError(
      'That file is not a cpio archive.',
      'A cpio archive starts with "070701" or "070707".',
    );
  }
  const entries: CpioEntry[] = [];
  let o = 0;
  let trailer = false;
  let totalSize = 0;
  let guard = 0;

  while (o + hdrLen <= bytes.length) {
    if (guard++ > 100000) throw new ToolError('cpio archive has too many entries.');

    let ino = 0,
      mode = 0,
      uid = 0,
      gid = 0,
      nlink = 0,
      mtime = 0,
      size = 0,
      namesize = 0;
    if (fieldLen === 8) {
      // newc: fixed positions
      ino = hexField(bytes, o + 6, 8);
      mode = hexField(bytes, o + 14, 8);
      uid = hexField(bytes, o + 22, 8);
      gid = hexField(bytes, o + 30, 8);
      nlink = hexField(bytes, o + 38, 8);
      mtime = hexField(bytes, o + 46, 8);
      size = hexField(bytes, o + 54, 8);
      namesize = hexField(bytes, o + 94, 8);
    } else {
      // odc: octal fields, 6 digits each
      ino = octField(bytes, o + 6, 6);
      mode = octField(bytes, o + 12, 6);
      uid = octField(bytes, o + 18, 6);
      gid = octField(bytes, o + 24, 6);
      nlink = octField(bytes, o + 30, 6);
      mtime = octField(bytes, o + 36, 11);
      size = octField(bytes, o + 47, 11);
      namesize = octField(bytes, o + 58, 6);
    }

    const name = nameAt(bytes, o + hdrLen, namesize);
    o += hdrLen + pad4(namesize) + pad4(size);
    if (o > bytes.length) throw new ToolError('A cpio entry overruns the end of the file.');

    if (name === 'TRAILER!!!') {
      trailer = true;
      break;
    }

    entries.push({ name, mode, type: typeOf(mode), uid, gid, nlink, mtime, size, ino });
    totalSize += size;
  }

  if (!trailer && entries.length === 0) {
    throw new ToolError('That file did not contain any readable cpio entries.');
  }

  return { format, magic, entries, trailer, totalSize };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'cpio (' + m.format + ')'],
      ['Magic', m.magic],
      ['Entries', String(m.entries.length)],
      ['Total data size', formatBytes(m.totalSize)],
      ['Trailer', m.trailer ? 'present' : 'missing'],
    ],
  };
}

function tableEntries(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.entries.slice(0, max) : [];
  return {
    headers: ['File', 'Type', 'Size', 'Mode'],
    rows: shown.map((e) => [e.name, e.type, formatBytes(e.size), e.mode.toString(8)]),
  };
}

function tableHeader(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', m.format],
      ['Magic', m.magic],
      ['Entries', String(m.entries.length)],
      ['Total data size', formatBytes(m.totalSize)],
      ['Trailer', m.trailer ? 'present' : 'missing'],
      ['First entry', m.entries[0] ? m.entries[0].name : '(none)'],
    ],
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(MAX_ROWS, Number(options.maxRows ?? 100) || 0));
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No file was provided.', 'Choose a cpio archive to inspect.');
  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 256 MB.');

  const bytes = new Uint8Array(await source.arrayBuffer());
  const m = parseCpio(bytes);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'entries':
      table = tableEntries(m, maxRows);
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
      'cpio ' +
        m.format +
        ' with ' +
        m.entries.length +
        ' entry(ies), ' +
        formatBytes(m.totalSize) +
        ' of data.',
    ],
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { entries: m.entries.length, size: m.totalSize },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
