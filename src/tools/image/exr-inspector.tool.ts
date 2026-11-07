import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './exr-inspector.meta';

/**
 * OpenEXR image inspector.
 *
 * Parses the OpenEXR header: the magic (0x76 0x2f 0x31 0x01), the version byte
 * and flags (tiled, deep, multi-part, non-image), then walks the attribute list
 * (name, type, size, value) terminated by a null byte. From the attributes it
 * reports the channels, compression, data window, display window, line order
 * and pixel aspect ratio. Expected values come from the byte-exact fixture
 * confirmed by `file`(1) and an independent parser, never from this one.
 */

const MAX_BYTES = 256 * 1024 * 1024;

interface ExrChannel {
  name: string;
  type: string;
  sampling: [number, number];
}

interface ExrAttribute {
  name: string;
  type: string;
  value: string;
}

interface Model {
  version: number;
  tiled: boolean;
  deep: boolean;
  multipart: boolean;
  channels: ExrChannel[];
  compression: string;
  dataWindow: number[];
  displayWindow: number[];
  lineOrder: string;
  pixelAspect: number;
  width: number;
  height: number;
  attributes: ExrAttribute[];
}

const TYPE_NAMES: Record<number, string> = { 0: 'UINT', 1: 'HALF', 2: 'FLOAT' };
const COMPRESSION_NAMES: Record<number, string> = {
  0: 'None',
  1: 'RLE',
  2: 'ZIPS',
  3: 'ZIP',
  4: 'PIZ',
  5: 'PXR24',
  6: 'B44',
  7: 'B44A',
  8: 'DWAA',
  9: 'DWAB',
};

function u32(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] ?? 0) |
      ((bytes[at + 1] ?? 0) << 8) |
      ((bytes[at + 2] ?? 0) << 16) |
      ((bytes[at + 3] ?? 0) << 24)) >>>
    0
  );
}

function f32(bytes: Uint8Array, at: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + at, 4).getFloat32(0, true);
}

function i32(bytes: Uint8Array, at: number): number {
  return (
    (bytes[at] ?? 0) |
    ((bytes[at + 1] ?? 0) << 8) |
    ((bytes[at + 2] ?? 0) << 16) |
    ((bytes[at + 3] ?? 0) << 24) |
    0
  );
}

function cstr(bytes: Uint8Array, at: number): { s: string; next: number } {
  let s = '';
  let o = at;
  while (o < bytes.length) {
    const c = bytes[o] ?? 0;
    if (c === 0) break;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
    o += 1;
  }
  return { s, next: o + 1 };
}

function formatDimensions(w: number, h: number): string {
  return w + '\u00d7' + h;
}

function parseExr(bytes: Uint8Array): Model {
  if (bytes.length < 8) throw new ToolError('That file is too short to be an OpenEXR image.');
  if (!(bytes[0] === 0x76 && bytes[1] === 0x2f && bytes[2] === 0x31 && bytes[3] === 0x01)) {
    throw new ToolError(
      'That file is not an OpenEXR image.',
      'An OpenEXR file starts with the magic 0x762f3101.',
    );
  }

  const verField = u32(bytes, 4);
  const version = verField & 0xff;
  const flags = verField & 0xffffff00;
  const tiled = (flags & 0x200) !== 0;
  const deep = (flags & 0x800) !== 0;
  const multipart = (flags & 0x1000) !== 0;

  const channels: ExrChannel[] = [];
  const attributes: ExrAttribute[] = [];
  let compression = 'Unknown';
  let dataWindow = [0, 0, 0, 0];
  let displayWindow = [0, 0, 0, 0];
  let lineOrder = 'Unknown';
  let pixelAspect = 1;
  let o = 8;
  let guard = 0;

  while (o < bytes.length) {
    if (guard++ > 5000) throw new ToolError('The OpenEXR header has too many attributes.');
    if (bytes[o] === 0) break;

    const name = cstr(bytes, o);
    const type = cstr(bytes, name.next);
    o = type.next;
    if (o + 4 > bytes.length) throw new ToolError('Truncated OpenEXR attribute size.');
    const size = u32(bytes, o);
    o += 4;
    if (o + size > bytes.length) throw new ToolError('An OpenEXR attribute overruns the file.');

    const val = bytes.subarray(o, o + size);
    o += size;

    let value = size + ' bytes';
    if (name.s === 'channels' && type.s === 'chlist') {
      const chans: ExrChannel[] = [];
      let p = 0;
      while (p < val.length && val[p] !== 0) {
        const cn = cstr(val, p);
        p = cn.next;
        if (p + 4 > val.length) break;
        const pixelType = u32(val, p);
        p += 4 + 1 + 3;
        const xSampling = i32(val, p);
        const ySampling = i32(val, p + 4);
        p += 8;
        chans.push({
          name: cn.s,
          type: TYPE_NAMES[pixelType] ?? 'Type ' + pixelType,
          sampling: [xSampling, ySampling],
        });
      }
      channels.push(...chans);
      value = chans.map((c) => c.name).join(', ') || '(empty)';
    } else if (name.s === 'compression' && type.s === 'compression' && size >= 1) {
      compression = COMPRESSION_NAMES[val[0] ?? 0] ?? 'Codec ' + (val[0] ?? 0);
      value = compression;
    } else if (name.s === 'dataWindow' && type.s === 'box2i' && size >= 16) {
      dataWindow = [i32(val, 0), i32(val, 4), i32(val, 8), i32(val, 12)];
      value =
        'x ' +
        dataWindow[0] +
        ' to ' +
        dataWindow[2] +
        ', y ' +
        dataWindow[1] +
        ' to ' +
        dataWindow[3];
    } else if (name.s === 'displayWindow' && type.s === 'box2i' && size >= 16) {
      displayWindow = [i32(val, 0), i32(val, 4), i32(val, 8), i32(val, 12)];
      value =
        'x ' +
        displayWindow[0] +
        ' to ' +
        displayWindow[2] +
        ', y ' +
        displayWindow[1] +
        ' to ' +
        displayWindow[3];
    } else if (name.s === 'lineOrder' && type.s === 'lineOrder' && size >= 1) {
      lineOrder =
        val[0] === 0
          ? 'Increasing y'
          : val[0] === 1
            ? 'Decreasing y'
            : val[0] === 2
              ? 'Random y'
              : 'Unknown';
      value = lineOrder;
    } else if (name.s === 'pixelAspectRatio' && type.s === 'float' && size >= 4) {
      pixelAspect = f32(val, 0);
      value = String(pixelAspect);
    }

    attributes.push({ name: name.s, type: type.s, value });
  }

  const width = (dataWindow[2] ?? 0) - (dataWindow[0] ?? 0) + 1;
  const height = (dataWindow[3] ?? 0) - (dataWindow[1] ?? 0) + 1;
  return {
    version,
    tiled,
    deep,
    multipart,
    channels,
    compression,
    dataWindow,
    displayWindow,
    lineOrder,
    pixelAspect,
    width,
    height,
    attributes,
  };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'OpenEXR'],
      ['Version', String(m.version)],
      ['Layout', m.tiled ? 'Tiled' : 'Scanline'],
      ['Dimensions', formatDimensions(m.width, m.height)],
      ['Channels', String(m.channels.length)],
      ['Channel names', m.channels.map((c) => c.name).join(', ') || '(none)'],
      ['Compression', m.compression],
      ['Deep data', m.deep ? 'yes' : 'no'],
      ['Multi-part', m.multipart ? 'yes' : 'no'],
    ],
  };
}

function tableChannels(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Channel', 'Type', 'Sampling'],
    rows: m.channels.map((c) => [c.name, c.type, c.sampling[0] + '/' + c.sampling[1]]),
  };
}

function tableAttributes(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Attribute', 'Type', 'Value'],
    rows: m.attributes.map((a) => [a.name, a.type, a.value]),
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No file was provided.', 'Choose an OpenEXR image to inspect.');
  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 256 MB.');

  const bytes = new Uint8Array(await source.arrayBuffer());
  const m = parseExr(bytes);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'channels':
      table = tableChannels(m);
      break;
    case 'attributes':
      table = tableAttributes(m);
      break;
    case 'summary':
    default:
      table = tableSummary(m);
  }

  return {
    outputs: [] as OutputFile[],
    report: { output: JSON.stringify(table), render: 'table' },
    notes: [
      'OpenEXR v' +
        m.version +
        ', ' +
        m.width +
        'x' +
        m.height +
        ', ' +
        m.channels.length +
        ' channel(s), ' +
        m.compression +
        '.',
    ],
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { width: m.width, height: m.height, channels: m.channels.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
