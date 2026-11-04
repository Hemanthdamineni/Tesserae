import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './icc-inspector.meta';

/**
 * ICC color-profile inspector.
 *
 * Parses the 128-byte ICC header (big-endian): profile size, CMM type, version,
 * device class, data color space, connection space (PCS), creation date, the
 * 'acsp' signature, platform, rendering intent, PCS illuminant greats and the
 * creator signature. It then reads the tag table (tag count plus entries of
 * signature, offset and size) and lists every tag. The expected values come
 * from the byte-exact fixture confirmed by the reference tool `file`(1) and an
 * independent ICC parser, never from this parser.
 */

const MAX_BYTES = (16 * 1024 * 1024) | 0;
const MAX_ROWS = 5000;

const CLASS_NAMES: Record<string, string> = {
  scnr: 'Input device (scanner)',
  mntr: 'Display device (monitor)',
  prtr: 'Output device (printer)',
  link: 'Device link',
  spac: 'Color space conversion',
  abst: 'Abstract',
  nmcl: 'Named color',
  crop: 'Colorant encoding',
  name: 'Named color',
  '2clr': 'Two-colorant',
  '3clr': 'Three-colorant',
  '4clr': 'Four-colorant',
  '5clr': 'Five-colorant',
  '6clr': 'Six-colorant',
  '7clr': 'Seven-colorant',
  '8clr': 'Eight-colorant',
  '9clr': 'Nine-colorant',
  Aclr: 'Ten-colorant',
  Bclr: 'Eleven-colorant',
  Cclr: 'Twelve-colorant',
  Dclr: 'Thirteen-colorant',
  Eclr: 'Fourteen-colorant',
  Fclr: 'Fifteen-colorant',
};

const INTENT_NAMES: Record<number, string> = {
  0: 'Perceptual',
  1: 'Media-relative colorimetric',
  2: 'Saturation',
  3: 'ICC-absolute colorimetric',
};

const TAG_NAMES: Record<string, string> = {
  desc: 'Profile description',
  wtpt: 'Media white point',
  bkpt: 'Media black point',
  rXYZ: 'Red matrix column',
  gXYZ: 'Green matrix column',
  bXYZ: 'Blue matrix column',
  rTRC: 'Red tone reproduction curve',
  gTRC: 'Green tone reproduction curve',
  bTRC: 'Blue tone reproduction curve',
  rclr: 'Red colorant',
  gclr: 'Green colorant',
  bclr: 'Blue colorant',
  kTRC: 'Gray tone reproduction curve',
  A2B0: 'A to B table 0',
  B2A0: 'B to A table 0',
  cprt: 'Copyright',
  tech: 'Technology',
  view: 'Viewing conditions',
  lumi: 'Luminance',
  dmnd: 'Device model description',
  dmdd: 'Device manufacturer description',
  vued: 'Viewing conditions description',
  vwid: 'Viewing conditions ID',
  chad: 'Chromatic adaptation',
  mdir: 'Metadata',
  ncpr: 'Named color 2',
};

interface TagEntry {
  sig: string;
  name: string;
  offset: number;
  size: number;
}

interface Model {
  size: number;
  cmm: string;
  version: string;
  className: string;
  space: string;
  pcs: string;
  date: string;
  acsp: boolean;
  platform: string;
  flags: number;
  manufacturer: string;
  model: string;
  intent: string;
  intentCode: number;
  illuminant: string;
  creator: string;
  tags: TagEntry[];
}

function u16(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
}

function u32(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] ?? 0) * 0x1000000 +
      (bytes[at + 1] ?? 0) * 0x10000 +
      (bytes[at + 2] ?? 0) * 0x100 +
      (bytes[at + 3] ?? 0)) >>>
    0
  );
}

function sig(bytes: Uint8Array, at: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = bytes[at + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function pad(s: string, n: number): string {
  while (s.length < n) s += ' ';
  return s;
}

function formatVersion(v: number): string {
  const major = (v >> 24) & 0xff;
  const minor = (v >> 16) & 0xff;
  const minorMain = (minor >> 4) & 0x0f;
  const minorBug = minor & 0x0f;
  const minorStr = minorMain + (minorBug > 0 ? '.' + minorBug : '');
  return major + '.' + minorStr;
}

function formatDate(bytes: Uint8Array, at: number): string {
  const y = u16(bytes, at);
  const mo = u16(bytes, at + 2);
  const d = u16(bytes, at + 4);
  const h = u16(bytes, at + 6);
  const mi = u16(bytes, at + 8);
  const s = u16(bytes, at + 10);
  if (y === 0) return 'not set';
  const mm = String(mo).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  const hh = String(h).padStart(2, '0');
  const min = String(mi).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return y + '-' + mm + '-' + dd + ' ' + hh + ':' + min + ':' + ss;
}

function formatXYZ(bytes: Uint8Array, at: number): string {
  const x = u32(bytes, at);
  const y = u32(bytes, at + 4);
  const z = u32(bytes, at + 8);
  const fx = (x / 65536).toFixed(2);
  return 'X=' + fx + ' Y=' + (y / 65536).toFixed(2) + ' Z=' + (z / 65536).toFixed(2);
}

function parseIcc(bytes: Uint8Array): Model {
  if (bytes.length < 128)
    throw new ToolError('That file is too short to be an ICC profile (at least 128 bytes).');
  if (sig(bytes, 36, 4) !== 'acsp') {
    throw new ToolError(
      'That file is not an ICC color profile.',
      'An ICC profile has the "acsp" signature at offset 36.',
    );
  }

  const size = u32(bytes, 0);
  const className = sig(bytes, 12, 4);
  const space = sig(bytes, 16, 4);
  const pcs = sig(bytes, 20, 4);
  const flags = u32(bytes, 44);
  const intentCode = u32(bytes, 64);

  const tags: TagEntry[] = [];
  if (bytes.length >= 132) {
    const count = u32(bytes, 128);
    const capped = Math.min(count, 1000);
    for (let i = 0; i < capped; i += 1) {
      const at = 132 + i * 12;
      if (at + 12 > bytes.length) break;
      const s = sig(bytes, at, 4);
      const off = u32(bytes, at + 4);
      const sz = u32(bytes, at + 8);
      tags.push({ sig: s, name: TAG_NAMES[s] ?? 'Unknown tag', offset: off, size: sz });
    }
  }

  return {
    size,
    cmm: sig(bytes, 4, 4),
    version: formatVersion(u32(bytes, 8)),
    className: CLASS_NAMES[className] ?? 'Device class ' + className,
    space: pad(space, 4).replace(/\./g, ' ').trim() || space,
    pcs: pad(pcs, 4).trim() || pcs,
    date: formatDate(bytes, 24),
    acsp: sig(bytes, 36, 4) === 'acsp',
    platform: sig(bytes, 40, 4).trim(),
    flags,
    manufacturer: sig(bytes, 48, 4),
    model: sig(bytes, 52, 4),
    intent: INTENT_NAMES[intentCode] ?? 'Unknown (' + intentCode + ')',
    intentCode,
    illuminant: formatXYZ(bytes, 68),
    creator: sig(bytes, 80, 4),
    tags,
  };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'ICC color profile'],
      ['Size', String(m.size) + ' bytes'],
      ['CMM type', m.cmm],
      ['Version', m.version],
      ['Device class', m.className],
      ['Data color space', m.space],
      ['Connection space (PCS)', m.pcs],
      ['Creation date', m.date],
      ['Platform', m.platform],
      ['Rendering intent', m.intent],
      ['PCS illuminant', m.illuminant],
      ['Manufacturer', m.manufacturer],
      ['Device model', m.model],
      ['Creator', m.creator],
      ['Tags', String(m.tags.length)],
    ],
  };
}

function tableHeader(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Size', String(m.size)],
      ['CMM type', m.cmm],
      ['Version', m.version],
      ['Device class', m.className],
      ['Data color space', m.space],
      ['Connection space', m.pcs],
      ['Creation date', m.date],
      ['acsp signature', m.acsp ? 'valid' : 'missing'],
      ['Platform', m.platform],
      ['Flags', '0x' + m.flags.toString(16)],
      ['Manufacturer', m.manufacturer],
      ['Device model', m.model],
      ['Rendering intent', m.intent + ' (' + m.intentCode + ')'],
      ['PCS illuminant', m.illuminant],
      ['Creator', m.creator],
    ],
  };
}

function tableTags(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.tags.slice(0, max) : [];
  return {
    headers: ['Tag', 'Name', 'Offset', 'Size'],
    rows: shown.map((t) => [t.sig, t.name, String(t.offset), String(t.size)]),
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(MAX_ROWS, Number(options.maxRows ?? 100) || 0));
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No file was provided.', 'Choose an ICC color profile to inspect.');
  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 16 MB.');

  const bytes = new Uint8Array(await source.arrayBuffer());
  const m = parseIcc(bytes);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'header':
      table = tableHeader(m);
      break;
    case 'tags':
      table = tableTags(m, maxRows);
      break;
    case 'summary':
    default:
      table = tableSummary(m);
  }

  return {
    outputs: [] as OutputFile[],
    report: { output: JSON.stringify(table), render: 'table' },
    notes: [
      'Version ' +
        m.version +
        ' profile, ' +
        m.tags.length +
        ' tag(s), ' +
        m.space +
        ' data space.',
    ],
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { tags: m.tags.length, size: m.size, intent: m.intentCode },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
