import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './psd-inspector.meta';

/**
 * PSD (Photoshop Document) inspector.
 *
 * Parses the 26-byte PSD header and the four sections that follow it. Expected
 * values in the tests come from the byte-exact fixture built by the Python
 * generator and an independent struct-level walk, never from this parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;

const COLOR_MODES: Record<number, string> = {
  0: 'Bitmap',
  1: 'Grayscale',
  2: 'Indexed',
  3: 'RGB',
  4: 'CMYK',
  7: 'Multichannel',
  8: 'Duotone',
  9: 'Lab',
};

const COMPRESSION: Record<number, string> = {
  0: 'Raw',
  1: 'RLE',
  2: 'Zip',
  3: 'Zip with prediction',
};

function u16le(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) + ((b[o + 1] ?? 0) << 8)) >>> 0;
}

function u32le(b: Uint8Array, o: number): number {
  return (u16le(b, o) + u16le(b, o + 2) * 65536) >>> 0;
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'summary');

    const file = input.files[0];
    if (!file)
      throw new ToolError('Choose a Photoshop PSD file to inspect.', 'Pick a .psd or .psb file.');
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 26) throw new ToolError('File is too short to be a PSD image.');

    const warnings: string[] = [];

    // ---- header ----
    const magic = String.fromCharCode(buf[0] ?? 0, buf[1] ?? 0, buf[2] ?? 0, buf[3] ?? 0);
    if (magic !== '8BPS') {
      throw new ToolError(
        'Not a Photoshop file (missing 8BPS signature).',
        'A PSD file must start with the bytes "8BPS".',
      );
    }
    const version = u16le(buf, 4);
    if (version !== 1 && version !== 2) {
      warnings.push('Unexpected PSD version ' + version + ' (expected 1 for PSD or 2 for PSB).');
    }
    const reserved = u16le(buf, 6) + u16le(buf, 8) + u16le(buf, 10);
    if (reserved !== 0) warnings.push('The six reserved header bytes are not all zero.');
    const channels = u16le(buf, 12);
    const height = u32le(buf, 14);
    const width = u32le(buf, 18);
    const depth = u16le(buf, 22);
    const colorMode = u16le(buf, 24);

    // ---- sections ----
    const colorModeLen = u32le(buf, 26);
    const imgResourcesLen = u32le(buf, 30);
    const layerMaskLen = u32le(buf, 34);
    let compression = -1;

    let o = 38;
    // image data compression is at the start of the image data section
    if (o + 2 <= buf.length) compression = u16le(buf, o);
    o += 2;

    if (colorMode === 0 && depth !== 1) warnings.push('Bitmap mode images should be 1-bit deep.');
    if (COLOR_MODES[colorMode] === undefined)
      warnings.push('Unsupported color mode ' + colorMode + '.');

    const sections: string[][] = [
      ['Color mode data', String(colorModeLen) + ' B'],
      ['Image resources', String(imgResourcesLen) + ' B'],
      ['Layer and mask', String(layerMaskLen) + ' B'],
    ];

    if (view === 'header') {
      const rows: string[][] = [
        ['Signature', magic],
        ['Version', String(version) + (version === 2 ? ' (PSB)' : version === 1 ? ' (PSD)' : '')],
        ['Channels', String(channels)],
        ['Height', String(height) + ' px'],
        ['Width', String(width) + ' px'],
        ['Depth', String(depth) + ' bit'],
        ['Color mode', String(colorMode) + ' (' + (COLOR_MODES[colorMode] ?? 'unknown') + ')'],
      ];
      return renderTable(['field', 'value'], rows, 'PSD header', undefined, warnings);
    }

    if (view === 'sections') {
      const rows = sections.concat([
        [
          'Image data compression',
          compression >= 0
            ? (COMPRESSION[compression] ?? 'unknown (' + compression + ')')
            : '(missing)',
        ],
      ]);
      return renderTable(['section', 'length'], rows, 'PSD sections', undefined, warnings);
    }

    // summary
    const expectedPixelBytes = channels * height * width * (depth / 8);
    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['Signature', magic],
      ['Version', String(version) + (version === 2 ? ' (PSB)' : version === 1 ? ' (PSD)' : '')],
      ['Dimensions', String(width) + ' x ' + String(height) + ' px'],
      ['Channels', String(channels)],
      ['Bit depth', String(depth) + ' bit'],
      ['Color mode', (COLOR_MODES[colorMode] ?? 'unknown') + ' (' + String(colorMode) + ')'],
      ['Color mode data', String(colorModeLen) + ' B'],
      ['Image resources', String(imgResourcesLen) + ' B'],
      ['Layer and mask', String(layerMaskLen) + ' B'],
      [
        'Image data compression',
        compression >= 0
          ? (COMPRESSION[compression] ?? 'unknown (' + compression + ')')
          : '(missing)',
      ],
      ['Expected pixel data', String(expectedPixelBytes) + ' B'],
    ];

    const notes: string[] = [];
    if (compression === 0 && expectedPixelBytes > 0 && buf.length - o === expectedPixelBytes) {
      notes.push('Raw image data matches the declared dimensions exactly.');
    }

    return renderTable(['field', 'value'], summary, 'PSD summary', notes, warnings);
  },
};

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
