import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './msgpack-decoder.meta';

/**
 * MessagePack decoder.
 *
 * MessagePack is a compact binary serialization format. A value is a type
 * byte followed by its payload. Integers use a wide range of encodings
 * (fixint, uint8-64, int8-64), floats are 32 or 64 bit, strings and binaries
 * are length-prefixed, and arrays and maps are length-prefixed. The expected
 * values come from the byte-exact fixture built by the Python encoder and
 * confirmed by an independent Python decoder, never from this parser.
 */

const MAX_INPUT = 16 * 1024 * 1024;
const MAX_DEPTH = 512;

interface Counts {
  int: number;
  uint: number;
  float: number;
  str: number;
  bin: number;
  array: number;
  map: number;
  ext: number;
  bool: number;
  nil: number;
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'json');
    const inputFormat = String(opts.inputFormat ?? 'auto');

    const bytes = await readBytes(input, inputFormat);

    const warnings: string[] = [];
    const counts: Counts = {
      int: 0,
      uint: 0,
      float: 0,
      str: 0,
      bin: 0,
      array: 0,
      map: 0,
      ext: 0,
      bool: 0,
      nil: 0,
    };

    let offset = 0;
    const value = unpack(bytes, 0, counts, 0);
    offset = value.next;

    if (offset < bytes.length) {
      warnings.push('Trailing ' + (bytes.length - offset) + ' byte(s) after the top-level value.');
    }

    const json = renderJson(value.value);

    if (view === 'types') {
      const rows = Object.entries(counts).map(([k, v]) => [k, String(v)]);
      return renderTable(
        ['type', 'count'],
        rows,
        'MessagePack type breakdown',
        ['JSON: ' + json],
        warnings,
      );
    }

    return {
      outputs: [],
      report: { output: json, render: 'code' },
      notes: ['Decoded from ' + bytes.length + ' byte(s).'],
      warnings: warnings.length > 0 ? warnings : undefined,
      stats: { bytes: bytes.length },
    };
  },
};

function unpack(
  buf: Uint8Array,
  o: number,
  counts: Counts,
  depth: number,
): { value: unknown; next: number } {
  if (o >= buf.length) throw new ToolError('Truncated MessagePack input (unexpected end of data).');
  if (depth > MAX_DEPTH) throw new ToolError('MessagePack nesting is too deep.');

  const c = buf[o] ?? 0;
  o += 1;

  if (c === 0xc0) {
    counts.nil += 1;
    return { value: null, next: o };
  }
  if (c === 0xc2) {
    counts.bool += 1;
    return { value: false, next: o };
  }
  if (c === 0xc3) {
    counts.bool += 1;
    return { value: true, next: o };
  }

  // fixint positive
  if (c <= 0x7f) {
    counts.int += 1;
    return { value: c, next: o };
  }
  // fixint negative
  if (c >= 0xe0) {
    counts.int += 1;
    return { value: c - 0x100, next: o };
  }

  // int/uint
  if (c === 0xcc) return num(buf, o, 1, false, counts);
  if (c === 0xcd) return num(buf, o, 2, false, counts);
  if (c === 0xce) return num(buf, o, 4, false, counts);
  if (c === 0xcf) return num(buf, o, 8, false, counts);
  if (c === 0xd0) return num(buf, o, 1, true, counts);
  if (c === 0xd1) return num(buf, o, 2, true, counts);
  if (c === 0xd2) return num(buf, o, 4, true, counts);
  if (c === 0xd3) return num(buf, o, 8, true, counts);

  // float
  if (c === 0xca) {
    counts.float += 1;
    return { value: readF32(buf, o), next: o + 4 };
  }
  if (c === 0xcb) {
    counts.float += 1;
    return { value: readF64(buf, o), next: o + 8 };
  }

  // str
  if (c >= 0xa0 && c <= 0xbf) {
    const n = c & 0x1f;
    counts.str += 1;
    return { value: readStr(buf, o, n), next: o + n };
  }
  if (c === 0xd9) {
    const n = buf[o] ?? 0;
    counts.str += 1;
    return { value: readStr(buf, o + 1, n), next: o + 1 + n };
  }
  if (c === 0xda) {
    const n = readU16(buf, o);
    counts.str += 1;
    return { value: readStr(buf, o + 2, n), next: o + 2 + n };
  }
  if (c === 0xdb) {
    const n = readU32(buf, o);
    counts.str += 1;
    return { value: readStr(buf, o + 4, n), next: o + 4 + n };
  }

  // bin
  if (c === 0xc4) {
    const n = buf[o] ?? 0;
    counts.bin += 1;
    return { value: '<' + n + ' binary bytes>', next: o + 1 + n };
  }
  if (c === 0xc5) {
    const n = readU16(buf, o);
    counts.bin += 1;
    return { value: '<' + n + ' binary bytes>', next: o + 2 + n };
  }
  if (c === 0xc6) {
    const n = readU32(buf, o);
    counts.bin += 1;
    return { value: '<' + n + ' binary bytes>', next: o + 4 + n };
  }

  // array
  if (c >= 0x90 && c <= 0x9f) {
    const n = c & 0x0f;
    counts.array += 1;
    return unpackArray(buf, o, n, counts, depth);
  }
  if (c === 0xdc) {
    const n = readU16(buf, o);
    counts.array += 1;
    return unpackArray(buf, o + 2, n, counts, depth);
  }
  if (c === 0xdd) {
    const n = readU32(buf, o);
    counts.array += 1;
    return unpackArray(buf, o + 4, n, counts, depth);
  }

  // map
  if (c >= 0x80 && c <= 0x8f) {
    const n = c & 0x0f;
    counts.map += 1;
    return unpackMap(buf, o, n, counts, depth);
  }
  if (c === 0xde) {
    const n = readU16(buf, o);
    counts.map += 1;
    return unpackMap(buf, o + 2, n, counts, depth);
  }
  if (c === 0xdf) {
    const n = readU32(buf, o);
    counts.map += 1;
    return unpackMap(buf, o + 4, n, counts, depth);
  }

  // ext family
  if (c === 0xc7 || c === 0xc8 || c === 0xc9 || (c >= 0xd4 && c <= 0xd8)) {
    counts.ext += 1;
    const t = c;
    if (t === 0xc7) {
      const n = buf[o] ?? 0;
      const et = buf[o + 1] ?? 0;
      return { value: 'ext type ' + et + ' (' + n + ' bytes)', next: o + 2 + n };
    }
    if (t === 0xc8) {
      const n = readU16(buf, o);
      const et = buf[o + 2] ?? 0;
      return { value: 'ext type ' + et + ' (' + n + ' bytes)', next: o + 3 + n };
    }
    if (t === 0xc9) {
      const n = readU32(buf, o);
      const et = buf[o + 4] ?? 0;
      return { value: 'ext type ' + et + ' (' + n + ' bytes)', next: o + 5 + n };
    }
    const sizes: Record<number, number> = { 0xd4: 1, 0xd5: 2, 0xd6: 4, 0xd7: 8, 0xd8: 16 };
    const size = sizes[t] ?? 0;
    const et = buf[o] ?? 0;
    return { value: 'ext type ' + et + ' (' + size + ' bytes)', next: o + 1 + size };
  }

  throw new ToolError('Unsupported MessagePack type byte 0x' + c.toString(16) + '.');
}

function unpackArray(
  buf: Uint8Array,
  o: number,
  n: number,
  counts: Counts,
  depth: number,
): { value: unknown; next: number } {
  const arr: unknown[] = [];
  for (let i = 0; i < n; i += 1) {
    const r = unpack(buf, o, counts, depth + 1);
    arr.push(r.value);
    o = r.next;
  }
  return { value: arr, next: o };
}

function unpackMap(
  buf: Uint8Array,
  o: number,
  n: number,
  counts: Counts,
  depth: number,
): { value: unknown; next: number } {
  const m: Record<string, unknown> = {};
  for (let i = 0; i < n; i += 1) {
    const k = unpack(buf, o, counts, depth + 1);
    const v = unpack(buf, k.next, counts, depth + 1);
    m[String(k.value)] = v.value;
    o = v.next;
  }
  return { value: m, next: o };
}

function num(
  buf: Uint8Array,
  o: number,
  len: number,
  signed: boolean,
  counts: Counts,
): { value: unknown; next: number } {
  let v = 0;
  for (let i = 0; i < len; i += 1) v = v * 256 + (buf[o + i] ?? 0);
  if (signed && (buf[o] ?? 0) & 0x80) v = v - 2 ** (8 * len);
  counts.uint += 1;
  return { value: v, next: o + len };
}

function readU16(buf: Uint8Array, o: number): number {
  return ((buf[o] ?? 0) << 8) | (buf[o + 1] ?? 0);
}

function readU32(buf: Uint8Array, o: number): number {
  return (
    (((buf[o] ?? 0) << 24) |
      ((buf[o + 1] ?? 0) << 16) |
      ((buf[o + 2] ?? 0) << 8) |
      (buf[o + 3] ?? 0)) >>>
    0
  );
}

function readF32(buf: Uint8Array, o: number): number {
  const b = buf.subarray(o, o + 4);
  const view = new DataView(b.buffer, b.byteOffset, 4);
  return view.getFloat32(0, false);
}

function readF64(buf: Uint8Array, o: number): number {
  const b = buf.subarray(o, o + 8);
  const view = new DataView(b.buffer, b.byteOffset, 8);
  return view.getFloat64(0, false);
}

function readStr(buf: Uint8Array, o: number, n: number): string {
  if (o + n > buf.length) throw new ToolError('Truncated string in MessagePack input.');
  const bytes = buf.subarray(o, o + n);
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '<' + n + ' bytes>';
  }
}

function renderJson(v: unknown): string {
  return JSON.stringify(v, null, 2);
}

async function readBytes(input: FileRunInput, inputFormat: string): Promise<Uint8Array> {
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    if (!file) throw new ToolError('No file was provided.');
    if (file.size > MAX_INPUT) throw new ToolError('File is too large to decode in the browser.');
    return new Uint8Array(await file.arrayBuffer());
  }
  const text = String(input.text ?? '').trim();
  if (text.length === 0)
    throw new ToolError('Paste a MessagePack byte sequence or drop in a file.');
  if (text.length > MAX_INPUT) throw new ToolError('Input is too large.');
  return decodeText(text, inputFormat);
}

function decodeText(text: string, inputFormat: string): Uint8Array {
  const clean = text.replace(/[\s,]/g, '');
  const fmt = inputFormat === 'auto' ? detect(clean) : inputFormat;
  if (fmt === 'hex') {
    if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean))
      throw new ToolError('Invalid hexadecimal input.');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  if (fmt === 'base64') {
    if (!/^[A-Za-z0-9+/=]+$/.test(clean)) throw new ToolError('Invalid base64 input.');
    try {
      const bin = atob(clean);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
      return out;
    } catch {
      throw new ToolError('Invalid base64 input.');
    }
  }
  throw new ToolError('Could not detect the input format. Choose hex or base64.');
}

function detect(text: string): string {
  return /^[0-9a-fA-F]+$/.test(text) && text.length % 2 === 0 ? 'hex' : 'base64';
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
