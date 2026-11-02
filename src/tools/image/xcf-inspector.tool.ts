import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './xcf-inspector.meta';

/**
 * GIMP XCF image inspector.
 *
 * An XCF file starts with a header: the 9-byte magic "gimp xcf ", a
 * null-terminated version string, and the width, height and base type as
 * big-endian 32-bit integers. A top-level property list follows, each entry
 * a (type, size, data) triple, terminated by PROP_END (0). The expected
 * values come from the byte-exact fixture built by the Python encoder and
 * confirmed by the `file`(1) reference tool ("GIMP XCF image data"), never
 * from this parser.
 */

const MAX_BYTES = 512 * 1024 * 1024;
const PROP_END = 0;
const PROP_COMPRESSION = 17;
const PROP_RESOLUTION = 4;

interface XcfProperty {
  type: number;
  name: string;
  size: number;
  text?: string;
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'summary');

    const file = input.files[0];
    if (!file) throw new ToolError('Choose a GIMP XCF image file to inspect.', 'Pick a .xcf file.');
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 64) throw new ToolError('File is too short to be an XCF image.');

    const warnings: string[] = [];
    const ascii = (o: number, len: number): string => {
      let s = '';
      let end = o + len;
      if (end > buf.length) end = buf.length;
      for (let i = o; i < end; i += 1) {
        const c = buf[i] ?? 0;
        if (c === 0) break;
        s += c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : '?';
      }
      return s;
    };

    const magic = ascii(0, 9);
    if (magic !== 'gimp xcf ') {
      throw new ToolError(
        'Not a GIMP XCF image (missing the "gimp xcf " magic).',
        'An XCF file starts with the 9 bytes "gimp xcf ".',
      );
    }

    // Version string is null-terminated starting at offset 9
    let vo = 9;
    let version = '';
    while (vo < buf.length && (buf[vo] ?? 0) !== 0) {
      const c = buf[vo] ?? 0;
      version += c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : '';
      vo += 1;
    }
    const dataStart = vo + 1; // skip the null terminator

    if (dataStart + 12 > buf.length) throw new ToolError('XCF header is truncated.');

    const width = readBE32(buf, dataStart);
    const height = readBE32(buf, dataStart + 4);
    const baseType = readBE32(buf, dataStart + 8);

    const baseTypeName = (t: number): string => {
      switch (t) {
        case 0:
          return 'RGB';
        case 1:
          return 'grayscale';
        case 2:
          return 'indexed';
        default:
          return 'unknown (' + t + ')';
      }
    };

    // Property list
    const props: XcfProperty[] = [];
    let o = dataStart + 12;
    let guard = 0;
    while (o + 8 <= buf.length && guard < 100000) {
      const ptype = readBE32(buf, o);
      const psize = readBE32(buf, o + 4);
      o += 8;
      if (ptype === PROP_END) break;
      if (o + psize > buf.length) {
        warnings.push('Property block runs past the end of the file.');
        break;
      }
      const prop: XcfProperty = { type: ptype, name: propName(ptype), size: psize };
      if (ptype === PROP_RESOLUTION && psize >= 8) {
        prop.text = readBE32(buf, o) + ' dpi x ' + readBE32(buf, o + 4) + ' dpi';
      } else if (ptype === PROP_COMPRESSION && psize >= 4) {
        prop.text = compressionName(readBE32(buf, o));
      } else if (ptype === PROP_COLORMAP) {
        prop.text = 'present';
      }
      props.push(prop);
      o += psize;
      guard += 1;
    }
    if (props.length === 0 && o >= buf.length) warnings.push('No property list was found.');

    if (view === 'properties') {
      const rows = props.map((p) => [p.name, String(p.type), String(p.size), p.text ?? '']);
      return renderTable(
        ['property', 'type', 'size', 'value'],
        rows,
        'XCF properties',
        undefined,
        warnings,
      );
    }

    const layers = props.filter((p) => p.type === PROP_LAYER).length;
    const channels = props.filter((p) => p.type === PROP_CHANNEL).length;

    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['Version', version],
      ['Width', String(width) + ' px'],
      ['Height', String(height) + ' px'],
      ['Base type', baseTypeName(baseType)],
      ['Properties', String(props.length)],
    ];

    const notes: string[] = [];
    if (layers > 0) notes.push('Declares ' + layers + ' layer(s).');
    if (channels > 0) notes.push('Declares ' + channels + ' channel(s).');
    const comp = props.find((p) => p.type === PROP_COMPRESSION);
    if (comp?.text) notes.push('Compression: ' + comp.text + '.');

    return renderTable(['field', 'value'], summary, 'XCF summary', notes, warnings);
  },
};

const PROP_LAYER = 40;
const PROP_CHANNEL = 41;
const PROP_COLORMAP = 45;

function readBE32(buf: Uint8Array, o: number): number {
  return (
    ((buf[o] ?? 0) << 24) | ((buf[o + 1] ?? 0) << 16) | ((buf[o + 2] ?? 0) << 8) | (buf[o + 3] ?? 0)
  );
}

function propName(t: number): string {
  switch (t) {
    case 0:
      return 'end';
    case 17:
      return 'compression';
    case 4:
      return 'resolution';
    case 1:
      return 'name';
    case 2:
      return 'base-detail';
    case 20:
      return 'parasites';
    case 45:
      return 'colormap';
    case 40:
      return 'layer';
    case 41:
      return 'channel';
    default:
      return 'property-' + t;
  }
}

function compressionName(v: number): string {
  switch (v) {
    case 0:
      return 'RLE';
    case 1:
      return 'fractal';
    case 2:
      return 'zip';
    case 3:
      return 'zip (predict)';
    default:
      return 'unknown (' + v + ')';
  }
}

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
