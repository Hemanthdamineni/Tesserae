import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './bmp-inspector.meta';

const MAX_BYTES = 128 * 1024 * 1024;

const COMPRESSION: Record<number, string> = {
  0: 'none (BI_RGB)',
  1: 'RLE8 (BI_RLE8)',
  2: 'RLE4 (BI_RLE4)',
  3: 'bitfields (BI_BITFIELDS)',
  4: 'JPEG (BI_JPEG)',
  5: 'PNG (BI_PNG)',
  6: 'alpha bitfields (BI_ALPHABITFIELDS)',
};

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  size: number;
  sig: string;
  sigOk: boolean;
  fileSize: number;
  reserved: number;
  pixelOffset: number;
  dibSize: number;
  width: number;
  height: number;
  planes: number;
  bpp: number;
  compression: number;
  compName: string;
  imageSize: number;
  xPpm: number;
  yPpm: number;
  colorsUsed: number;
  importantColors: number;
  paletteEntries: number;
  findings: Finding[];
}

function u16le(b: Uint8Array, off: number): number {
  return ((b[off] ?? 0) + (b[off + 1] ?? 0) * 256) >>> 0;
}

function u32le(b: Uint8Array, off: number): number {
  return (
    ((b[off] ?? 0) +
      (b[off + 1] ?? 0) * 256 +
      (b[off + 2] ?? 0) * 65536 +
      (b[off + 3] ?? 0) * 16777216) >>>
    0
  );
}

function i32le(b: Uint8Array, off: number): number {
  const u = u32le(b, off);
  return u > 0x7fffffff ? u - 0x100000000 : u;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  const sig =
    size >= 2 ? String.fromCharCode(data[0] ?? 0) + String.fromCharCode(data[1] ?? 0) : '';
  const sigOk = sig === 'BM';
  if (!sigOk) {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file does not begin with the BM signature byte pair.',
    });
  }
  const fileSize = size >= 6 ? u32le(data, 2) : 0;
  const reserved =
    size >= 10
      ? ((data[6] ?? 0) +
          (data[7] ?? 0) * 256 +
          (data[8] ?? 0) * 65536 +
          (data[9] ?? 0) * 16777216) >>>
        0
      : 0;
  const pixelOffset = size >= 14 ? u32le(data, 10) : 0;
  const dibSize = size >= 18 ? u32le(data, 14) : 0;
  const width = size >= 22 ? i32le(data, 18) : 0;
  const height = size >= 26 ? i32le(data, 22) : 0;
  const planes = size >= 28 ? u16le(data, 26) : 0;
  const bpp = size >= 30 ? u16le(data, 28) : 0;
  const compression = size >= 34 ? u32le(data, 30) : 0;
  const imageSize = size >= 38 ? u32le(data, 34) : 0;
  const xPpm = size >= 42 ? i32le(data, 38) : 0;
  const yPpm = size >= 46 ? i32le(data, 42) : 0;
  const colorsUsed = size >= 50 ? u32le(data, 46) : 0;
  const importantColors = size >= 54 ? u32le(data, 50) : 0;
  const compName = COMPRESSION[compression] ?? 'unknown (' + compression + ')';
  let paletteEntries = 0;
  if (bpp <= 8 && size >= 54) {
    paletteEntries = colorsUsed !== 0 ? colorsUsed : 1 << bpp;
  }
  if (pixelOffset > 0 && pixelOffset > size) {
    findings.push({
      severity: 'error',
      kind: 'offset',
      detail: 'The pixel-data offset ' + pixelOffset + ' lies beyond the ' + size + '-byte file.',
    });
  }
  if (imageSize > 0 && pixelOffset > 0 && pixelOffset + imageSize > size) {
    findings.push({
      severity: 'warn',
      kind: 'overrun',
      detail:
        'The declared image size overruns the file (' +
        (pixelOffset + imageSize) +
        ' > ' +
        size +
        ').',
    });
  }
  if (dibSize !== 40 && dibSize !== 12 && dibSize !== 0) {
    findings.push({
      severity: 'info',
      kind: 'dib',
      detail:
        'DIB header is ' +
        dibSize +
        ' bytes (common values are 12 for BITMAPCOREHEADER and 40 for BITMAPINFOHEADER).',
    });
  }
  if (paletteEntries > 0 && pixelOffset > 0 && pixelOffset < 14 + dibSize + paletteEntries * 4) {
    findings.push({
      severity: 'warn',
      kind: 'palette',
      detail:
        'The color table would overrun the pixel-data offset (' +
        (14 + dibSize + paletteEntries * 4) +
        ' > ' +
        pixelOffset +
        ').',
    });
  }
  if (planes !== 1) {
    findings.push({
      severity: 'warn',
      kind: 'planes',
      detail: 'The plane count is ' + planes + ' (expected 1).',
    });
  }
  if (findings.length === 0) {
    findings.push({ severity: 'info', kind: 'ok', detail: 'The BMP structure looks well-formed.' });
  }
  return {
    size,
    sig,
    sigOk,
    fileSize,
    reserved,
    pixelOffset,
    dibSize,
    width,
    height,
    planes,
    bpp,
    compression,
    compName,
    imageSize,
    xPpm,
    yPpm,
    colorsUsed,
    importantColors,
    paletteEntries,
    findings,
  };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError('Choose a BMP image to inspect.', 'Drop a .bmp file onto the tool.');
    if (file.size > MAX_BYTES)
      throw new ToolError('That BMP image is too large.', 'Use a file under 128 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'summary');
    let headers: string[];
    let rows: string[][];
    if (view === 'headers') {
      headers = ['Field', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Declared size', String(m.fileSize)],
        ['Reserved', String(m.reserved)],
        ['Pixel-data offset', String(m.pixelOffset)],
        ['DIB header size', String(m.dibSize)],
        ['Width', String(m.width)],
        ['Height', String(m.height)],
        ['Planes', String(m.planes)],
        ['Bits per pixel', String(m.bpp)],
        ['Compression', m.compName],
        ['Image size', String(m.imageSize)],
        ['X pixels/meter', String(m.xPpm)],
        ['Y pixels/meter', String(m.yPpm)],
        ['Colors used', String(m.colorsUsed)],
        ['Important colors', String(m.importantColors)],
        ['Palette entries', String(m.paletteEntries)],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Property', 'Value'];
      rows = [
        ['Format', m.sigOk ? 'Windows BMP' : 'NOT a BMP'],
        ['Dimensions', m.width + ' x ' + m.height + ' px'],
        ['Bit depth', String(m.bpp) + ' bpp'],
        ['Compression', m.compName],
        ['Palette', m.paletteEntries > 0 ? String(m.paletteEntries) + ' entries' : 'none'],
        ['Pixel-data offset', String(m.pixelOffset)],
        ['Image size', String(m.imageSize) + ' B'],
        ['Resolution', m.xPpm + ' x ' + m.yPpm + ' px/m'],
      ];
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(m.width + 'x' + m.height + ' ' + m.bpp + '-bit image.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
