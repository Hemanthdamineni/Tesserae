import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './avro-inspector.meta';

/**
 * Apache Avro object-container-file inspector.
 *
 * An Avro OCF starts with the magic "Obj\x01", then a file-metadata map
 * (an Avro map of string to bytes holding the writer schema and codec), then
 * a 16-byte sync marker, then a sequence of data blocks. Each block is a
 * zigzag-varint record count, a zigzag-varint byte size, the serialized
 * records, and another copy of the sync marker. The expected values come from
 * the byte-exact fixture built by the Python encoder and confirmed by the
 * reference tool `file`(1) and an independent OCF decoder, never from this
 * parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_ROWS = 5000;

const AVRO_MAGIC = [0x4f, 0x62, 0x6a, 0x01];

interface Block {
  index: number;
  count: number;
  size: number;
  syncOk: boolean;
}

interface Model {
  schema: string;
  codec: string;
  sync: Uint8Array;
  blocks: Block[];
}

function parseAvro(bytes: Uint8Array): Model {
  if (bytes.length < 24)
    throw new ToolError('That file is too short to be an Avro object-container file.');
  if (AVRO_MAGIC.some((v, i) => bytes[i] !== v)) {
    throw new ToolError(
      'That file is not an Apache Avro object-container file.',
      'An Avro OCF starts with the 4 bytes "Obj\\x01".',
    );
  }

  const reader = new Reader(bytes);
  let o = 4;

  // File metadata map
  let schema = '';
  let codec = 'null';
  let mapCount = reader.zlong(o);
  o = reader.next;
  let guard = 0;
  while (mapCount !== 0) {
    if (guard++ > 10000) throw new ToolError('The Avro metadata map has too many entries.');
    let n = mapCount < 0 ? -mapCount : mapCount;
    if (mapCount < 0) {
      // negative count is followed by a block byte size, ignored here
      o = reader.nextAfterLong(o);
    }
    for (let i = 0; i < n; i += 1) {
      const key = reader.avroString(o);
      o = key.next;
      const val = reader.avroBytes(o);
      o = val.next;
      if (key.text === 'avro.schema') schema = new TextDecoder('utf-8').decode(val.bytes);
      else if (key.text === 'avro.codec') codec = new TextDecoder('utf-8').decode(val.bytes);
    }
    mapCount = reader.zlong(o);
    o = reader.next;
  }

  if (o + 16 > bytes.length) throw new ToolError('The Avro file is missing its sync marker.');
  const sync = bytes.slice(o, o + 16);
  o += 16;

  // Data blocks
  const blocks: Block[] = [];
  let index = 0;
  while (o < bytes.length) {
    const count = reader.zlong(o);
    o = reader.next;
    if (count === 0) break;
    const size = reader.zlong(o);
    o = reader.next;
    if (o + size > bytes.length) {
      throw new ToolError('An Avro data block overruns the end of the file.');
    }
    o += size;
    let syncOk = false;
    if (o + 16 <= bytes.length) {
      syncOk = equal(bytes.slice(o, o + 16), sync);
      o += 16;
    }
    blocks.push({ index: index++, count, size, syncOk });
  }

  return { schema, codec, sync, blocks };
}

class Reader {
  readonly b: Uint8Array;
  next = 0;

  constructor(b: Uint8Array) {
    this.b = b;
  }

  zlong(at: number): number {
    let result = 0;
    let shift = 0;
    let o = at;
    let guard = 0;
    while (true) {
      if (o >= this.b.length) throw new ToolError('Truncated Avro long.');
      const b = this.b[o] ?? 0;
      o += 1;
      result |= (b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7;
      if (guard++ > 20) throw new ToolError('Avro long is too long.');
    }
    this.next = o;
    return (result >> 1) ^ -(result & 1);
  }

  nextAfterLong(at: number): number {
    this.zlong(at);
    return this.next;
  }

  avroString(at: number): { text: string; next: number } {
    const n = this.zlong(at);
    const start = this.next;
    const end = start + n;
    if (end > this.b.length) throw new ToolError('Truncated Avro string.');
    this.next = end;
    return { text: new TextDecoder('utf-8').decode(this.b.subarray(start, end)), next: end };
  }

  avroBytes(at: number): { bytes: Uint8Array; next: number } {
    const n = this.zlong(at);
    const start = this.next;
    const end = start + n;
    if (end > this.b.length) throw new ToolError('Truncated Avro bytes value.');
    this.next = end;
    return { bytes: this.b.subarray(start, end), next: end };
  }
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function hex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return s;
}

function formatBytes(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KiB';
  return (n / (1024 * 1024)).toFixed(1) + ' MiB';
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const badSync = m.blocks.filter((b) => !b.syncOk).length;
  const total = m.blocks.reduce((s, b) => s + b.count, 0);
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'Apache Avro object-container file'],
      ['Codec', m.codec],
      [
        'Schema',
        m.schema === '' ? '(none)' : m.schema.slice(0, 48) + (m.schema.length > 48 ? '...' : ''),
      ],
      ['Sync marker', hex(m.sync)],
      ['Data blocks', String(m.blocks.length)],
      ['Total records', String(total)],
      ['Sync mismatches', String(badSync)],
    ],
  };
}

function tableSchema(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Field', 'Value'],
    rows: [
      ['Codec', m.codec],
      ['Schema', m.schema],
      ['Sync marker', hex(m.sync)],
    ],
  };
}

function tableBlocks(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.blocks.slice(0, max) : [];
  return {
    headers: ['#', 'Records', 'Block size', 'Sync ok'],
    rows: shown.map((b) => [
      String(b.index),
      String(b.count),
      formatBytes(b.size),
      b.syncOk ? 'yes' : 'no',
    ]),
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(MAX_ROWS, Number(options.maxRows ?? 100) || 0));
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No file was provided.', 'Choose an Avro data file to inspect.');
  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 256 MB.');

  const bytes = new Uint8Array(await source.arrayBuffer());
  const m = parseAvro(bytes);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'schema':
      table = tableSchema(m);
      break;
    case 'blocks':
      table = tableBlocks(m, maxRows);
      break;
    case 'summary':
    default:
      table = tableSummary(m);
  }

  return {
    outputs: [] as OutputFile[],
    report: { output: JSON.stringify(table), render: 'table' },
    notes: [
      'Avro ' +
        m.blocks.length +
        ' block(s), codec ' +
        m.codec +
        ', ' +
        m.blocks.reduce((s, b) => s + b.count, 0) +
        ' record(s).',
    ],
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { blocks: m.blocks.length, records: m.blocks.reduce((s, b) => s + b.count, 0) },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
