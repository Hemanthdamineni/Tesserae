import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './mach-o-inspector.meta';

/**
 * Mach-O binary inspector.
 *
 * Parses the Mach-O header, walks every load command, and decodes the common
 * commands (segments, symbol table, dylibs, version info) into readable rows.
 * Expected values in the tests come from the `file`(1) reference tool, not
 * from this parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_ROWS = 5000;

const MH_MAGIC_64 = 0xfeedfacf;
const MH_MAGIC_32 = 0xfeedface;
const MH_CIGAM_64 = 0xcffaedfe;
const MH_CIGAM_32 = 0xcefaedfe;

const FILETYPES: Record<number, string> = {
  0x1: 'MH_OBJECT (relocatable object)',
  0x2: 'MH_EXECUTE (executable)',
  0x3: 'MH_FVMLIB',
  0x4: 'MH_DYLIB (dynamic library)',
  0x5: 'MH_DYLINKER',
  0x6: 'MH_BUNDLE (bundle)',
  0x7: 'MH_DYLIB_STUB',
  0x8: 'MH_DSYM',
  0x9: 'MH_KEXT_BUNDLE (kernel extension)',
  0xa: 'MH_FILESET',
};

const CPUS: Record<number, string> = {
  7: 'Intel i386',
  12: 'ARM',
  18: 'PowerPC',
  0x01000007: 'x86_64',
  0x0100000c: 'ARM64',
  0x01000012: 'PowerPC64',
  0x0100001a: 'LoongArch64',
};

const MH_PIE = 0x00200000;
const MH_TWOLEVEL = 0x0080;
const MH_NOUNDEFS = 0x0004;
const MH_DYLDLINK = 0x0001;
const MH_ALLOW_STACK_EXECUTION = 0x020000;
const MH_NO_HEAP_EXECUTION = 0x01000000;

const LC_SEGMENT = 0x1;
const LC_SYMTAB = 0x2;
const LC_LOAD_DYLINKER = 0xe;
const LC_UUID = 0x1b;
const LC_SEGMENT_64 = 0x19;
const LC_LOAD_DYLIB = 0xc;
const LC_ID_DYLIB = 0xd;
const LC_VERSION_MIN_MACOSX = 0x24;
const LC_VERSION_MIN_IPHONEOS = 0x25;
const LC_VERSION_MIN_WATCHOS = 0x30;
const LC_VERSION_MIN_TVOS = 0x2f;
const LC_BUILD_VERSION = 0x32;
const LC_MAIN = 0x80000028;
const LC_FUNCTION_STARTS = 0x26;
const LC_DATA_IN_CODE = 0x29;
const LC_SOURCE_VERSION = 0x2a;
const LC_DYLD_INFO = 0x22;
const LC_DYLD_INFO_ONLY = 0x80000022;

const PLATFORMS: Record<number, string> = {
  0: 'unknown',
  1: 'macOS',
  2: 'iOS',
  3: 'tvOS',
  4: 'watchOS',
  5: 'bridgeOS',
  6: 'macCatalyst',
  7: 'iOS Simulator',
  8: 'tvOS Simulator',
  9: 'watchOS Simulator',
  10: 'driverKit',
};

interface Segment {
  cmd: string;
  segname: string;
  vmaddr: number;
  vmsize: number;
  fileoff: number;
  filesize: number;
  nsects: number;
  maxprot: string;
  initprot: string;
}

function readU32(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) * 256 + (b[o + 1] ?? 0)) * 65536 + (b[o + 2] ?? 0) * 256 + (b[o + 3] ?? 0);
}

function readU32LE(b: Uint8Array, o: number): number {
  return (b[o] ?? 0) + (b[o + 1] ?? 0) * 256 + (b[o + 2] ?? 0) * 65536 + (b[o + 3] ?? 0) * 16777216;
}

function readU64LE(b: Uint8Array, o: number): number {
  return readU32LE(b, o) + readU32LE(b, o + 4) * 4294967296;
}

/** Read a null-terminated UTF-8 string field, mapped to printable ASCII. */
function readCString(b: Uint8Array, o: number, maxLen: number): string {
  let end = o;
  const cap = Math.min(b.length, o + maxLen);
  while (end < cap && (b[end] ?? 0) !== 0) end += 1;
  const raw = Array.from(b.subarray(o, end));
  let out = '';
  for (const byte of raw) {
    if (byte >= 32 && byte <= 126) out += String.fromCharCode(byte);
    else if (byte === 9 || byte === 10 || byte === 13) out += String.fromCharCode(byte);
    else out += '.';
  }
  return out;
}

function protToString(p: number): string {
  const r = (p & 1) !== 0;
  const w = (p & 2) !== 0;
  const x = (p & 4) !== 0;
  return (r ? 'r' : '-') + (w ? 'w' : '-') + (x ? 'x' : '-');
}

function formatVersion(v: number): string {
  return `${(v >> 16) & 0xff}.${(v >> 8) & 0xff}.${v & 0xff}`;
}

function fmtHex(v: number): string {
  return '0x' + v.toString(16);
}

function fmtDec(v: number): string {
  return v.toString(10);
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'summary');
    const maxRowsRaw = Number(opts.maxRows ?? 200);
    const maxRows =
      Number.isFinite(maxRowsRaw) && maxRowsRaw > 0
        ? Math.min(Math.floor(maxRowsRaw), MAX_ROWS)
        : 200;

    const file = input.files[0];
    if (!file)
      throw new ToolError(
        'Choose a Mach-O binary to inspect.',
        'Pick a .o, .dylib or executable file.',
      );
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 28) throw new ToolError('File is too short to be a Mach-O binary.');

    // Read the magic as little-endian; because the canonical magics are defined
    // in the file's native endianness, an LE read of a BE file yields the
    // byte-swapped (CIGAM) constant, which disambiguates endianness.
    const magic = readU32LE(buf, 0);
    let is64: boolean;
    let little: boolean;
    if (magic === MH_MAGIC_64) {
      is64 = true;
      little = true;
    } else if (magic === MH_CIGAM_64) {
      is64 = true;
      little = false;
    } else if (magic === MH_MAGIC_32) {
      is64 = false;
      little = true;
    } else if (magic === MH_CIGAM_32) {
      is64 = false;
      little = false;
    } else {
      throw new ToolError(
        'Not a Mach-O binary (bad magic).',
        'The first four bytes are not a Mach-O magic value.',
      );
    }

    // Read fields (always little-endian at byte 4+ because magic already
    // disambiguated endianness; byte-swapped magic means big-endian fields).
    const u32 = (o: number): number => (little ? readU32LE(buf, o) : readU32(buf, o));
    const u64 = (o: number): number =>
      little ? readU64LE(buf, o) : readU32(buf, o) * 4294967296 + readU32(buf, o + 4);

    const cputype = u32(4);
    const cpusubtype = u32(8);
    const filetype = u32(12);
    const ncmds = u32(16);
    const sizeofcmds = u32(20);
    const flags = u32(24);

    const headerEnd = is64 ? 32 : 28;
    const cmdsEnd = Math.min(buf.length, headerEnd + sizeofcmds);

    // Build shared summary rows.
    const summaryRows: string[][] = [
      ['File size', `${file.size} B`],
      ['Magic', fmtHex(magic) + (is64 ? ' (MH_MAGIC_64)' : ' (MH_MAGIC_32)')],
      ['Endianness', little ? 'Little (native)' : 'Big (byte-swapped)'],
      ['Word size', is64 ? '64-bit' : '32-bit'],
      ['CPU type', fmtHex(cputype) + ' (' + (CPUS[cputype] ?? 'unknown') + ')'],
      ['CPU subtype', fmtHex(cpusubtype)],
      ['File type', fmtHex(filetype) + ' (' + (FILETYPES[filetype] ?? 'unknown') + ')'],
      ['Load commands', fmtDec(ncmds)],
      ['Command bytes', fmtDec(sizeofcmds)],
      ['Flags', fmtHex(flags)],
    ];

    // Decode flag names.
    const flagNames: string[] = [];
    const flagList: Array<[number, string]> = [
      [MH_NOUNDEFS, 'NOUNDEFS'],
      [MH_DYLDLINK, 'DYLDLINK'],
      [MH_TWOLEVEL, 'TWOLEVEL'],
      [MH_PIE, 'PIE'],
      [MH_ALLOW_STACK_EXECUTION, 'ALLOW_STACK_EXECUTION'],
      [MH_NO_HEAP_EXECUTION, 'NO_HEAP_EXECUTION'],
    ];
    for (const [bit, name] of flagList) {
      if ((flags & bit) !== 0) flagNames.push(name);
    }
    if (flagNames.length > 0) {
      summaryRows.push(['Flag names', flagNames.join(' | ')]);
    }

    // Walk load commands.
    const commands: string[][] = [];
    const segments: Segment[] = [];
    const deps: string[][] = [];
    let platform = '';
    let minos = '';
    let sdk = '';
    let entryoff = 0;
    let symCount = 0;

    let o = headerEnd;
    for (let i = 0; i < ncmds && o + 8 <= cmdsEnd; i += 1) {
      const cmd = u32(o);
      const cmdsize = u32(o + 4);
      if (cmdsize < 8 || o + cmdsize > cmdsEnd) break;
      const body = o + 8;
      const name = cmdName(cmd);

      commands.push([fmtDec(i), fmtHex(cmd), name, fmtDec(cmdsize)]);

      if (cmd === LC_SEGMENT_64) {
        if (cmdsize >= 72) {
          const segname = readCString(buf, body, 16);
          const vmaddr = u64(body + 16);
          const vmsize = u64(body + 24);
          const fileoff = u64(body + 32);
          const filesize = u64(body + 40);
          const maxprot = u32(body + 48);
          const initprot = u32(body + 52);
          const nsects = u32(body + 56);
          segments.push({
            cmd: 'LC_SEGMENT_64',
            segname,
            vmaddr,
            vmsize,
            fileoff,
            filesize,
            nsects,
            maxprot: protToString(maxprot),
            initprot: protToString(initprot),
          });
        }
      } else if (cmd === LC_SEGMENT) {
        if (cmdsize >= 56) {
          const segname = readCString(buf, body, 16);
          const vmaddr = u32(body + 16);
          const vmsize = u32(body + 20);
          const fileoff = u32(body + 24);
          const filesize = u32(body + 28);
          const maxprot = u32(body + 36);
          const initprot = u32(body + 40);
          const nsects = u32(body + 44);
          segments.push({
            cmd: 'LC_SEGMENT',
            segname,
            vmaddr,
            vmsize,
            fileoff,
            filesize,
            nsects,
            maxprot: protToString(maxprot),
            initprot: protToString(initprot),
          });
        }
      } else if (cmd === LC_SYMTAB) {
        if (cmdsize >= 24) {
          const nsyms = u32(body + 4);
          const strsize = u32(body + 16);
          symCount = nsyms;
          commands.push(['', '', '  symbol count', fmtDec(nsyms)]);
          commands.push(['', '', '  string-table size', fmtDec(strsize)]);
        }
      } else if (cmd === LC_UUID) {
        if (cmdsize >= 24) {
          const uuidHex = Array.from(buf.subarray(body, body + 16))
            .map((b2) => b2.toString(16).padStart(2, '0'))
            .join('');
          const uuidFmt = `${uuidHex.slice(0, 8)}-${uuidHex.slice(8, 12)}-${uuidHex.slice(12, 16)}-${uuidHex.slice(16, 20)}-${uuidHex.slice(20)}`;
          commands.push(['', '', '  uuid', uuidFmt]);
        }
      } else if (cmd === LC_LOAD_DYLINKER || cmd === LC_LOAD_DYLIB || cmd === LC_ID_DYLIB) {
        if (cmdsize >= 12) {
          const nameOff = u32(body);
          const nm = readCString(buf, o + nameOff, cmdsize - nameOff);
          const kind =
            cmd === LC_LOAD_DYLINKER ? 'dylinker' : cmd === LC_ID_DYLIB ? 'id-dylib' : 'dylib';
          deps.push([kind, nm]);
          commands.push(['', '', `  ${kind}`, nm]);
        }
      } else if (cmd === LC_BUILD_VERSION) {
        if (cmdsize >= 24) {
          platform = PLATFORMS[u32(body)] ?? fmtHex(u32(body));
          minos = formatVersion(u32(body + 4));
          sdk = formatVersion(u32(body + 8));
          commands.push(['', '', '  platform', platform]);
          commands.push(['', '', '  min OS', minos]);
          commands.push(['', '', '  sdk', sdk]);
        }
      } else if (
        cmd === LC_VERSION_MIN_MACOSX ||
        cmd === LC_VERSION_MIN_IPHONEOS ||
        cmd === LC_VERSION_MIN_TVOS ||
        cmd === LC_VERSION_MIN_WATCHOS
      ) {
        if (cmdsize >= 16) {
          minos = formatVersion(u32(body));
          sdk = formatVersion(u32(body + 4));
        }
      } else if (cmd === LC_MAIN) {
        if (cmdsize >= 24) {
          entryoff = u64(body);
          commands.push(['', '', '  entry offset', fmtHex(entryoff)]);
        }
      } else if (cmd === LC_DYLD_INFO || cmd === LC_DYLD_INFO_ONLY) {
        commands.push(['', '', '  (export trie present)', '']);
      }

      o += cmdsize;
    }

    if (view === 'commands') {
      return renderTable(
        ['#', 'cmd', 'command', 'size'],
        commands.slice(0, maxRows),
        `Mach-O load commands (${ncmds})`,
      );
    }
    if (view === 'segments') {
      const rows = segments.map((s) => [
        s.cmd,
        s.segname,
        fmtHex(s.vmaddr),
        fmtDec(s.vmsize),
        fmtHex(s.fileoff),
        fmtDec(s.filesize),
        fmtDec(s.nsects),
        s.initprot,
        s.maxprot,
      ]);
      return renderTable(
        [
          'command',
          'segment',
          'vmaddr',
          'vmsize',
          'fileoff',
          'filesize',
          'sections',
          'init',
          'max',
        ],
        rows.slice(0, maxRows),
        `Mach-O segments (${segments.length})`,
      );
    }
    if (view === 'dependencies') {
      if (deps.length === 0) deps.push(['none', '(no dylib dependencies found)']);
      return renderTable(['kind', 'path'], deps.slice(0, maxRows), 'Mach-O dependencies');
    }
    if (view === 'build') {
      const buildRows: string[][] = [
        ['Platform', platform || '(none)'],
        ['Minimum OS', minos || '(none)'],
        ['SDK', sdk || '(none)'],
        ['Symbols', fmtDec(symCount)],
        ['Entry offset', entryoff !== 0 ? fmtHex(entryoff) : '(not set)'],
      ];
      return renderTable(['field', 'value'], buildRows, 'Mach-O build info');
    }

    // summary view
    const notes: string[] = [];
    if ((flags & MH_PIE) !== 0) notes.push('Position-independent executable (PIE).');
    if ((flags & MH_ALLOW_STACK_EXECUTION) !== 0)
      notes.push('Warning: stack is marked executable.');
    if (deps.length === 0) notes.push('No dynamic library dependencies found.');

    return renderTable(['field', 'value'], summaryRows, 'Mach-O summary');
  },
};

function cmdName(cmd: number): string {
  const names: Record<number, string> = {
    [LC_SEGMENT]: 'LC_SEGMENT',
    [LC_SYMTAB]: 'LC_SYMTAB',
    [LC_LOAD_DYLINKER]: 'LC_LOAD_DYLINKER',
    [LC_UUID]: 'LC_UUID',
    [LC_SEGMENT_64]: 'LC_SEGMENT_64',
    [LC_LOAD_DYLIB]: 'LC_LOAD_DYLIB',
    [LC_ID_DYLIB]: 'LC_ID_DYLIB',
    [LC_VERSION_MIN_MACOSX]: 'LC_VERSION_MIN_MACOSX',
    [LC_VERSION_MIN_IPHONEOS]: 'LC_VERSION_MIN_IPHONEOS',
    [LC_VERSION_MIN_WATCHOS]: 'LC_VERSION_MIN_WATCHOS',
    [LC_VERSION_MIN_TVOS]: 'LC_VERSION_MIN_TVOS',
    [LC_BUILD_VERSION]: 'LC_BUILD_VERSION',
    [LC_MAIN]: 'LC_MAIN',
    [LC_FUNCTION_STARTS]: 'LC_FUNCTION_STARTS',
    [LC_DATA_IN_CODE]: 'LC_DATA_IN_CODE',
    [LC_SOURCE_VERSION]: 'LC_SOURCE_VERSION',
    [LC_DYLD_INFO]: 'LC_DYLD_INFO',
    [LC_DYLD_INFO_ONLY]: 'LC_DYLD_INFO_ONLY',
  };
  return names[cmd] ?? 'LC_0x' + cmd.toString(16);
}

function renderTable(headers: string[], rows: string[][], title: string): FileRunResult {
  const output = JSON.stringify({ title, headers, rows });
  return { outputs: [], report: { output, render: 'table' }, stats: { rows: rows.length } };
}

export default tool;
