import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './protobuf-decoder.meta';

/**
 * Protocol Buffers wire-format decoder.
 *
 * A protobuf message is a flat stream of fields. Each field is a varint
 * field key (field_number << 3 | wire_type) followed by a value whose shape
 * depends on the wire type: 0 varint, 1 64-bit, 2 length-delimited, 3/4
 * start/end group, 5 32-bit. The expected values come from the byte-exact
 * fixture built by the Python encoder and confirmed by an independent Python
 * decoder, never from this parser.
 */

const MAX_INPUT = 16 * 1024 * 1024;
const MAX_DEPTH = 128;
const MAX_FIELDS = 100000;

type PNode = number | string | boolean | null | PNode[] | { [k: string]: PNode };

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'json');
    const inputFormat = String(opts.inputFormat ?? 'auto');

    const bytes = await readBytes(input, inputFormat);

    const warnings: string[] = [];
    const wireCounts: Record<number, number> = {};
    let total = 0;

    const decoded = decodeMessage(bytes, 0, 0, wireCounts, warnings);
    total = decoded.next;

    if (total < bytes.length) {
      warnings.push('Trailing ' + (bytes.length - total) + ' byte(s) after the top-level message.');
    }

    const json = JSON.stringify(decoded.value, null, 2);

    if (view === 'fields') {
      const rows = Object.entries(wireCounts).map(([k, v]) => [wireName(Number(k)), String(v)]);
      rows.push(['total fields', String(countFields(decoded.value))]);
      return renderTable(
        ['wire type', 'count'],
        rows,
        'Protobuf field breakdown',
        ['JSON: ' + json],
        warnings,
      );
    }

    return {
      outputs: [],
      report: { output: json, render: 'code' },
      notes: [
        'Decoded ' + countFields(decoded.value) + ' field(s) from ' + bytes.length + ' byte(s).',
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
      stats: { bytes: bytes.length, fields: countFields(decoded.value) },
    };
  },
};

function decodeMessage(
  buf: Uint8Array,
  o: number,
  depth: number,
  wireCounts: Record<number, number>,
  warnings: string[],
): { value: PNode; next: number } {
  if (depth > MAX_DEPTH) throw new ToolError('Protobuf nesting is too deep.');
  const out: Record<string, PNode[]> = {};
  let fields = 0;

  while (o < buf.length) {
    if (fields++ > MAX_FIELDS) throw new ToolError('Protobuf message has too many fields.');
    const key = readVarint(buf, o);
    if (key.value <= 0) throw new ToolError('Invalid protobuf field key.');
    o = key.next;
    const fieldNumber = key.value >> 3;
    const wireType = key.value & 7;
    wireCounts[wireType] = (wireCounts[wireType] ?? 0) + 1;

    let val: PNode;
    if (wireType === 0) {
      const r = readVarint(buf, o);
      o = r.next;
      val = r.value > 0x7fffffff ? r.value : signed(r.value);
    } else if (wireType === 1) {
      if (o + 8 > buf.length) throw new ToolError('Truncated 64-bit field.');
      const lo = readLE32(buf, o);
      const hi = readLE32(buf, o + 4);
      o += 8;
      if (hi === 0x3ff00000 && lo === 0) val = 1;
      else if (hi === 0) val = lo;
      else val = '0x' + hi.toString(16) + ' ' + lo.toString(16);
    } else if (wireType === 2) {
      const len = readVarint(buf, o);
      o = len.next;
      if (o + len.value > buf.length)
        throw new ToolError('Length-delimited field overruns the input.');
      const chunk = buf.subarray(o, o + len.value);
      o += len.value;
      val = asText(chunk);
    } else if (wireType === 3) {
      const sub = decodeMessage(buf, o, depth + 1, wireCounts, warnings);
      val = sub.value as PNode;
      o = sub.next;
    } else if (wireType === 4) {
      break;
    } else if (wireType === 5) {
      if (o + 4 > buf.length) throw new ToolError('Truncated 32-bit field.');
      val = readLE32(buf, o);
      o += 4;
    } else {
      throw new ToolError('Unsupported protobuf wire type ' + wireType + '.');
    }

    const keyStr = String(fieldNumber);
    if (!out[keyStr]) out[keyStr] = [];
    out[keyStr].push(val);
  }

  const flat: { [k: string]: PNode } = {};
  for (const k of Object.keys(out)) {
    const arr = out[k] ?? [];
    flat[k] = arr.length === 1 ? (arr[0] ?? null) : arr;
  }
  return { value: flat as PNode, next: o };
}

function readVarint(buf: Uint8Array, o: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  while (true) {
    if (o >= buf.length) throw new ToolError('Truncated protobuf varint.');
    const b = buf[o] ?? 0;
    o += 1;
    result |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
    if (shift > 63) throw new ToolError('Protobuf varint is too long.');
  }
  return { value: result, next: o };
}

function signed(v: number): number {
  return v < 2 ** 63 ? v : v - 2 ** 64;
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

function asText(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  try {
    const t = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    let printable = true;
    for (let i = 0; i < t.length; i += 1) {
      const c = t.charCodeAt(i);
      if (c !== 0 && c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) {
        printable = false;
        break;
      }
    }
    if (printable) return t;
  } catch {
    // fall through to hex
  }
  return hex(bytes);
}

function hex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return s;
}

function countFields(v: PNode): number {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 0;
  let n = 0;
  for (const k of Object.keys(v)) {
    n += 1;
    const c = v[k];
    if (Array.isArray(c)) {
      for (const item of c) {
        if (item && typeof item === 'object' && !Array.isArray(item)) n += countFields(item);
      }
    } else if (c && typeof c === 'object' && !Array.isArray(c)) {
      n += countFields(c);
    }
  }
  return n;
}

function wireName(t: number): string {
  switch (t) {
    case 0:
      return 'varint';
    case 1:
      return '64-bit';
    case 2:
      return 'length-delimited';
    case 3:
      return 'start-group';
    case 4:
      return 'end-group';
    case 5:
      return '32-bit';
    default:
      return 'wire type ' + t;
  }
}

async function readBytes(input: FileRunInput, inputFormat: string): Promise<Uint8Array> {
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    if (!file) throw new ToolError('No file was provided.');
    if (file.size > MAX_INPUT) throw new ToolError('File is too large to decode in the browser.');
    return new Uint8Array(await file.arrayBuffer());
  }
  const text = String(input.text ?? '').trim();
  if (text.length === 0) throw new ToolError('Paste a protobuf byte sequence or drop in a file.');
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
