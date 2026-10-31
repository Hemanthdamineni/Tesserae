import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './gif-inspector.meta';

const MAX_BYTES = 128 * 1024 * 1024;

interface Block {
  offset: number;
  kind: string;
  detail: string;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  size: number;
  signature: string;
  width: number;
  height: number;
  gctPresent: boolean;
  colorResolution: number;
  sortFlag: boolean;
  gctEntries: number;
  bgColor: number;
  aspectRatio: number;
  hasTrailer: boolean;
  frameCount: number;
  blocks: Block[];
  findings: Finding[];
}

function u16(b: Uint8Array, off: number): number {
  return ((b[off] ?? 0) + (b[off + 1] ?? 0) * 256) >>> 0;
}

function latin1(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) s += String.fromCharCode(b[off + i] ?? 0);
  return s;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  const signature = latin1(data, 0, 6);
  const sigOk = signature === 'GIF87a' || signature === 'GIF89a';
  if (!sigOk) {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file does not begin with a GIF87a/GIF89a signature.',
    });
  }
  const width = u16(data, 6);
  const height = u16(data, 8);
  const packed = data[10] ?? 0;
  const gctPresent = (packed & 0x80) !== 0;
  const colorResolution = ((packed >> 4) & 7) + 1;
  const sortFlag = (packed & 0x08) !== 0;
  const gctEntries = 1 << ((packed & 0x07) + 1);
  const bgColor = data[11] ?? 0;
  const aspectRatio = data[12] ?? 0;
  const blocks: Block[] = [];
  let i = 13;
  if (gctPresent) {
    i += gctEntries * 3;
  }
  let frameCount = 0;
  let hasTrailer = false;
  while (i < size) {
    const b = data[i] ?? 0;
    if (b === 0x3b) {
      blocks.push({ offset: i, kind: 'trailer', detail: '' });
      hasTrailer = true;
      i += 1;
      break;
    } else if (b === 0x21) {
      const extStart = i;
      const label = data[i + 1] ?? 0;
      i += 2;
      if (label === 0xf9) {
        // Graphic Control Extension: [block size 4][packed][delay2][trans][terminator]
        i += 1;
        const gcePacked = data[i] ?? 0;
        const delay = u16(data, i + 1);
        const trans = data[i + 3] ?? 0;
        const disposal = (gcePacked >> 2) & 7;
        blocks.push({
          offset: extStart,
          kind: 'graphic-control',
          detail:
            'disposal ' +
            disposal +
            ', delay ' +
            delay +
            'cs, transparent ' +
            (gcePacked & 1 ? 'yes' : 'no') +
            ' (index ' +
            trans +
            ')',
        });
        i += 5;
      } else if (label === 0xff) {
        // Application Extension: [block size 11][appid 8][appcode 3][subblocks...][0]
        const app = latin1(data, i + 1, 11);
        blocks.push({ offset: extStart, kind: 'application', detail: app.trim() });
        i += 12;
        while (i < size && (data[i] ?? 0) !== 0) {
          const subLen = data[i] ?? 0;
          i += 1 + subLen;
        }
        i += 1;
      } else if (label === 0xfe) {
        // Comment Extension
        blocks.push({ offset: i - 2, kind: 'comment', detail: '' });
        while (i < size && (data[i] ?? 0) !== 0) {
          const subLen = data[i] ?? 0;
          i += 1 + subLen;
        }
        i += 1;
      } else if (label === 0x01) {
        // Plain Text Extension
        blocks.push({ offset: i - 2, kind: 'plain-text', detail: '' });
        i += 13;
        while (i < size && (data[i] ?? 0) !== 0) {
          const subLen = data[i] ?? 0;
          i += 1 + subLen;
        }
        i += 1;
      } else {
        blocks.push({ offset: i - 2, kind: 'extension-' + label.toString(16), detail: '' });
        while (i < size && (data[i] ?? 0) !== 0) {
          const subLen = data[i] ?? 0;
          i += 1 + subLen;
        }
        i += 1;
      }
    } else if (b === 0x2c) {
      // Image Descriptor: [left2][top2][width2][height2][packed]
      const ix = u16(data, i + 1);
      const iy = u16(data, i + 3);
      const iw = u16(data, i + 5);
      const ih = u16(data, i + 7);
      const iPack = data[i + 9] ?? 0;
      const lct = (iPack & 0x80) !== 0;
      const interlaced = (iPack & 0x40) !== 0;
      if (iw === 0 || ih === 0) {
        findings.push({
          severity: 'warn',
          kind: 'zero-frame',
          detail: 'Frame at offset ' + i + ' declares a zero-size image (' + iw + 'x' + ih + ').',
        });
      }
      blocks.push({
        offset: i,
        kind: 'image',
        detail:
          ix +
          ',' +
          iy +
          ' ' +
          iw +
          'x' +
          ih +
          (lct ? ', local color table' : '') +
          (interlaced ? ', interlaced' : ''),
      });
      i += 10;
      if (lct) {
        i += (1 << ((iPack & 0x07) + 1)) * 3;
      }
      // LZW minimum code size + sub-blocks
      i += 1;
      while (i < size && (data[i] ?? 0) !== 0) {
        const subLen = data[i] ?? 0;
        i += 1 + subLen;
      }
      i += 1;
      frameCount += 1;
    } else {
      findings.push({
        severity: 'warn',
        kind: 'unexpected',
        detail: 'Unexpected byte 0x' + b.toString(16) + ' at offset ' + i + '.',
      });
      i += 1;
    }
  }
  if (!hasTrailer) {
    findings.push({
      severity: 'error',
      kind: 'trailer',
      detail: 'The GIF is missing its 0x3B trailer byte; the file may be truncated.',
    });
  }
  if (i > size) {
    findings.push({
      severity: 'error',
      kind: 'truncated',
      detail: 'A block overruns the end of the file.',
    });
  }
  if (findings.length === 0) {
    findings.push({ severity: 'info', kind: 'ok', detail: 'The GIF structure looks well-formed.' });
  }
  return {
    size,
    signature,
    width,
    height,
    gctPresent,
    colorResolution,
    sortFlag,
    gctEntries,
    bgColor,
    aspectRatio,
    hasTrailer,
    frameCount,
    blocks,
    findings,
  };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError('Choose a GIF file to inspect.', 'Drop a .gif file onto the tool.');
    if (file.size > MAX_BYTES)
      throw new ToolError('That GIF is too large.', 'Use a file under 128 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'blocks');
    let headers: string[];
    let rows: string[][];
    if (view === 'summary') {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Signature', m.signature],
        ['Canvas', m.width + ' x ' + m.height + ' px'],
        ['Global color table', m.gctPresent ? 'yes (' + m.gctEntries + ' entries)' : 'no'],
        ['Color resolution', m.colorResolution + ' bits'],
        ['Color table sort', m.sortFlag ? 'yes' : 'no'],
        ['Background color', String(m.bgColor)],
        ['Pixel aspect ratio', m.aspectRatio === 0 ? 'default' : String(m.aspectRatio)],
        ['Frames', String(m.frameCount)],
        ['Trailer', m.hasTrailer ? 'present' : 'MISSING'],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Offset', 'Block', 'Detail'];
      rows = m.blocks.map((b) => [String(b.offset), b.kind, b.detail]);
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(m.frameCount + ' frame(s), ' + m.blocks.length + ' block(s).');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
