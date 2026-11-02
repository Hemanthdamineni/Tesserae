import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './tar-inspector.meta';

/**
 * TAR (POSIX/USTAR) archive inspector.
 *
 * A tar archive is a sequence of 512-byte header blocks followed by the file
 * data padded to a 512-byte boundary wholesale. Each header holds the name,
 * octal mode/uid/gid/size/mtime, a type flag, an octal checksum, and the
 * "ustar" magic. The archive ends with one or two zero blocks. The expected
 * values come from the byte-exact fixture built by the Python encoder and
 * confirmed by the `file`(1) reference tool ("POSIX tar archive") and by
 * Python's `tarfile` module, never from this parser.
 */

const BLOCK = 512;
const MAX_BYTES = 512 * 1024 * 1024;
const MAX_ENTRIES = 500000;

interface Entry {
  name: string;
  type: string;
  typeCode: string;
  size: number;
  mode: string;
  uid: string;
  gid: string;
  mtime: string;
  uname: string;
  gname: string;
  checksumOk: boolean;
  checksum: number;
  expected: number;
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'summary');

    const file = input.files[0];
    if (!file) throw new ToolError('Choose a tar archive to inspect.', 'Pick a .tar file.');
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < BLOCK) throw new ToolError('File is too short to be a tar archive.');

    const warnings: string[] = [];
    const entries: Entry[] = [];
    let totalData = 0;

    const readStr = (o: number, len: number): string => {
      let s = '';
      let end = o + len;
      if (end > buf.length) end = buf.length;
      for (let i = o; i < end; i += 1) {
        const c = buf[i] ?? 0;
        if (c === 0) break;
        s += c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : '?';
      }
      return s;
    };

    const readOctal = (o: number, len: number): string => {
      const s = readStr(o, len).trim();
      const m = s.match(/^[0-7]+$/);
      return m ? String(parseInt(s, 8)) : s || '0';
    };

    const typeName = (code: string): string => {
      switch (code) {
        case '0':
        case '\x00':
          return 'file';
        case '1':
          return 'hard link';
        case '2':
          return 'symlink';
        case '3':
          return 'character device';
        case '4':
          return 'block device';
        case '5':
          return 'directory';
        case '6':
          return 'fifo';
        case '7':
          return 'contiguous';
        case 'g':
          return 'global header';
        case 'x':
          return 'extended header';
        default:
          return 'unknown';
      }
    };

    let magic = '';
    let o = 0;
    let count = 0;
    while (o + BLOCK <= buf.length && count < MAX_ENTRIES) {
      // End of archive: a zero block
      if (allZero(buf, o, BLOCK)) break;
      const name = readStr(o, 0x64);
      const mode = readOctal(o + 0x64, 8);
      const uid = readOctal(o + 0x6c, 8);
      const gid = readOctal(o + 0x74, 8);
      const size = parseInt(readOctal(o + 0x7c, 12), 10) || 0;
      const mtime = readOctal(o + 0x88, 12);
      const typeCode = String.fromCharCode(buf[o + 0x9c] ?? 0);
      if (magic === '') magic = readStr(o + 0x101, 6);

      const checksumField = readStr(o + 0x94, 8);
      const expected = parseInt(checksumField.trim().replace(/[^0-7]/g, '') || '0', 8);

      // Recompute checksum with the field treated as spaces
      let sum = 0;
      for (let i = 0; i < BLOCK; i += 1) {
        if (i >= 0x94 && i < 0x9c) sum += 0x20;
        else sum += buf[o + i] ?? 0;
      }
      const checksumOk = (sum & 0xffff) === expected;
      if (!checksumOk) warnings.push('Header checksum mismatch for "' + name + '".');

      const fullName = readStr(o + 0x159, 0x9b); // prefix
      const displayName = fullName ? fullName + '/' + name : name;

      entries.push({
        name: displayName,
        type: typeName(typeCode),
        typeCode: typeCode === '\x00' ? '0' : typeCode,
        size,
        mode: '0o' + mode.replace(/^0o/, ''),
        uid,
        gid,
        mtime,
        uname: readStr(o + 0x109, 32),
        gname: readStr(o + 0x129, 32),
        checksumOk,
        checksum: sum & 0xffff,
        expected,
      });
      totalData += size;
      count += 1;
      o += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
    }

    if (count === 0) throw new ToolError('Not a tar archive (no valid header blocks found).');

    if (view === 'entries') {
      const rows = entries.map((e) => [
        e.name,
        e.type,
        String(e.size),
        e.mode,
        e.uid + ':' + e.gid,
        e.uname + '/' + e.gname,
        e.checksumOk ? 'ok' : 'BAD',
      ]);
      return renderTable(
        ['name', 'type', 'size', 'mode', 'uid:gid', 'owner', 'checksum'],
        rows,
        'tar entries',
        undefined,
        warnings,
      );
    }

    const files = entries.filter((e) => e.type === 'file');
    const dirs = entries.filter((e) => e.type === 'directory');
    const badChecks = entries.filter((e) => !e.checksumOk).length;
    const maxSize = files.reduce((a, e) => (e.size > a ? e.size : a), 0);

    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['Archive format', magic === 'ustar' ? 'USTAR/POSIX' : 'unknown'],
      ['Entries', String(entries.length)],
      ['Regular files', String(files.length)],
      ['Directories', String(dirs.length)],
      ['Total data size', String(totalData) + ' B'],
      ['Largest file', String(maxSize) + ' B'],
      ['Checksum errors', String(badChecks)],
      ['Zero terminator', foundEnd(buf) ? 'present' : 'none'],
    ];

    const notes: string[] = [];
    if (files.length > 0)
      notes.push(files.length + ' regular file(s) with ' + totalData + ' total bytes of data.');

    return renderTable(['field', 'value'], summary, 'tar summary', notes, warnings);
  },
};

function allZero(buf: Uint8Array, o: number, len: number): boolean {
  for (let i = 0; i < len; i += 1) {
    if ((buf[o + i] ?? 0) !== 0) return false;
  }
  return true;
}

function foundEnd(buf: Uint8Array): boolean {
  const len = buf.length;
  return len >= BLOCK && allZero(buf, len - BLOCK, BLOCK);
}

function renderTable(
  headers: string[],
  rows: string[][],
  title: string,
  notes: string[] | undefined,
  warnings: string[],
): FileRunResult {
  const output = JSON.stringify({ title, headers, rows });
  return {
    outputs: [] as OutputFile[],
    report: { output, render: 'table' },
    notes: notes && notes.length > 0 ? notes : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { rows: rows.length },
  };
}

export default tool;
