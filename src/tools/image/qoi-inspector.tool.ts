import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './qoi-inspector.meta';

/**
 * QOI (Quite OK Image) inspector.
 *
 * A QOI file is a 14-byte big-endian header followed by a stream of pixel
 * opcodes and an 8-byte end marker (all zeros and a trailing 0x01). Expected
 * values in the tests come from the byte-exact fixture built by the Python
 * encoder and confirmed by the `file`(1) reference tool ("QOI image data
 * 2x2"), never from this parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_OPCODES = 2000000;

const OPCODE_NAMES: Record<string, string> = {
  RGB: 'QOI_OP_RGB',
  RGBA: 'QOI_OP_RGBA',
  INDEX: 'QOI_OP_INDEX',
  DIFF: 'QOI_OP_DIFF',
  LUMA: 'QOI_OP_LUMA',
  RUN: 'QOI_OP_RUN',
};

function u32be(b: Uint8Array, o: number): number {
  return (
    ((((b[o] ?? 0) * 256 + (b[o + 1] ?? 0)) * 256 + (b[o + 2] ?? 0)) * 256 + (b[o + 3] ?? 0)) >>> 0
  );
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'summary');

    const file = input.files[0];
    if (!file) throw new ToolError('Choose a QOI image file to inspect.', 'Pick a .qoi file.');
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 22)
      throw new ToolError(
        'File is too short to be a QOI image (needs a 14-byte header and an 8-byte end marker).',
      );

    const warnings: string[] = [];

    // ---- header ----
    const magic = String.fromCharCode(buf[0] ?? 0, buf[1] ?? 0, buf[2] ?? 0, buf[3] ?? 0);
    if (magic !== 'qoif') {
      throw new ToolError(
        'Not a QOI image (missing qoif magic).',
        'A QOI file must start with the bytes "qoif".',
      );
    }
    const width = u32be(buf, 4);
    const height = u32be(buf, 8);
    const channels = buf[12] ?? 0;
    const colorspace = buf[13] ?? 0;

    if (width === 0) warnings.push('The image width is zero.');
    if (height === 0) warnings.push('The image height is zero.');
    if (channels !== 3 && channels !== 4)
      warnings.push(
        'Unsupported channel count ' + channels + ' (expected 3 for RGB or 4 for RGBA).',
      );

    const pixelCount = width * height;

    // ---- walk the opcode stream up to the end marker ----
    let o = 14;
    let decodedPixels = 0;
    const hist = new Map<string, number>();
    const opcodeRows: string[][] = [];
    let foundEnd = false;
    let guard = 0;
    while (o + 1 <= buf.length && guard++ < MAX_OPCODES) {
      // detect the 8-byte end marker: all zeros then 0x01
      if (
        o + 8 <= buf.length &&
        buf[o] === 0 &&
        buf[o + 1] === 0 &&
        buf[o + 2] === 0 &&
        buf[o + 3] === 0 &&
        buf[o + 4] === 0 &&
        buf[o + 5] === 0 &&
        buf[o + 6] === 0 &&
        buf[o + 7] === 1
      ) {
        foundEnd = true;
        o += 8;
        break;
      }
      const b = buf[o] ?? 0;
      const tag = b >> 6;
      let name = '';
      let size = 1;
      let emits = 1;
      if (b === 0xfe) {
        name = 'RGB';
        size = 4;
      } else if (b === 0xff) {
        name = 'RGBA';
        size = 5;
      } else if (tag === 0) {
        name = 'INDEX';
      } else if (tag === 1) {
        name = 'DIFF';
      } else if (tag === 2) {
        name = 'LUMA';
        size = 2;
      } else {
        name = 'RUN';
        emits = (b & 0x3f) + 1;
      }
      if (o + size > buf.length) {
        warnings.push(
          'Opcode ' + name + ' at offset ' + o + ' is truncated by the end of the file.',
        );
        break;
      }
      decodedPixels += emits;
      hist.set(name, (hist.get(name) ?? 0) + 1);
      if (view === 'opcodes' && opcodeRows.length < 2000) {
        opcodeRows.push([
          String(o),
          OPCODE_NAMES[name] ?? name,
          String(size) + ' B',
          String(emits),
        ]);
      }
      o += size;
    }

    if (!foundEnd) {
      warnings.push('The QOI end marker (00 00 00 00 00 00 00 01) was not found.');
    }
    if (o < buf.length) {
      warnings.push('Trailing bytes after the QOI end marker at offset ' + o + '.');
    }

    const dataBytes = buf.length - 22;

    // ---- views ----
    if (view === 'opcodes') {
      const rows = opcodeRows;
      return renderTable(
        ['offset', 'opcode', 'size', 'pixels emitted'],
        rows,
        'QOI pixel opcodes',
        undefined,
        warnings,
      );
    }

    if (view === 'header') {
      const rows: string[][] = [
        ['Signature', magic],
        ['Width', String(width) + ' px'],
        ['Height', String(height) + ' px'],
        [
          'Channels',
          String(channels) + (channels === 3 ? ' (RGB)' : channels === 4 ? ' (RGBA)' : ''),
        ],
        [
          'Colorspace',
          String(colorspace) +
            (colorspace === 0 ? ' (sRGB)' : colorspace === 1 ? ' (linear alpha)' : ''),
        ],
      ];
      return renderTable(['field', 'value'], rows, 'QOI header', undefined, warnings);
    }

    // summary
    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['Signature', magic],
      ['Dimensions', String(width) + ' x ' + String(height) + ' px'],
      [
        'Channels',
        String(channels) + (channels === 3 ? ' (RGB)' : channels === 4 ? ' (RGBA)' : ''),
      ],
      [
        'Colorspace',
        colorspace === 0 ? 'sRGB' : colorspace === 1 ? 'linear alpha' : String(colorspace),
      ],
      ['Expected pixels', String(pixelCount)],
      ['Decoded pixels', String(decodedPixels)],
      ['Data bytes', String(dataBytes) + ' B'],
      ['End marker', foundEnd ? 'present' : 'missing'],
    ];

    const notes: string[] = [];
    const total = hist.get('RUN') ?? 0;
    if (total > 0)
      notes.push('The stream uses ' + total + ' QOI_OP_RUN opcode(s) for run-length compression.');

    return renderTable(['field', 'value'], summary, 'QOI summary', notes, warnings);
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
