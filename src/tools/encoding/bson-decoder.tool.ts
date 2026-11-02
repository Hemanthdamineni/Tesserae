import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './bson-decoder.meta';

/**
 * BSON (MongoDB binary JSON) decoder.
 *
 * A BSON document is an int32 little-endian total size followed by a stream
 * of elements and a terminal 0x00. Each element is a 1-byte type, a
 * null-terminated name, and a value whose shape depends on the type. The
 * expected values come from the byte-exact fixture built by the Python
 * encoder and confirmed by an independent Python decoder, never from this
 * parser.
 */

const MAX_INPUT = 16 * 1024 * 1024;
const MAX_DEPTH = 128;
const MAX_ELEMENTS = 200000;

type BNode = number | string | boolean | null | BNode[] | { [k: string]: BNode };

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'json');
    const inputFormat = String(opts.inputFormat ?? 'auto');

    const bytes = await readBytes(input, inputFormat);

    const warnings: string[] = [];
    const counts: Record<string, number> = {};

    const decoded = decodeDoc(bytes, 0, 0, counts, warnings);
    const consumed = decoded.next;

    if (consumed < bytes.length) {
      warnings.push(
        'Trailing ' + (bytes.length - consumed) + ' byte(s) after the top-level document.',
      );
    }

    const json = JSON.stringify(decoded.value, null, 2);

    if (view === 'types') {
      const rows = Object.entries(counts).map(([k, v]) => [k, String(v)]);
      rows.push(['total elements', String(countElements(decoded.value))]);
      return renderTable(
        ['type', 'count'],
        rows,
        'BSON type breakdown',
        ['JSON: ' + json],
        warnings,
      );
    }

    return {
      outputs: [],
      report: { output: json, render: 'code' },
      notes: [
        'Decoded ' +
          countElements(decoded.value) +
          ' element(s) from ' +
          bytes.length +
          ' byte(s).',
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
      stats: { bytes: bytes.length, elements: countElements(decoded.value) },
    };
  },
};

function decodeDoc(
  buf: Uint8Array,
  o: number,
  depth: number,
  counts: Record<string, number>,
  warnings: string[],
): { value: BNode; next: number } {
  if (depth > MAX_DEPTH) throw new ToolError('BSON nesting is too deep.');
  if (o + 4 > buf.length) throw new ToolError('Truncated BSON document length.');
  const total = readLE32(buf, o);
  o += 4;
  if (total < 5 || o + total - 4 > buf.length)
    throw new ToolError('BSON document size is invalid or overruns the input.');

  const end = o + total - 5; // offset of the terminal 0x00
  const out: { [k: string]: BNode } = {};
  let elements = 0;

  while (o <= end) {
    if (elements++ > MAX_ELEMENTS) throw new ToolError('BSON document has too many elements.');
    if (buf[o] === 0) {
      o += 1;
      break;
    }
    const type = buf[o] ?? 0;
    o += 1;
    const name = readCString(buf, o);
    o = name.next;
    const value = readValue(buf, o, type, depth, counts, warnings);
    o = value.next;
    out[name.text] = value.value;
  }

  return { value: out as BNode, next: o };
}

function readValue(
  buf: Uint8Array,
  o: number,
  type: number,
  depth: number,
  counts: Record<string, number>,
  warnings: string[],
): { value: BNode; next: number } {
  switch (type) {
    case 0x01: {
      if (o + 8 > buf.length) throw new ToolError('Truncated BSON double.');
      bump(counts, 'double');
      return { value: readF64(buf, o), next: o + 8 };
    }
    case 0x02: {
      if (o + 4 > buf.length) throw new ToolError('Truncated BSON string length.');
      const len = readLE32(buf, o);
      o += 4;
      if (o + len > buf.length || len < 1) throw new ToolError('Truncated BSON string.');
      const text = new TextDecoder('utf-8').decode(buf.subarray(o, o + len - 1));
      bump(counts, 'string');
      return { value: text, next: o + len };
    }
    case 0x03: {
      bump(counts, 'document');
      const sub = decodeDoc(buf, o, depth + 1, counts, warnings);
      return { value: sub.value, next: sub.next };
    }
    case 0x04: {
      bump(counts, 'array');
      const sub = decodeDoc(buf, o, depth + 1, counts, warnings);
      const obj = sub.value as { [k: string]: BNode };
      const arr: BNode[] = [];
      for (const k of Object.keys(obj)) {
        arr[Number(k)] = obj[k] ?? null;
      }
      return { value: arr as BNode, next: sub.next };
    }
    case 0x05: {
      if (o + 5 > buf.length) throw new ToolError('Truncated BSON binary header.');
      const len = readLE32(buf, o);
      const subtype = buf[o + 4] ?? 0;
      if (o + 5 + len > buf.length) throw new ToolError('Truncated BSON binary.');
      bump(counts, 'binary');
      return {
        value: '<binary subtype 0x' + subtype.toString(16) + ', ' + len + ' bytes>',
        next: o + 5 + len,
      };
    }
    case 0x07: {
      if (o + 12 > buf.length) throw new ToolError('Truncated BSON ObjectId.');
      bump(counts, 'objectid');
      const hex = toHex(buf.subarray(o, o + 12));
      return { value: 'ObjectId(' + hex + ')', next: o + 12 };
    }
    case 0x08: {
      if (o + 1 > buf.length) throw new ToolError('Truncated BSON boolean.');
      bump(counts, 'boolean');
      return { value: (buf[o] ?? 0) !== 0, next: o + 1 };
    }
    case 0x09: {
      if (o + 8 > buf.length) throw new ToolError('Truncated BSON datetime.');
      bump(counts, 'datetime');
      const ms = readLEI64(buf, o);
      return { value: 'ISODate(' + new Date(Number(ms)).toISOString() + ')', next: o + 8 };
    }
    case 0x0a: {
      bump(counts, 'null');
      return { value: null, next: o };
    }
    case 0x0b: {
      const pat = readCString(buf, o);
      const flags = readCString(buf, pat.next);
      bump(counts, 'regex');
      return { value: '/' + pat.text + '/' + flags.text, next: flags.next };
    }
    case 0x0d: {
      if (o + 4 > buf.length) throw new ToolError('Truncated BSON code length.');
      const len = readLE32(buf, o);
      o += 4;
      if (o + len > buf.length || len < 1) throw new ToolError('Truncated BSON code.');
      const text = new TextDecoder('utf-8').decode(buf.subarray(o, o + len - 1));
      bump(counts, 'code');
      return { value: text, next: o + len };
    }
    case 0x10: {
      if (o + 4 > buf.length) throw new ToolError('Truncated BSON int32.');
      bump(counts, 'int32');
      return { value: readLEI32(buf, o), next: o + 4 };
    }
    case 0x11: {
      if (o + 8 > buf.length) throw new ToolError('Truncated BSON timestamp.');
      bump(counts, 'timestamp');
      const inc = readLE32(buf, o);
      const ts = readLE32(buf, o + 4);
      return { value: 'timestamp(' + ts + ', ' + inc + ')', next: o + 8 };
    }
    case 0x12: {
      if (o + 8 > buf.length) throw new ToolError('Truncated BSON int64.');
      bump(counts, 'int64');
      return { value: Number(readLEI64(buf, o)), next: o + 8 };
    }
    case 0x13: {
      if (o + 16 > buf.length) throw new ToolError('Truncated BSON decimal128.');
      bump(counts, 'decimal128');
      return { value: '<decimal128>', next: o + 16 };
    }
    case 0xff: {
      bump(counts, 'minKey');
      return { value: 'MinKey', next: o };
    }
    case 0x7f: {
      bump(counts, 'maxKey');
      return { value: 'MaxKey', next: o };
    }
    default:
      throw new ToolError('Unsupported BSON type byte 0x' + type.toString(16) + '.');
  }
}

function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function readCString(buf: Uint8Array, o: number): { text: string; next: number } {
  const start = o;
  while (o < buf.length && (buf[o] ?? 0) !== 0) o += 1;
  if (o >= buf.length) throw new ToolError('Unterminated BSON string.');
  const text = new TextDecoder('utf-8').decode(buf.subarray(start, o));
  return { text, next: o + 1 };
}

function readLE32(buf: Uint8Array, o: number): number {
  return (
    ((buf[o] ?? 0) |
      ((buf[o + 1] ?? 0) << 8) |
      ((buf[o + 2] ?? 0) << 16) |
      ((buf[o + 3] ?? 0) << 24)) >>>
    0
  );
}

function readLEI32(buf: Uint8Array, o: number): number {
  return (
    (buf[o] ?? 0) |
    ((buf[o + 1] ?? 0) << 8) |
    ((buf[o + 2] ?? 0) << 16) |
    ((buf[o + 3] ?? 0) << 24) |
    0
  );
}

function readLEI64(buf: Uint8Array, o: number): bigint {
  let v = BigInt(0);
  for (let i = 7; i >= 0; i -= 1) v = (v << 8n) | BigInt(buf[o + i] ?? 0);
  return v;
}

function readF64(buf: Uint8Array, o: number): number {
  const b = buf.subarray(o, o + 8);
  const view = new DataView(b.buffer, b.byteOffset, 8);
  return view.getFloat64(0, true);
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return s;
}

function countElements(v: BNode): number {
  if (!v || typeof v !== 'object') return 0;
  if (Array.isArray(v)) {
    let n = v.length;
    for (const item of v) {
      if (item && typeof item === 'object') n += countElements(item);
    }
    return n;
  }
  let n = 0;
  for (const k of Object.keys(v)) {
    n += 1;
    const c = v[k];
    if (c && typeof c === 'object') n += countElements(c as BNode);
  }
  return n;
}

async function readBytes(input: FileRunInput, inputFormat: string): Promise<Uint8Array> {
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    if (!file) throw new ToolError('No file was provided.');
    if (file.size > MAX_INPUT) throw new ToolError('File is too large to decode in the browser.');
    return new Uint8Array(await file.arrayBuffer());
  }
  const text = String(input.text ?? '').trim();
  if (text.length === 0) throw new ToolError('Paste a BSON byte sequence or drop in a file.');
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
