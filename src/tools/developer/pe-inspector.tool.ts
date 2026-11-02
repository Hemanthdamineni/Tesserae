import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './pe-inspector.meta';

/**
 * Portable Executable (PE/COFF) inspector for Windows binaries.
 *
 * A PE file begins with a DOS header whose e_lfanew field points at the PE
 * signature, followed by a COFF file header, an optional header (PE32 or
 * PE32+) and a section table. All multi-byte fields are little-endian. The
 * expected values come from the byte-exact fixture built by the Python
 * encoder and confirmed by the reference tool `file`(1), never from this
 * parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_ROWS = 5000;

const MACHINES: Record<number, string> = {
  0x0: 'Unknown',
  0x14c: 'Intel 80386',
  0x8664: 'AMD x86-64',
  0x1c0: 'ARM',
  0xaa64: 'ARM64 (AArch64)',
  0x1c4: 'ARMv7 Thumb',
  0x166: 'RISC-V 32',
  0x506: 'RISC-V 64',
  0x5032: 'RISC-V 128',
  0x200: 'IA-64',
  0x1f0: 'PowerPC',
  0x1f1: 'PowerPC FP',
  0x268: 'M68K',
  0x9041: 'MIPS16',
  0x62: 'MIPS little',
  0x18c: 'Alpha AXP',
};

const SUBSYSTEMS: Record<number, string> = {
  0: 'Unknown',
  1: 'Native',
  2: 'Windows GUI',
  3: 'Windows console',
  5: 'OS/2 console',
  7: 'POSIX console',
  8: 'Native Windows 9x',
  9: 'Windows CE GUI',
  10: 'EFI application',
  11: 'EFI boot service driver',
  12: 'EFI runtime driver',
  14: 'XBox',
  16: 'XBox 360',
};

interface Section {
  name: string;
  virtualSize: number;
  virtualAddress: number;
  rawSize: number;
  rawPtr: number;
  characteristics: number;
}

interface Model {
  is64: boolean;
  machine: number;
  numSections: number;
  timestamp: number;
  characteristics: number;
  entry: number;
  imageBase: number;
  sectionAlign: number;
  fileAlign: number;
  sizeOfImage: number;
  subsystem: number;
  dllChars: number;
  dataDirectories: { rva: number; size: number }[];
  sections: Section[];
}

function parsePe(bytes: Uint8Array): Model {
  if (bytes.length < 64) throw new ToolError('That file is too short to be a PE binary.');
  if (bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
    throw new ToolError(
      'That file is not a Windows PE binary.',
      'A PE file starts with the DOS magic "MZ".',
    );
  }

  const e_lfanew = u32(bytes, 0x3c);
  if (e_lfanew + 4 > bytes.length)
    throw new ToolError('The DOS header points past the end of the file.');
  if (
    bytes[e_lfanew] !== 0x50 ||
    bytes[e_lfanew + 1] !== 0x45 ||
    bytes[e_lfanew + 2] !== 0 ||
    bytes[e_lfanew + 3] !== 0
  ) {
    throw new ToolError('Missing the "PE\\0\\0" signature at the DOS e_lfanew offset.');
  }

  const coff = e_lfanew + 4;
  if (coff + 20 > bytes.length) throw new ToolError('The COFF file header is truncated.');
  const machine = u16(bytes, coff);
  const numSections = u16(bytes, coff + 2);
  const timestamp = u32(bytes, coff + 4);
  const sizeOpt = u16(bytes, coff + 16);
  const characteristics = u16(bytes, coff + 18);

  const opt = coff + 20;
  if (opt + 2 > bytes.length) throw new ToolError('The optional header is truncated.');
  const magic = u16(bytes, opt);
  const is64 = magic === 0x20b;
  if (magic !== 0x10b && magic !== 0x20b) {
    throw new ToolError(
      'That PE file has an unsupported optional-header magic (0x' + magic.toString(16) + ').',
    );
  }

  const entry = u32(bytes, opt + 16);
  const imageBase = is64 ? u32(bytes, opt + 24) : u32(bytes, opt + 28);
  const sectionAlign = u32(bytes, opt + 32);
  const fileAlign = u32(bytes, opt + 36);
  const sizeOfImage = u32(bytes, opt + 56);
  const subsystem = u16(bytes, opt + 68);
  const dllChars = u16(bytes, opt + 70);

  const dirOffset = is64 ? 112 : 96;
  const numDirs = sizeOpt >= (is64 ? 128 : 112) ? u32(bytes, opt + (is64 ? 108 : 92)) : 0;
  const maxDirs = Math.max(0, Math.min(numDirs, 16));
  const dataDirectories: { rva: number; size: number }[] = [];
  for (let i = 0; i < maxDirs; i += 1) {
    const at = opt + dirOffset + i * 8;
    if (at + 8 > bytes.length) break;
    dataDirectories.push({ rva: u32(bytes, at), size: u32(bytes, at + 4) });
  }

  const secTable = opt + sizeOpt;
  const sections: Section[] = [];
  const secLimit = Math.min(numSections, 10000);
  for (let i = 0; i < secLimit; i += 1) {
    const at = secTable + i * 40;
    if (at + 40 > bytes.length) break;
    sections.push({
      name: cstr(bytes, at, 8),
      virtualSize: u32(bytes, at + 8),
      virtualAddress: u32(bytes, at + 12),
      rawSize: u32(bytes, at + 16),
      rawPtr: u32(bytes, at + 20),
      characteristics: u32(bytes, at + 36),
    });
  }

  return {
    is64,
    machine,
    numSections,
    timestamp,
    characteristics,
    entry,
    imageBase,
    sectionAlign,
    fileAlign,
    sizeOfImage,
    subsystem,
    dllChars,
    dataDirectories,
    sections,
  };
}

function u8(b: Uint8Array, at: number): number {
  return b[at] ?? 0;
}
function u16(b: Uint8Array, at: number): number {
  return (u8(b, at) | (u8(b, at + 1) << 8)) >>> 0;
}
function u32(b: Uint8Array, at: number): number {
  return (u8(b, at) | (u8(b, at + 1) << 8) | (u8(b, at + 2) << 16) | (u8(b, at + 3) << 24)) >>> 0;
}
function cstr(b: Uint8Array, at: number, len: number): string {
  let s = '';
  for (let i = at; i < at + len && i < b.length; i += 1) {
    const c = b[i] ?? 0;
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s === '' ? '(null)' : s;
}
function hex(n: number): string {
  return '0x' + n.toString(16);
}

const DIR_NAMES = [
  'export',
  'import',
  'resource',
  'exception',
  'security',
  'basereloc',
  'debug',
  'architecture',
  'globalptr',
  'tls',
  'loadconfig',
  'bound-import',
  'iat',
  'delay-import',
  'clr-runtime',
  'reserved',
];

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const present = m.dataDirectories.filter((d) => d.rva !== 0);
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', m.is64 ? 'PE32+ (64-bit)' : 'PE32 (32-bit)'],
      ['Machine', MACHINES[m.machine] ?? 'machine 0x' + m.machine.toString(16)],
      ['Sections', String(m.sections.length)],
      ['Timestamp', isoTime(m.timestamp)],
      ['Entry point', hex(m.entry)],
      ['Image base', hex(m.imageBase)],
      ['Size of image', hex(m.sizeOfImage)],
      ['Subsystem', SUBSYSTEMS[m.subsystem] ?? 'subsystem ' + m.subsystem],
      ['DLL characteristics', hex(m.dllChars)],
      ['Data directories', String(m.dataDirectories.length) + ' (' + present.length + ' present)'],
    ],
  };
}

function tableHeaders(m: Model): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [
    ['COFF machine', MACHINES[m.machine] ?? '0x' + m.machine.toString(16)],
    ['COFF number of sections', String(m.numSections)],
    ['COFF time/date stamp', isoTime(m.timestamp)],
    ['COFF characteristics', hex(m.characteristics) + sectionFlags(m.characteristics)],
    ['Optional magic', m.is64 ? '0x20b (PE32+)' : '0x10b (PE32)'],
    ['Address of entry point', hex(m.entry)],
    ['Image base', hex(m.imageBase)],
    ['Section alignment', hex(m.sectionAlign)],
    ['File alignment', hex(m.fileAlign)],
    ['Size of image', hex(m.sizeOfImage)],
    ['Subsystem', (SUBSYSTEMS[m.subsystem] ?? 'unknown') + ' (' + m.subsystem + ')'],
    ['DLL characteristics', hex(m.dllChars)],
  ];
  for (let i = 0; i < m.dataDirectories.length; i += 1) {
    const d = m.dataDirectories[i];
    if (!d) continue;
    rows.push([
      (DIR_NAMES[i] ?? 'directory ' + i) + ' directory',
      d.rva === 0 ? '(empty)' : hex(d.rva) + ' size ' + d.size,
    ]);
  }
  return { headers: ['Field', 'Value'], rows };
}

function tableSections(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.sections.slice(0, max) : [];
  return {
    headers: ['Name', 'Virtual size', 'Virtual addr', 'Raw size', 'Raw ptr', 'Flags'],
    rows: shown.map((s) => [
      s.name,
      hex(s.virtualSize),
      hex(s.virtualAddress),
      hex(s.rawSize),
      hex(s.rawPtr),
      sectionChars(s.characteristics),
    ]),
  };
}

function tableImports(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const imp = m.dataDirectories[1];
  if (!imp || imp.rva === 0) {
    return { headers: ['DLL', 'RVA'], rows: [['(none)', 'No import table present']] };
  }
  const rows: string[][] = [
    ['(import table at RVA ' + hex(imp.rva) + ')', String(imp.size) + ' bytes'],
  ];
  void max;
  return { headers: ['DLL', 'RVA'], rows };
}

function sectionChars(c: number): string {
  const flags: string[] = [];
  if (c & 0x00000020) flags.push('CODE');
  if (c & 0x00000040) flags.push('IDATA');
  if (c & 0x00000080) flags.push('UDATA');
  if (c & 0x00000800) flags.push('CNT_INITIALIZED');
  if (c & 0x02000000) flags.push('DISCARDABLE');
  if (c & 0x20000000) flags.push('EXECUTE');
  if (c & 0x40000000) flags.push('READ');
  if (c & 0x80000000) flags.push('WRITE');
  if (c & 0x10000000) flags.push('SHARED');
  return flags.join(' ') || '0x' + c.toString(16);
}

function sectionFlags(c: number): string {
  const flags: string[] = [];
  if (c & 0x0002) flags.push(' EXECUTABLE_IMAGE');
  if (c & 0x0020) flags.push(' LARGE_ADDRESS_AWARE');
  if (c & 0x0100) flags.push(' 32BIT_MACHINE');
  if (c & 0x2000) flags.push(' DLL');
  return flags.join('');
}

function isoTime(t: number): string {
  if (t === 0) return 'not set (0)';
  const d = new Date(t * 1000);
  if (isNaN(d.getTime())) return String(t);
  return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(MAX_ROWS, Number(options.maxRows ?? 100) || 0));
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No binary was provided.', 'Choose a Windows PE file to inspect.');
  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 256 MB.');

  const bytes = new Uint8Array(await source.arrayBuffer());
  const m = parsePe(bytes);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'headers':
      table = tableHeaders(m);
      break;
    case 'sections':
      table = tableSections(m, maxRows);
      break;
    case 'imports':
      table = tableImports(m, maxRows);
      break;
    case 'summary':
    default:
      table = tableSummary(m);
  }

  return {
    outputs: [] as OutputFile[],
    report: { output: JSON.stringify(table), render: 'table' },
    notes: [
      (m.is64 ? 'PE32+ ' : 'PE32 ') +
        (MACHINES[m.machine] ?? 'machine 0x' + m.machine.toString(16)) +
        ': ' +
        m.sections.length +
        ' sections, subsystem ' +
        m.subsystem +
        '.',
    ],
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { sections: m.sections.length, directories: m.dataDirectories.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
