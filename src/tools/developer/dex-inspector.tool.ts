import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './dex-inspector.meta';

/**
 * DEX (Dalvik Executable) inspector.
 *
 * Parses the Android .dex header and table directory per the Dalvik
 * bytecode specification. Expected values in the tests come from the
 * `file`(1) reference tool and a byte-level field dump, never from this
 * parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_STRINGS = 5000;

function readU32(b: Uint8Array, o: number): number {
  return (
    ((b[o] ?? 0) + ((b[o + 1] ?? 0) << 8) + ((b[o + 2] ?? 0) << 16) + ((b[o + 3] ?? 0) << 24)) >>> 0
  );
}

/** Adler-32 over bytes[from..] per the DEX checksum definition. */
function adler32(b: Uint8Array, from: number): number {
  const MOD = 65521;
  let a = 1;
  let c = 0;
  for (let i = from; i < b.length; i += 1) {
    a = (a + (b[i] ?? 0)) % MOD;
    c = (c + a) % MOD;
  }
  return ((c << 16) | a) >>> 0;
}

async function sha1Hex(b: Uint8Array, from: number): Promise<string> {
  if (typeof crypto === 'undefined' || crypto.subtle === undefined) return '';
  const sub = b.subarray(from);
  const digest = await crypto.subtle.digest('SHA-1', sub as BufferSource);
  const arr = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < arr.length; i += 1) {
    out += (arr[i] ?? 0).toString(16).padStart(2, '0');
  }
  return out;
}

/** Read a MUTF-8 string data item starting at offset o (skips the uleb size). */
function decodeMutf8(b: Uint8Array, o: number): { text: string; end: number } {
  // uleb128 utf16_size
  let p = o;
  for (let k = 0; k < 5 && p < b.length; k += 1) {
    const byte = b[p] ?? 0;
    p += 1;
    if ((byte & 0x80) === 0) break;
  }
  let out = '';
  while (p < b.length) {
    const c = b[p] ?? 0;
    if (c === 0) {
      p += 1;
      break;
    }
    if (c < 0x80) {
      out += String.fromCharCode(c);
      p += 1;
    } else if ((c & 0xe0) === 0xc0) {
      const c1 = b[p + 1] ?? 0;
      out += String.fromCharCode(((c & 0x1f) << 6) | (c1 & 0x3f));
      p += 2;
    } else if ((c & 0xf0) === 0xe0) {
      const c1 = b[p + 1] ?? 0;
      const c2 = b[p + 2] ?? 0;
      out += String.fromCharCode(((c & 0x0f) << 12) | ((c1 & 0x3f) << 6) | (c2 & 0x3f));
      p += 3;
    } else {
      p += 1;
    }
  }
  return { text: out, end: p };
}

function hex8(v: number): string {
  return '0x' + v.toString(16).padStart(8, '0');
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'summary');

    const file = input.files[0];
    if (!file)
      throw new ToolError('Choose a DEX file to inspect.', 'Pick a classes.dex or .dex file.');
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 112) throw new ToolError('File is too short to be a DEX binary.');

    // ---- magic + version ----
    const magicBytes = Array.from(buf.subarray(0, 4));
    if (
      magicBytes[0] !== 0x64 ||
      magicBytes[1] !== 0x65 ||
      magicBytes[2] !== 0x78 ||
      magicBytes[3] !== 0x0a
    ) {
      throw new ToolError(
        'Not a DEX file (bad magic).',
        'A DEX binary must start with the four bytes "dex\\n".',
      );
    }
    const version = String.fromCharCode(buf[4] ?? 0, buf[5] ?? 0, buf[6] ?? 0);

    const fileSize = readU32(buf, 32);
    const headerSize = readU32(buf, 36);
    const endianTag = readU32(buf, 40);
    const linkSize = readU32(buf, 44);
    const linkOff = readU32(buf, 48);
    const mapOff = readU32(buf, 52);

    const stringIdsSize = readU32(buf, 56);
    const stringIdsOff = readU32(buf, 60);
    const typeIdsSize = readU32(buf, 64);
    const typeIdsOff = readU32(buf, 68);
    const protoIdsSize = readU32(buf, 72);
    const protoIdsOff = readU32(buf, 76);
    const fieldIdsSize = readU32(buf, 80);
    const fieldIdsOff = readU32(buf, 84);
    const methodIdsSize = readU32(buf, 88);
    const methodIdsOff = readU32(buf, 92);
    const classDefsSize = readU32(buf, 96);
    const classDefsOff = readU32(buf, 100);
    const dataSize = readU32(buf, 104);
    const dataOff = readU32(buf, 108);

    // ---- verify checksum + signature ----
    const expectedChecksum = readU32(buf, 8);
    const actualChecksum = adler32(buf, 12);
    const expectedSig = Array.from(buf.subarray(12, 32))
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('');
    const actualSig = await sha1Hex(buf, 32);

    // ---- decode string table ----
    const strings: string[] = [];
    const maxStr = Math.min(stringIdsSize, MAX_STRINGS);
    for (let i = 0; i < maxStr && stringIdsOff + i * 4 + 4 <= buf.length; i += 1) {
      const dataOffStr = readU32(buf, stringIdsOff + i * 4);
      if (dataOffStr >= buf.length) {
        strings.push('<invalid offset>');
        continue;
      }
      const { text } = decodeMutf8(buf, dataOffStr);
      strings.push(text);
    }
    if (stringIdsSize > MAX_STRINGS)
      strings.push('... and ' + (stringIdsSize - MAX_STRINGS) + ' more');

    // ---- decode type table ----
    const types: string[] = [];
    const maxType = Math.min(typeIdsSize, MAX_STRINGS);
    for (let i = 0; i < maxType && typeIdsOff + i * 4 + 4 <= buf.length; i += 1) {
      const descIdx = readU32(buf, typeIdsOff + i * 4);
      if (descIdx < strings.length) types.push(strings[descIdx] ?? '?');
      else types.push('<out of range>');
    }
    if (typeIdsSize > MAX_STRINGS) types.push('... and ' + (typeIdsSize - MAX_STRINGS) + ' more');

    // ---- findings ----
    const warnings: string[] = [];
    if (expectedChecksum !== actualChecksum) {
      warnings.push(
        'Checksum mismatch: stored ' +
          hex8(expectedChecksum) +
          ', computed ' +
          hex8(actualChecksum) +
          '.',
      );
    }
    if (expectedSig !== actualSig) {
      warnings.push(
        'SHA-1 signature mismatch: stored ' +
          expectedSig.slice(0, 12) +
          ', computed ' +
          actualSig.slice(0, 12) +
          '.',
      );
    }
    if (headerSize !== 0x70) {
      warnings.push('Header size ' + headerSize + ' is not the expected 0x70.');
    }
    if (endianTag !== 0x12345678 && endianTag !== 0x78563412) {
      warnings.push('Unknown endian tag ' + hex8(endianTag) + '.');
    }

    // ---- views ----
    if (view === 'strings') {
      const rows = strings.map((s, i) => [String(i), s]);
      return renderTable(['#', 'string'], rows, 'DEX string table');
    }
    if (view === 'types') {
      const rows = types.map((s, i) => [String(i), s]);
      return renderTable(['#', 'descriptor'], rows, 'DEX type table');
    }

    // summary view
    const endian =
      endianTag === 0x12345678 ? 'little' : endianTag === 0x78563412 ? 'big' : 'unknown';
    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['DEX version', version],
      [
        'Checksum (Adler-32)',
        hex8(expectedChecksum) + (expectedChecksum === actualChecksum ? ' OK' : ' MISMATCH'),
      ],
      [
        'Signature (SHA-1)',
        expectedSig.slice(0, 16) + (expectedSig === actualSig ? ' OK' : ' MISMATCH'),
      ],
      ['Endian tag', hex8(endianTag) + ' (' + endian + ')'],
      ['String IDs', String(stringIdsSize) + ' @ ' + hex8(stringIdsOff)],
      ['Type IDs', String(typeIdsSize) + ' @ ' + hex8(typeIdsOff)],
      ['Proto IDs', String(protoIdsSize) + ' @ ' + hex8(protoIdsOff)],
      ['Field IDs', String(fieldIdsSize) + ' @ ' + hex8(fieldIdsOff)],
      ['Method IDs', String(methodIdsSize) + ' @ ' + hex8(methodIdsOff)],
      ['Class defs', String(classDefsSize) + ' @ ' + hex8(classDefsOff)],
      ['Link size/off', linkSize + ' @ ' + hex8(linkOff)],
      ['Map off', hex8(mapOff)],
      ['Data size/off', dataSize + ' @ ' + hex8(dataOff)],
      ['Declared size', String(fileSize) + ' B'],
    ];

    const notes: string[] = [];
    if (classDefsSize > 0)
      notes.push(
        String(classDefsSize) +
          ' class definition' +
          (classDefsSize === 1 ? '' : 's') +
          ' in this DEX.',
      );
    if (strings.length > 0 && strings[0]) notes.push('First string: ' + strings[0] + '.');

    return renderTable(['field', 'value'], summary, 'DEX summary', notes, warnings);
  },
};

function renderTable(
  headers: string[],
  rows: string[][],
  title: string,
  notes: string[] = [],
  warnings: string[] = [],
): FileRunResult {
  const output = JSON.stringify({ title, headers, rows });
  return {
    outputs: [] as OutputFile[],
    report: { output, render: 'table' },
    notes: notes.length > 0 ? notes : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { rows: rows.length },
  };
}

export default tool;
