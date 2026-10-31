import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './tiff-inspector.meta';

const MAX_BYTES = 256 * 1024 * 1024;

const TYPE_NAMES: Record<number, string> = {
  1: 'BYTE',
  2: 'ASCII',
  3: 'SHORT',
  4: 'LONG',
  5: 'RATIONAL',
  6: 'SBYTE',
  7: 'UNDEFINED',
  8: 'SSHORT',
  9: 'SLONG',
  10: 'SRATIONAL',
  11: 'FLOAT',
  12: 'DOUBLE',
};

const TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
};

const TAG_NAMES: Record<number, string> = {
  254: 'NewSubfileType',
  256: 'ImageWidth',
  257: 'ImageLength',
  258: 'BitsPerSample',
  259: 'Compression',
  262: 'PhotometricInterpretation',
  273: 'StripOffsets',
  274: 'Orientation',
  277: 'SamplesPerPixel',
  278: 'RowsPerStrip',
  279: 'StripByteCounts',
  282: 'XResolution',
  283: 'YResolution',
  284: 'PlanarConfiguration',
  296: 'ResolutionUnit',
  305: 'Software',
  306: 'DateTime',
};

const COMPRESSION: Record<number, string> = {
  1: 'none',
  2: 'CCITT RLE',
  3: 'T4',
  4: 'T6',
  5: 'LZW',
  6: 'JPEG',
  7: 'JPEG 2000',
  8: 'Deflate',
  32773: 'PackBits',
};

const PHOTOMETRIC: Record<number, string> = {
  0: 'WhiteIsZero',
  1: 'BlackIsZero',
  2: 'RGB',
  3: 'Palette',
  4: 'Transparency mask',
  5: 'CMYK',
  6: 'YCbCr',
  8: 'CIELab',
};

const RESOLUTION_UNIT: Record<number, string> = {
  1: 'none',
  2: 'inch',
  3: 'cm',
};

interface Entry {
  offset: number;
  tag: number;
  name: string;
  type: string;
  count: number;
  value: string;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  size: number;
  byteOrder: string;
  magicOk: boolean;
  ifdOffset: number;
  entries: Entry[];
  findings: Finding[];
  width: number;
  height: number;
}

function ascii(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = b[off + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  const bo = size >= 2 ? String.fromCharCode(data[0] ?? 0) + String.fromCharCode(data[1] ?? 0) : '';
  const endian = bo === 'MM' ? 'big' : bo === 'II' ? 'little' : 'unknown';
  let magic = 0;
  if (size >= 4) {
    magic =
      bo === 'MM' ? (data[2] ?? 0) * 256 + (data[3] ?? 0) : (data[3] ?? 0) * 256 + (data[2] ?? 0);
  }
  const magicOk = (bo === 'MM' || bo === 'II') && magic === 42;
  if (!magicOk) {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file does not begin with a valid TIFF header (byte order II/MM and magic 42).',
    });
  }
  const ifdOffset =
    size >= 8
      ? (bo === 'MM'
          ? (data[4] ?? 0) * 16777216 +
            (data[5] ?? 0) * 65536 +
            (data[6] ?? 0) * 256 +
            (data[7] ?? 0)
          : (data[7] ?? 0) * 16777216 +
            (data[6] ?? 0) * 65536 +
            (data[5] ?? 0) * 256 +
            (data[4] ?? 0)) >>> 0
      : 0;
  const entries: Entry[] = [];
  let width = 0;
  let height = 0;
  if (magicOk) {
    if (ifdOffset + 2 > size) {
      findings.push({
        severity: 'error',
        kind: 'ifd',
        detail: 'The IFD offset ' + ifdOffset + ' lies beyond the ' + size + '-byte file.',
      });
    } else {
      const count =
        (bo === 'MM'
          ? (data[ifdOffset] ?? 0) * 256 + (data[ifdOffset + 1] ?? 0)
          : (data[ifdOffset + 1] ?? 0) * 256 + (data[ifdOffset] ?? 0)) >>> 0;
      for (let i = 0; i < count; i += 1) {
        const e = ifdOffset + 2 + i * 12;
        if (e + 12 > size) {
          findings.push({
            severity: 'error',
            kind: 'ifd',
            detail: 'IFD entry ' + i + ' at offset ' + e + ' overruns the file.',
          });
          break;
        }
        const tag =
          (bo === 'MM'
            ? (data[e] ?? 0) * 256 + (data[e + 1] ?? 0)
            : (data[e + 1] ?? 0) * 256 + (data[e] ?? 0)) >>> 0;
        const typ =
          (bo === 'MM'
            ? (data[e + 2] ?? 0) * 256 + (data[e + 3] ?? 0)
            : (data[e + 3] ?? 0) * 256 + (data[e + 2] ?? 0)) >>> 0;
        const cnt =
          (bo === 'MM'
            ? (data[e + 4] ?? 0) * 16777216 +
              (data[e + 5] ?? 0) * 65536 +
              (data[e + 6] ?? 0) * 256 +
              (data[e + 7] ?? 0)
            : (data[e + 7] ?? 0) * 16777216 +
              (data[e + 6] ?? 0) * 65536 +
              (data[e + 5] ?? 0) * 256 +
              (data[e + 4] ?? 0)) >>> 0;
        const tsize = TYPE_SIZE[typ] ?? 1;
        const tname = TYPE_NAMES[typ] ?? 'type-' + typ;
        const inline = cnt * tsize <= 4;
        let value = '';
        if (typ === 2 && inline) {
          const start = e + 8;
          value = ascii(data, start, Math.min(cnt, 4));
        } else if (inline) {
          const b0 = data[e + 8] ?? 0;
          const b1 = data[e + 9] ?? 0;
          const b2 = data[e + 10] ?? 0;
          const b3 = data[e + 11] ?? 0;
          if (typ === 3) {
            value = String(bo === 'MM' ? b0 * 256 + b1 : b1 * 256 + b0);
          } else if (typ === 4) {
            value = String(
              (bo === 'MM'
                ? b0 * 16777216 + b1 * 65536 + b2 * 256 + b3
                : b3 * 16777216 + b2 * 65536 + b1 * 256 + b0) >>> 0,
            );
          } else {
            value = String(b0);
          }
        } else {
          const off =
            (bo === 'MM'
              ? (data[e + 8] ?? 0) * 16777216 +
                (data[e + 9] ?? 0) * 65536 +
                (data[e + 10] ?? 0) * 256 +
                (data[e + 11] ?? 0)
              : (data[e + 11] ?? 0) * 16777216 +
                (data[e + 10] ?? 0) * 65536 +
                (data[e + 9] ?? 0) * 256 +
                (data[e + 8] ?? 0)) >>> 0;
          let text = 'off=' + off;
          if (typ === 2 && off + cnt <= size) {
            text = ascii(data, off, Math.min(cnt, size - off));
          }
          value = text;
        }
        // semantic translation
        let disp = value;
        if (tag === 259) disp = (COMPRESSION[Number(value)] ?? value) + ' (' + value + ')';
        else if (tag === 262) disp = (PHOTOMETRIC[Number(value)] ?? value) + ' (' + value + ')';
        else if (tag === 296) disp = (RESOLUTION_UNIT[Number(value)] ?? value) + ' (' + value + ')';
        if (tag === 256 && Number(value) > 0) width = Number(value);
        if (tag === 257 && Number(value) > 0) height = Number(value);
        entries.push({
          offset: e,
          tag,
          name: TAG_NAMES[tag] ?? 'tag-' + tag,
          type: tname,
          count: cnt,
          value: disp,
        });
      }
    }
  }
  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      kind: 'ok',
      detail: 'The TIFF IFD structure looks well-formed.',
    });
  }
  return { size, byteOrder: endian, magicOk, ifdOffset, entries, findings, width, height };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose a TIFF image to inspect.',
        'Drop a .tiff or .tif file onto the tool.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That TIFF image is too large.', 'Use a file under 256 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'summary');
    let headers: string[];
    let rows: string[][];
    if (view === 'ifd') {
      headers = ['Offset', 'Tag', 'Name', 'Type', 'Count', 'Value'];
      rows = m.entries.map((x) => [
        String(x.offset),
        String(x.tag),
        x.name,
        x.type,
        String(x.count),
        x.value,
      ]);
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Byte order', m.byteOrder],
        ['Magic', m.magicOk ? 'valid (42)' : 'INVALID'],
        ['IFD offset', String(m.ifdOffset)],
        ['IFD entries', String(m.entries.length)],
        ['Width', String(m.width)],
        ['Height', String(m.height)],
      ];
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(
      m.entries.length + ' IFD entr' + (m.entries.length === 1 ? 'y' : 'ies') + ' parsed.',
    );
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
