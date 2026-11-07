import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './crx-inspector.meta';

/**
 * Chrome / Chromium extension (CRX) inspector.
 *
 * Parses the CRX container: the "Cr24" magic, the CRX format version and header
 * size, and for version-3 files the "CRX3" header block with its varint header
 * data length and the embedded extension ID. It then walks the ZIP
 * archive's central directory and lists every entry. The expected values come
 * from the byte-exact fixture confirmed by the reference tool `file`(1) and an
 * independent CRX/ZIP parser, never from this parser.
 */

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_ROWS = 5000;

interface ZipEntry {
  name: string;
  size: number;
  compressed: number;
}

interface Model {
  magic: boolean;
  version: number;
  headerSize: number;
  crx3Magic: boolean;
  headerDataLength: number;
  extensionId: string;
  zipOffset: number;
  zipValid: boolean;
  entries: ZipEntry[];
  totalUncompressed: number;
}

function u16(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8)) >>> 0;
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

function ascii(bytes: Uint8Array, at: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = bytes[at + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function formatBytes(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KiB';
  return (n / (1024 * 1024)).toFixed(1) + ' MiB';
}

/** Read a base-128 varint at `at`, returning value and next offset. */
function varintAt(bytes: Uint8Array, at: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let o = at;
  let guard = 0;
  while (true) {
    if (o >= bytes.length) throw new ToolError('Truncated CRX3 header.');
    const b = bytes[o] ?? 0;
    o += 1;
    value |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
    if (guard++ > 10) throw new ToolError('CRX3 header length varint is too long.');
  }
  return { value, next: o };
}

/** Parse the ZIP central directory, returning entries. */
function parseZip(bytes: Uint8Array, zipOffset: number): { entries: ZipEntry[]; valid: boolean } {
  // Find End of Central Directory record (PK\x05\x06) scanning from the end.
  let eocd = -1;
  const start = Math.max(zipOffset, bytes.length - 70000);
  for (let i = bytes.length - 22; i >= start; i -= 1) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return { entries: [], valid: false };

  const cdOffset = u32(bytes, eocd + 16);
  const cdCount = u16(bytes, eocd + 10);
  const entries: ZipEntry[] = [];
  // Central directory offsets are relative to the ZIP archive start.
  let at = zipOffset + cdOffset;
  const capped = Math.min(cdCount, 5000);
  for (let k = 0; k < capped; k += 1) {
    // Central directory file header: PK\x01\x02
    if (at + 46 > bytes.length) break;
    if (
      bytes[at] !== 0x50 ||
      bytes[at + 1] !== 0x4b ||
      bytes[at + 2] !== 0x01 ||
      bytes[at + 3] !== 0x02
    )
      break;
    const method = u16(bytes, at + 10);
    const compSize = u32(bytes, at + 20);
    const uncompSize = u32(bytes, at + 24);
    const nameLen = u16(bytes, at + 28);
    const extraLen = u16(bytes, at + 30);
    const commentLen = u16(bytes, at + 32);
    const name = ascii(bytes, at + 46, nameLen);
    entries.push({ name, size: uncompSize, compressed: method === 0 ? compSize : compSize });
    at += 46 + nameLen + extraLen + commentLen;
  }
  const valid = entries.length === cdCount || cdCount === 0;
  return { entries, valid };
}

function parseCrx(bytes: Uint8Array): Model {
  if (bytes.length < 16)
    throw new ToolError('That file is too short to be a CRX extension package.');
  const magic = ascii(bytes, 0, 4) === 'Cr24';
  if (!magic) {
    throw new ToolError(
      'That file is not a Chrome extension package.',
      'A CRX file starts with the 4 bytes "Cr24".',
    );
  }

  const version = u32(bytes, 4);
  const headerSize = u32(bytes, 8);
  let crx3Magic = false;
  let headerDataLength = 0;
  let extensionId = '';
  let zipOffset = 12 + headerSize;

  if (version === 3) {
    if (bytes.length < 16) throw new ToolError('That CRX file is too short for a CRX3 header.');
    crx3Magic = ascii(bytes, 12, 4) === 'CRX3';
    if (crx3Magic) {
      const v = varintAt(bytes, 16);
      headerDataLength = v.value;
      zipOffset = v.next + headerDataLength;
      // extension id is the first 16 bytes of the signed header data (field 1)
      const hdStart = v.next;
      if (hdStart + 2 <= bytes.length && bytes[hdStart] === 0x0a) {
        const idStart = hdStart + 2;
        if (idStart + 16 <= bytes.length) {
          extensionId = hex(bytes.subarray(idStart, idStart + 16));
        }
      }
    } else {
      throw new ToolError('That CRX file claims version 3 but does not have a valid CRX3 header.');
    }
  } else if (version !== 2) {
    throw new ToolError(
      'Unsupported CRX version: ' + version + '.',
      'Only CRX2 and CRX3 are recognised.',
    );
  }

  if (zipOffset + 4 > bytes.length) throw new ToolError('The CRX file has no ZIP payload.');
  const zipValid = bytes[zipOffset] === 0x50 && bytes[zipOffset + 1] === 0x4b;
  const zip = parseZip(bytes, zipOffset);

  const totalUncompressed = zip.entries.reduce((s, e) => s + e.size, 0);
  return {
    magic,
    version,
    headerSize,
    crx3Magic,
    headerDataLength,
    extensionId,
    zipOffset,
    zipValid,
    entries: zip.entries,
    totalUncompressed,
  };
}

function hex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return s;
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const hasManifest = m.entries.some((e) => e.name === 'manifest.json');
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'Chrome extension (CRX)'],
      ['CRX version', String(m.version)],
      ['Header size', String(m.headerSize) + ' bytes'],
      ['CRX3 header', m.version === 3 ? (m.crx3Magic ? 'valid' : 'invalid') : 'n/a'],
      ['Extension ID', m.extensionId || '(n/a)'],
      ['ZIP payload', m.zipValid ? 'intact' : 'missing'],
      ['Files', String(m.entries.length)],
      ['Uncompressed size', formatBytes(m.totalUncompressed)],
      ['manifest.json', hasManifest ? 'present' : 'absent'],
    ],
  };
}

function tableHeader(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Magic', m.magic ? 'Cr24 (valid)' : 'missing'],
      ['Version', String(m.version)],
      ['Header size', String(m.headerSize)],
      ['CRX3 magic', m.version === 3 ? (m.crx3Magic ? 'CRX3 (valid)' : 'invalid') : 'n/a'],
      ['Header data length', m.version === 3 ? String(m.headerDataLength) : 'n/a'],
      ['Extension ID', m.extensionId || '(n/a)'],
      ['ZIP offset', String(m.zipOffset)],
      ['ZIP signature', m.zipValid ? 'PK (valid)' : 'missing'],
    ],
  };
}

function tableFiles(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.entries.slice(0, max) : [];
  return {
    headers: ['File', 'Size'],
    rows: shown.map((e) => [e.name, formatBytes(e.size)]),
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(MAX_ROWS, Number(options.maxRows ?? 100) || 0));
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No file was provided.', 'Choose a CRX extension package to inspect.');
  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 64 MB.');

  const bytes = new Uint8Array(await source.arrayBuffer());
  const m = parseCrx(bytes);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'header':
      table = tableHeader(m);
      break;
    case 'files':
      table = tableFiles(m, maxRows);
      break;
    case 'summary':
    default:
      table = tableSummary(m);
  }

  return {
    outputs: [] as OutputFile[],
    report: { output: JSON.stringify(table), render: 'table' },
    notes: [
      'CRX v' +
        m.version +
        ' with ' +
        m.entries.length +
        ' file(s), ' +
        formatBytes(m.totalUncompressed) +
        ' unpacked.',
    ],
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { files: m.entries.length, size: m.totalUncompressed, version: m.version },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
