import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './png-chunk-inspector.meta';

const MAX_BYTES = 32 * 1024 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface Chunk {
  offset: number;
  type: string;
  length: number;
  crcOk: boolean;
  data: Uint8Array;
  crc: number;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  data: Uint8Array;
  signatureOk: boolean;
  chunks: Chunk[];
  findings: Finding[];
  parseError: string | null;
}

/** CRC-32 (ISO 3309 / PNG spec), bitwise implementation. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** PNG computes the CRC over the chunk type followed by the chunk data. */
function crc32Two(a: Uint8Array, b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < a.length; i += 1) c = (c >>> 8) ^ (CRC_TABLE[(c ^ (a[i] ?? 0)) & 0xff] ?? 0);
  for (let i = 0; i < b.length; i += 1) c = (c >>> 8) ^ (CRC_TABLE[(c ^ (b[i] ?? 0)) & 0xff] ?? 0);
  return (c ^ 0xffffffff) >>> 0;
}

function ascii4(b: Uint8Array, off: number): string {
  return String.fromCharCode(b[off] ?? 0, b[off + 1] ?? 0, b[off + 2] ?? 0, b[off + 3] ?? 0);
}

/** Parse the chunk stream; does not throw on structural errors, records them as findings. */
function parseChunks(data: Uint8Array): {
  chunks: Chunk[];
  findings: Finding[];
  parseError: string | null;
} {
  const chunks: Chunk[] = [];
  const findings: Finding[] = [];
  let off = 8;
  if (!(
    data.length >= 12 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  )) {
    return {
      chunks,
      findings: [
        {
          severity: 'error',
          kind: 'signature',
          detail: 'The file does not begin with the PNG signature (89 50 4E 47 0D 0A 1A 0A).',
        },
      ],
      parseError: null,
    };
  }
  while (off + 12 <= data.length) {
    const len =
      ((data[off] ?? 0) * 16777216 +
        (data[off + 1] ?? 0) * 65536 +
        (data[off + 2] ?? 0) * 256 +
        (data[off + 3] ?? 0)) >>>
      0;
    const type = ascii4(data, off + 4);
    const crc =
      ((data[off + 8 + len] ?? 0) * 16777216 +
        (data[off + 9 + len] ?? 0) * 65536 +
        (data[off + 10 + len] ?? 0) * 256 +
        (data[off + 11 + len] ?? 0)) >>>
      0;
    if (off + 12 + len > data.length) {
      findings.push({
        severity: 'error',
        kind: 'truncated',
        detail:
          'Chunk ' +
          type +
          ' at offset ' +
          off +
          ' claims ' +
          len +
          ' bytes but the file ends before its CRC.',
      });
      return { chunks, findings, parseError: 'truncated' };
    }
    const chunkData = data.subarray(off + 8, off + 8 + len);
    const typeBytes = data.subarray(off + 4, off + 8);
    const crcOk = crc32Two(typeBytes, chunkData) === crc;
    chunks.push({ offset: off, type, length: len, crcOk, data: chunkData, crc });
    off += 12 + len;
  }
  if (off < data.length) {
    findings.push({
      severity: 'error',
      kind: 'trailing',
      detail: data.length - off + ' trailing byte(s) after the last complete chunk.',
    });
  }
  return { chunks, findings, parseError: null };
}

/** Read the fixed-width integer fields out of IHDR (13 bytes). */
function parseIhdr(c: Chunk): {
  w: number;
  h: number;
  depth: number;
  color: number;
  comp: number;
  filter: number;
  interlace: number;
} {
  const d = c.data;
  const u32 = (o: number): number =>
    ((d[o] ?? 0) * 16777216 + (d[o + 1] ?? 0) * 65536 + (d[o + 2] ?? 0) * 256 + (d[o + 3] ?? 0)) >>>
    0;
  return {
    w: u32(0),
    h: u32(4),
    depth: d[8] ?? 0,
    color: d[9] ?? 0,
    comp: d[10] ?? 0,
    filter: d[11] ?? 0,
    interlace: d[12] ?? 0,
  };
}
const COLOR_TYPES: Record<number, string> = {
  0: 'grayscale',
  2: 'truecolor',
  3: 'indexed',
  4: 'grayscale + alpha',
  6: 'truecolor + alpha',
};

/** Samples per pixel for a PNG color type. */
function channelsOf(color: number): number {
  if (color === 0) return 1;
  if (color === 2) return 3;
  if (color === 3) return 1;
  if (color === 4) return 2;
  if (color === 6) return 4;
  return 0;
}

/** Bit depth / color type combinations the PNG spec allows. */
function depthAllowed(color: number, depth: number): boolean {
  if (color === 0) return depth === 1 || depth === 2 || depth === 4 || depth === 8 || depth === 16;
  if (color === 2) return depth === 8 || depth === 16;
  if (color === 3) return depth === 1 || depth === 2 || depth === 4 || depth === 8;
  if (color === 4) return depth === 8 || depth === 16;
  if (color === 6) return depth === 8 || depth === 16;
  return false;
}

/** Adam7 pass geometry: [xStart, yStart, xStep, yStep]. */
const ADAM7: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

function ceilDiv(a: number, b: number): number {
  return Math.ceil(a / b);
}

interface Ihdr {
  w: number;
  h: number;
  depth: number;
  color: number;
  comp: number;
  filter: number;
  interlace: number;
}

/** Size of the decompressed scanline stream, including Adam7 interlacing. */
function expectedRawSize(ih: Ihdr, channels: number): number | null {
  if (ih.w <= 0 || ih.h <= 0 || channels === 0) return null;
  const bitsPerPixel = channels * ih.depth;
  const rowBytes = (w: number): number => Math.ceil((w * bitsPerPixel) / 8);
  if (ih.interlace === 1) {
    let total = 0;
    for (const pass of ADAM7) {
      const x0 = pass[0];
      const y0 = pass[1];
      const dx = pass[2];
      const dy = pass[3];
      const pw = ceilDiv(ih.w - x0, dx);
      const ph = ceilDiv(ih.h - y0, dy);
      if (pw <= 0 || ph <= 0) continue;
      total += ph * (1 + rowBytes(pw));
    }
    return total;
  }
  const rows = ceilDiv(ih.h, 1);
  return rows * (1 + rowBytes(ih.w));
}

function latin1(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 1) s += String.fromCharCode(b[i] ?? 0);
  return s;
}

function u32(b: Uint8Array, o: number): number {
  return (
    ((b[o] ?? 0) * 16777216 + (b[o + 1] ?? 0) * 65536 + (b[o + 2] ?? 0) * 256 + (b[o + 3] ?? 0)) >>>
    0
  );
}

function u16(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) * 256 + (b[o + 1] ?? 0)) >>> 0;
}

/** Case-derived chunk properties from the four-letter type code. */
function classOf(type: string): string {
  const c0 = type.charCodeAt(0);
  const c1 = type.charCodeAt(1);
  const c2 = type.charCodeAt(2);
  const c3 = type.charCodeAt(3);
  const parts = [(c0 & 0x20) !== 0 ? 'ancillary' : 'critical'];
  if ((c1 & 0x20) !== 0) parts.push('private');
  if ((c2 & 0x20) !== 0) parts.push('reserved-bit-set');
  parts.push((c3 & 0x20) !== 0 ? 'unsafe-to-copy' : 'safe-to-copy');
  return parts.join(', ');
}

function isCritical(type: string): boolean {
  return (type.charCodeAt(0) & 0x20) === 0;
}

const SRGB_INTENT = ['perceptual', 'relative colorimetric', 'saturation', 'absolute colorimetric'];

/** Human-readable detail for a chunk, decoded from its own bytes. */
function describeChunk(c: Chunk, ih: Ihdr | null): string {
  const d = c.data;
  switch (c.type) {
    case 'IHDR':
      if (ih === null) return '';
      return (
        ih.w +
        ' x ' +
        ih.h +
        ' px, ' +
        ih.depth +
        '-bit ' +
        (COLOR_TYPES[ih.color] ?? 'unknown color type') +
        ', ' +
        (ih.interlace === 1 ? 'Adam7 interlaced' : 'no interlace')
      );
    case 'PLTE':
      return d.length / 3 + ' palette entries';
    case 'tRNS': {
      if (ih !== null && ih.color === 3) return d.length + ' alpha entries for the palette';
      if (ih !== null && ih.color === 0) return 'transparent gray level ' + u16(d, 0);
      if (ih !== null && ih.color === 2)
        return 'transparent RGB ' + u16(d, 0) + ',' + u16(d, 2) + ',' + u16(d, 4);
      return d.length + ' bytes';
    }
    case 'pHYs':
      return (
        u32(d, 0) +
        ' x ' +
        u32(d, 4) +
        ' px per unit, ' +
        ((d[8] ?? 0) === 1 ? 'metre' : 'unknown unit')
      );
    case 'gAMA': {
      const g = u32(d, 0);
      return g === 0 ? 'gamma 0' : 'gamma ' + (100000 / g).toFixed(3) + ' (raw ' + g + ')';
    }
    case 'sRGB':
      return 'rendering intent: ' + (SRGB_INTENT[d[0] ?? 0] ?? 'unknown');
    case 'tIME':
      return (
        u16(d, 0) +
        '-' +
        String(d[2] ?? 0).padStart(2, '0') +
        '-' +
        String(d[3] ?? 0).padStart(2, '0') +
        ' ' +
        String(d[4] ?? 0).padStart(2, '0') +
        ':' +
        String(d[5] ?? 0).padStart(2, '0') +
        ':' +
        String(d[6] ?? 0).padStart(2, '0') +
        ' UTC'
      );
    case 'IDAT':
      return 'compressed ' + d.length + ' B';
    case 'iCCP': {
      const nul = d.indexOf(0);
      return nul > 0 ? 'profile "' + latin1(d.subarray(0, nul)) + '"' : 'embedded ICC profile';
    }
    case 'eXIf':
      return d.length + ' B EXIF payload';
    case 'acTL':
      return u32(d, 0) + ' animation frame(s), ' + u32(d, 4) + ' loop(s)';
    case 'fcTL':
      return (
        'frame ' +
        u32(d, 0) +
        ': ' +
        u32(d, 4) +
        ' x ' +
        u32(d, 8) +
        ' at ' +
        u32(d, 12) +
        ',' +
        u32(d, 16) +
        ', delay ' +
        u16(d, 20) +
        '/' +
        u16(d, 22)
      );
    case 'fdAT':
      return 'frame data for sequence ' + u32(d, 0);
    case 'sBIT':
      return d.length + ' significant-bit byte(s)';
    case 'bKGD':
      return 'suggested background';
    default:
      return '';
  }
}
/** Concatenate the IDAT payloads and inflate them on-device via DecompressionStream. */
async function inflateIdat(chunks: Chunk[]): Promise<Uint8Array | null> {
  const idat = chunks.filter((c) => c.type === 'IDAT');
  if (idat.length === 0) return null;
  const blob = new Blob(idat.map((c) => c.data as BlobPart));
  try {
    const ds = new DecompressionStream('deflate');
    const stream = blob.stream().pipeThrough(ds);
    const reader = stream.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    let done = false;
    while (!done) {
      const r = await reader.read();
      done = r.done === true;
      if (!r.done && r.value !== undefined) {
        parts.push(r.value);
        total += r.value.length;
      }
    }
    const out = new Uint8Array(total);
    let o = 0;
    for (const part of parts) {
      out.set(part, o);
      o += part.length;
    }
    return out;
  } catch {
    return null;
  }
}

function collectFindings(
  m: Model,
  ih: Ihdr | null,
  channels: number,
  decompressed: Uint8Array | null,
): Finding[] {
  const f: Finding[] = [];
  if (m.chunks.length === 0) {
    f.push({ severity: 'error', kind: 'no-chunks', detail: 'No chunks were found in the file.' });
    return f;
  }
  const first = m.chunks[0];
  if (first === undefined || first.type !== 'IHDR') {
    f.push({
      severity: 'error',
      kind: 'order',
      detail:
        'IHDR must be the first chunk, but found ' +
        (first?.type ?? 'nothing') +
        ' at offset ' +
        (first?.offset ?? 0) +
        '.',
    });
  }
  const ihdrChunks = m.chunks.filter((c) => c.type === 'IHDR');
  if (ihdrChunks.length === 0) {
    f.push({ severity: 'error', kind: 'ihdr', detail: 'The file has no IHDR chunk.' });
  } else if (ihdrChunks.length > 1) {
    f.push({
      severity: 'error',
      kind: 'ihdr',
      detail: 'Found ' + ihdrChunks.length + ' IHDR chunks; exactly one is required.',
    });
  }
  if (ih !== null) {
    if (ih.w < 1 || ih.h < 1)
      f.push({
        severity: 'error',
        kind: 'dimensions',
        detail: 'Width and height must both be at least 1 pixel, got ' + ih.w + ' x ' + ih.h + '.',
      });
    if (ih.comp !== 0)
      f.push({
        severity: 'error',
        kind: 'compression',
        detail: 'Compression method must be 0, got ' + ih.comp + '.',
      });
    if (ih.filter !== 0)
      f.push({
        severity: 'error',
        kind: 'filter',
        detail: 'Filter method must be 0, got ' + ih.filter + '.',
      });
    if (ih.interlace !== 0 && ih.interlace !== 1)
      f.push({
        severity: 'error',
        kind: 'interlace',
        detail: 'Interlace method must be 0 or 1, got ' + ih.interlace + '.',
      });
    if (ih.color === 3 && !m.chunks.some((c) => c.type === 'PLTE')) {
      f.push({
        severity: 'error',
        kind: 'plte',
        detail: 'Indexed color (color type 3) requires a PLTE chunk.',
      });
    }
    if (channels === 0) {
      f.push({
        severity: 'error',
        kind: 'color',
        detail: 'Color type ' + ih.color + ' is not a valid PNG color type.',
      });
    } else if (!depthAllowed(ih.color, ih.depth)) {
      f.push({
        severity: 'error',
        kind: 'depth',
        detail:
          'Bit depth ' +
          ih.depth +
          ' is not allowed for color type ' +
          ih.color +
          ' (' +
          (COLOR_TYPES[ih.color] ?? '?') +
          ').',
      });
    }
  }
  const idats = m.chunks.filter((c) => c.type === 'IDAT');
  if (idats.length === 0) {
    f.push({ severity: 'error', kind: 'idat', detail: 'The file has no IDAT chunk.' });
  } else {
    const firstIdx = m.chunks.findIndex((c) => c.type === 'IDAT');
    const lastIdx = m.chunks.findLastIndex((c) => c.type === 'IDAT');
    for (let i = firstIdx; i <= lastIdx; i += 1) {
      const c = m.chunks[i];
      if (c !== undefined && c.type !== 'IDAT') {
        f.push({
          severity: 'error',
          kind: 'idat-order',
          detail:
            'IDAT chunks must be consecutive, but ' +
            c.type +
            ' appears between them at offset ' +
            c.offset +
            '.',
        });
      }
    }
    const expected = ih === null ? null : expectedRawSize(ih, channels);
    if (decompressed !== null) {
      if (expected !== null && decompressed.length !== expected) {
        f.push({
          severity: 'error',
          kind: 'size',
          detail:
            'Decompressed data is ' +
            decompressed.length +
            ' B but the header implies ' +
            expected +
            ' B.',
        });
      }
    } else {
      f.push({
        severity: 'warn',
        kind: 'inflate',
        detail:
          'The IDAT stream could not be inflated; the pixel data may be corrupt or the payload too large to decompress here.',
      });
    }
  }
  const last = m.chunks[m.chunks.length - 1];
  if (last === undefined || last.type !== 'IEND') {
    f.push({
      severity: 'error',
      kind: 'iend',
      detail: 'The last chunk must be IEND, but found ' + (last?.type ?? 'nothing') + '.',
    });
  }
  if (m.signatureOk === false) {
    f.push({
      severity: 'error',
      kind: 'signature',
      detail: 'The file does not begin with the PNG signature.',
    });
  }
  const badCrc = m.chunks.filter((c) => !c.crcOk);
  if (badCrc.length > 0) {
    f.push({
      severity: 'error',
      kind: 'crc',
      detail:
        badCrc.length +
        ' chunk(s) have a CRC-32 mismatch: ' +
        badCrc.map((c) => c.type).join(', ') +
        '.',
    });
  }
  for (const c of m.chunks) {
    if (!/^[A-Za-z]{4}$/u.test(c.type)) {
      f.push({
        severity: 'error',
        kind: 'type',
        detail: 'Chunk at offset ' + c.offset + ' has a non-letter type "' + c.type + '".',
      });
    } else if (isCritical(c.type) && c.length === 0 && c.type !== 'IEND') {
      f.push({
        severity: 'error',
        kind: 'empty-critical',
        detail: 'Critical chunk ' + c.type + ' at offset ' + c.offset + ' is empty.',
      });
    } else if (!isCritical(c.type) && (c.type.charCodeAt(2) & 0x20) === 0) {
      f.push({
        severity: 'warn',
        kind: 'reserved',
        detail: 'Ancillary chunk ' + c.type + ' has the reserved third letter bit set.',
      });
    }
    if (c.length > MAX_BYTES && c.type === 'IDAT') {
      f.push({
        severity: 'warn',
        kind: 'large',
        detail: 'IDAT chunk at offset ' + c.offset + ' is ' + c.length + ' B.',
      });
    }
  }
  if (f.length === 0) {
    f.push({ severity: 'info', kind: 'ok', detail: 'The PNG structure is well-formed.' });
  }
  return f;
}

function buildModel(data: Uint8Array): Model {
  const sigOk = data.length >= 8 && PNG_SIGNATURE.every((b, i) => (data[i] ?? 0) === b);
  const p = parseChunks(data);
  return {
    data,
    signatureOk: sigOk,
    chunks: p.chunks,
    findings: p.findings,
    parseError: p.parseError,
  };
}

interface Tables {
  chunks: { headers: string[]; rows: string[][] };
  summary: { headers: string[]; rows: string[][] };
  findings: { headers: string[]; rows: string[][] };
}

function buildTables(m: Model, decompressed: Uint8Array | null): Tables {
  const ihdr = m.chunks.find((c) => c.type === 'IHDR');
  const ih = ihdr === undefined ? null : parseIhdr(ihdr);
  const channels = ih === null ? 0 : channelsOf(ih.color);
  const chunksRows: string[][] = m.chunks.map((c) => [
    String(c.offset),
    c.type,
    String(c.length),
    c.crcOk ? 'ok' : 'MISMATCH',
    classOf(c.type),
    describeChunk(c, ih),
  ]);
  const chunks = {
    headers: ['Offset', 'Type', 'Length', 'CRC-32', 'Class', 'Detail'],
    rows: chunksRows,
  };

  const sRows: string[][] = [];
  sRows.push(['PNG signature', m.signatureOk ? 'valid' : 'missing or wrong']);
  sRows.push(['Total chunks', String(m.chunks.length)]);
  if (ih !== null) {
    sRows.push(['Dimensions', ih.w + ' x ' + ih.h + ' px']);
    sRows.push(['Bit depth', String(ih.depth) + ' bit']);
    sRows.push(['Color type', ih.color + ' (' + (COLOR_TYPES[ih.color] ?? 'unknown') + ')']);
    sRows.push([
      'Interlace',
      ih.interlace === 1 ? 'Adam7' : ih.interlace === 0 ? 'none' : 'invalid (' + ih.interlace + ')',
    ]);
    const expected = expectedRawSize(ih, channels);
    sRows.push(['Expected raw pixels', expected === null ? 'n/a' : String(expected) + ' B']);
    if (decompressed !== null)
      sRows.push(['Decompressed data', String(decompressed.length) + ' B']);
    if (ih.color === 3)
      sRows.push([
        'Palette entries',
        String(
          m.chunks.filter((c) => c.type === 'PLTE').reduce((a, c) => a + c.data.length / 3, 0),
        ),
      ]);
  }
  const summary = { headers: ['Property', 'Value'], rows: sRows };

  const fRows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
  if (fRows.length === 0) fRows.push(['info', 'ok', 'No problems found.']);
  const findings = { headers: ['Severity', 'Kind', 'Detail'], rows: fRows };
  return { chunks, summary, findings };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError('Choose a PNG file to inspect.', 'Drop a .png file onto the tool.');
    if (file.size > MAX_BYTES)
      throw new ToolError('That PNG is too large.', 'Use a file under 32 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const decompressed = await inflateIdat(m.chunks);
    const ihdr = m.chunks.find((c) => c.type === 'IHDR');
    const ih = ihdr === undefined ? null : parseIhdr(ihdr);
    const channels = ih === null ? 0 : channelsOf(ih.color);
    m.findings = m.findings.concat(collectFindings(m, ih, channels, decompressed));
    const t = buildTables(m, decompressed);
    const view = String(options.view ?? 'chunks');
    const report = view === 'summary' ? t.summary : view === 'findings' ? t.findings : t.chunks;
    const notes: string[] = [];
    if (ih !== null) {
      notes.push(
        ih.w +
          ' x ' +
          ih.h +
          ' px, ' +
          ih.depth +
          '-bit ' +
          (COLOR_TYPES[ih.color] ?? 'color type ' + ih.color) +
          (ih.interlace === 1 ? ', Adam7 interlaced' : '') +
          '.',
      );
    }
    notes.push(
      m.chunks.filter((c) => c.type === 'IDAT').length +
        ' IDAT chunk(s); CRC is computed over chunk type plus data (PNG spec).',
    );
    return {
      outputs: [],
      report: { output: JSON.stringify(report), render: 'table' },
      notes,
      warnings: [],
    };
  },
};

export default tool;
