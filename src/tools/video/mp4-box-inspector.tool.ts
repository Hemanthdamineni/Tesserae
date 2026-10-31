import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './mp4-box-inspector.meta';

const MAX_BYTES = 128 * 1024 * 1024;
const PARSE_MAX_DEPTH = 64;

/** ISO-BMFF box types that contain child boxes. */
const CONTAINERS = new Set([
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
  'moof',
  'traf',
  'edts',
  'dinf',
  'mvex',
  'meta',
  'udta',
  'iprp',
  'iref',
  'meco',
  'strk',
  'mfra',
  'skip',
  'free',
]);

interface Box {
  offset: number;
  depth: number;
  type: string;
  size: number;
  /** Header length: 8, 16 (extended 64-bit size), or 12 (uuid with user type). */
  hdr: number;
  /** True if this box is a container in the ISO spec. */
  isContainer: boolean;
  /** Human-readable decoding for common boxes. */
  detail: string;
  /** True if the declared size overruns the enclosing parent. */
  overrun: boolean;
  /** True if the declared size is smaller than its header. */
  undersize: boolean;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  data: Uint8Array;
  boxes: Box[];
  findings: Finding[];
}

function ascii4(b: Uint8Array, off: number): string {
  return String.fromCharCode(b[off] ?? 0, b[off + 1] ?? 0, b[off + 2] ?? 0, b[off + 3] ?? 0);
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

function latin1(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) s += String.fromCharCode(b[off + i] ?? 0);
  return s;
}

/** Read a top-level box header; returns [type, declaredSize, headerLength, userType] or null past EOF. */
function readHeader(
  data: Uint8Array,
  off: number,
  parentEnd: number,
): { type: string; size: number; hdr: number; userType: string } | null {
  if (off + 8 > data.length) return null;
  let size = u32(data, off);
  let type = ascii4(data, off + 4);
  let hdr = 8;
  let userType = '';
  if (size === 1) {
    if (off + 16 > data.length) return null;
    const hi = u32(data, off + 8);
    const lo = u32(data, off + 12);
    size = hi * 4294967296 + lo;
    hdr = 16;
    if (hi > 0x7fffffff) size = Number.MAX_SAFE_INTEGER;
  } else if (size === 0) {
    size = parentEnd - off;
  }
  if (type === 'uuid') {
    if (off + 8 > data.length) return null;
    // The 16-byte user type is part of the box content, not the header.
    hdr = 8;
  }
  return { type, size, hdr, userType };
}

/** Depth-first walk of the box tree, staying within each parent's bounds. */
function parseBoxes(data: Uint8Array, start: number, end: number, depth: number, out: Box[]): void {
  if (depth > PARSE_MAX_DEPTH) return;
  let off = start;
  while (off + 8 <= end && off + 8 <= data.length) {
    const header = readHeader(data, off, end);
    if (header === null) break;
    const overrun = header.size !== 0 && off + header.size > end;
    const undersize = header.size !== 0 && header.size < header.hdr;
    const boxEnd = header.size === 0 ? end : Math.min(off + header.size, data.length);
    out.push({
      offset: off,
      depth,
      type: header.type,
      size: header.size,
      hdr: header.hdr,
      isContainer: CONTAINERS.has(ascii4(data, off + 4)),
      detail: '',
      overrun,
      undersize,
    });
    if (header.size === 0 || overrun || undersize) {
      // Cannot recurse safely; stop this branch.
      return;
    }
    if (CONTAINERS.has(ascii4(data, off + 4))) {
      // meta is a full box: its children start after the version+flags word.
      const childStart = ascii4(data, off + 4) === 'meta' ? off + header.hdr + 4 : off + header.hdr;
      parseBoxes(data, childStart, boxEnd, depth + 1, out);
    }
    off = boxEnd;
  }
}

/** Decode a few common boxes into a short human string. */
function decodeBox(b: Box, data: Uint8Array): string {
  if (b.size < 8) return '';
  const body = b.offset + b.hdr;
  switch (b.type) {
    case 'ftyp': {
      const major = latin1(data, body, 4);
      const minor = u32(data, body + 4);
      const nBrands = Math.max(0, Math.floor((Math.min(b.size, b.hdr + 8) - 8) / 4));
      const brands: string[] = [];
      for (let i = 0; i < nBrands; i += 1) brands.push(latin1(data, body + 8 + i * 4, 4));
      return 'major ' + major + ' v' + minor + ' [' + brands.join(', ') + ']';
    }
    case 'mvhd': {
      if (b.size < b.hdr + 20) return '';
      const ver = data[body] ?? 0;
      if (ver === 0)
        return 'timescale ' + u32(data, body + 12) + ', duration ' + u32(data, body + 16);
      return (
        'timescale ' +
        u32(data, body + 20) +
        ', duration ' +
        (u32(data, body + 24) * 4294967296 + u32(data, body + 28))
      );
    }
    case 'tkhd': {
      if (b.size < b.hdr + 20) return '';
      const ver = data[body] ?? 0;
      const trackId = ver === 0 ? u32(data, body + 12) : u32(data, body + 20);
      return 'track id ' + trackId;
    }
    case 'hdlr': {
      const handler = latin1(data, body + 8, 4);
      return 'handler ' + handler;
    }
    case 'mdat':
      return (b.size === 0 ? 'to EOF' : b.size - b.hdr) + ' B media data';
    case 'moof':
      return 'movie fragment';
    case 'mfhd':
      return 'sequence ' + u32(data, body + 4);
    case 'stsd':
      return 'sample description';
    case 'stts':
      return 'time-to-sample';
    case 'stsc':
      return 'sample-to-chunk';
    case 'stsz':
      return 'sample sizes';
    case 'stco':
      return 'chunk offsets';
    case 'udta':
      return 'user data';
    case 'moov':
      return 'movie metadata';
    case 'uuid': {
      let hexu = '';
      for (let i = 0; i < 16; i += 1) hexu += (data[body + i] ?? 0).toString(16).padStart(2, '0');
      return 'user type ' + hexu;
    }
    default:
      return '';
  }
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const boxes: Box[] = [];
  parseBoxes(data, 0, data.length, 0, boxes);

  if (boxes.length === 0) {
    findings.push({
      severity: 'error',
      kind: 'parse',
      detail: 'No top-level box could be parsed from this file.',
    });
    return { data, boxes, findings };
  }
  // Decorate detail strings.
  for (const b of boxes) b.detail = decodeBox(b, data);

  const first = boxes[0];
  if (first === undefined || first.type !== 'ftyp') {
    findings.push({
      severity: 'error',
      kind: 'order',
      detail:
        'The first top-level box should be ftyp, but found ' + (first?.type ?? 'nothing') + '.',
    });
  }
  const hasMoov = boxes.some((b) => b.type === 'moov');
  const hasMdat = boxes.some((b) => b.type === 'mdat');
  if (!hasMoov)
    findings.push({
      severity: 'error',
      kind: 'moov',
      detail: 'No moov box was found; this is not a well-formed MP4.',
    });
  if (!hasMdat)
    findings.push({
      severity: 'warn',
      kind: 'mdat',
      detail: 'No mdat box was found; the file may be an empty shell or fragmented-only.',
    });
  for (const b of boxes) {
    if (b.overrun)
      findings.push({
        severity: 'error',
        kind: 'overrun',
        detail:
          'Box ' +
          b.type +
          ' at offset ' +
          b.offset +
          ' declares ' +
          b.size +
          ' bytes but overruns its parent.',
      });
    if (b.undersize)
      findings.push({
        severity: 'error',
        kind: 'undersize',
        detail: 'Box ' + b.type + ' at offset ' + b.offset + ' is smaller than its header.',
      });
    const raw = ascii4(data, b.offset + 4);
    if (!/^[ -~]{4}$/u.test(raw)) {
      findings.push({
        severity: 'warn',
        kind: 'type',
        detail: 'Box at offset ' + b.offset + ' has a non-printable type code.',
      });
    }
  }
  const top = boxes.filter((b) => b.depth === 0);
  const seen = new Set<string>();
  const dup = top.find((b) => (seen.has(b.type) ? true : (seen.add(b.type), false)));
  if (dup !== undefined) {
    findings.push({
      severity: 'warn',
      kind: 'duplicate',
      detail: 'Top-level box ' + dup.type + ' appears more than once.',
    });
  }
  if (findings.length === 0) {
    findings.push({ severity: 'info', kind: 'ok', detail: 'The box structure looks well-formed.' });
  }
  return { data, boxes, findings };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose an MP4/MOV file to inspect.',
        'Drop a .mp4, .mov or .m4a file onto the tool.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That video is too large.', 'Use a file under 128 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const model = buildModel(data);
    const view = String(options.view ?? 'boxes');
    const maxDepth = Math.max(1, Math.min(64, Number(options.maxDepth) || 20));
    let headers: string[];
    let rows: string[][];
    if (view === 'summary') {
      headers = ['Property', 'Value'];
      rows = [];
      const top = model.boxes.filter((b) => b.depth === 0);
      rows.push(['Total boxes', String(model.boxes.length)]);
      rows.push(['Top-level boxes', String(top.length)]);
      rows.push(['First box', model.boxes[0]?.type ?? 'none']);
      const containers = model.boxes.filter((b) => b.isContainer).length;
      rows.push(['Containers', String(containers)]);
      rows.push(['Leaves', String(model.boxes.length - containers)]);
      const maxDepthSeen = model.boxes.reduce((a, b) => Math.max(a, b.depth), 0) + 1;
      rows.push(['Max depth', String(maxDepthSeen)]);
      const depth0 = new Set<string>();
      for (const b of top) depth0.add(b.type);
      rows.push(['Top-level types', Array.from(depth0).join(', ')]);
      const moov = model.boxes.find((b) => b.type === 'moov');
      const mdat = model.boxes.find((b) => b.type === 'mdat');
      rows.push(['Moov present', moov === undefined ? 'no' : 'yes']);
      rows.push(['Mdat present', mdat === undefined ? 'no' : 'yes']);
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = model.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Offset', 'Depth', 'Type', 'Size', 'Header', 'Kind', 'Detail'];
      rows = model.boxes
        .filter((b) => b.depth <= maxDepth)
        .map((b) => [
          String(b.offset),
          String(b.depth),
          b.type,
          String(b.size),
          b.hdr === 8 ? 'normal' : b.hdr === 16 ? '64-bit' : 'uuid',
          b.isContainer ? 'container' : 'leaf',
          b.detail,
        ]);
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(
      model.boxes.length +
        ' box(es) parsed; top-level type ' +
        (model.boxes[0]?.type ?? 'none') +
        '.',
    );
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
