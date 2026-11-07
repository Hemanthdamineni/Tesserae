import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './flatbuffers-inspector.meta';

/**
 * FlatBuffers binary message inspector.
 *
 * Reads the 32-bit root table offset, detects an optional four-character file
 * identifier, and walks the root table and its vtable to report the vtable and
 * table sizes, the field count, and each field offset. Flags structural
 * problems such as an out-of-bounds root offset or a vtable pointing before
 * the start. Expected values come from the byte-exact fixture, never from this
 * parser.
 */

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_FIELDS = 4096;

interface FieldRef {
  index: number;
  offset: number;
  tablePos: number;
}

interface Model {
  rootOffset: number;
  identifier: string | null;
  vtableSize: number;
  tableSize: number;
  fieldCount: number;
  fields: FieldRef[];
  vtablePos: number;
  tablePos: number;
}

function u16(bytes: Uint8Array, at: number): number {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getUint16(at, true);
}

function u32(bytes: Uint8Array, at: number): number {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getUint32(at, true);
}

function i32(bytes: Uint8Array, at: number): number {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getInt32(at, true);
}

function isPrintableId(bytes: Uint8Array, at: number): boolean {
  for (let i = 0; i < 4; i += 1) {
    const b = bytes[at + i];
    if (b === undefined || b < 0x20 || b > 0x7e) return false;
  }
  return true;
}

function parseFlatBuffer(bytes: Uint8Array): Model {
  if (bytes.length < 4) throw new ToolError('That file is too short to be a FlatBuffers message.');

  const rootOffset = u32(bytes, 0);
  // detect an optional file identifier
  let identifier: string | null = null;
  let tablePos = rootOffset;
  if (bytes.length >= 8 && isPrintableId(bytes, 4)) {
    identifier = String.fromCharCode(bytes[4] ?? 0, bytes[5] ?? 0, bytes[6] ?? 0, bytes[7] ?? 0);
    tablePos = 4 + rootOffset;
  }

  if (tablePos < 0 || tablePos + 4 > bytes.length) {
    throw new ToolError('The root table offset points outside the buffer.');
  }

  const vtableOffset = i32(bytes, tablePos);
  const vtablePos = tablePos + vtableOffset;
  if (vtablePos < 0 || vtablePos + 4 > bytes.length) {
    throw new ToolError('The vtable offset points before the start of the buffer.');
  }

  const vtableSize = u16(bytes, vtablePos);
  const tableSize = u16(bytes, vtablePos + 2);
  if (vtableSize < 4) throw new ToolError('The vtable size is invalid.');
  const fieldCount = Math.floor((vtableSize - 4) / 2);
  if (fieldCount > MAX_FIELDS)
    throw new ToolError('That message declares far too many table fields.');

  const fields: FieldRef[] = [];
  for (let i = 0; i < fieldCount; i += 1) {
    const off = u16(bytes, vtablePos + 4 + i * 2);
    fields.push({ index: i + 1, offset: off, tablePos: tablePos + off });
  }

  return {
    rootOffset,
    identifier,
    vtableSize,
    tableSize,
    fieldCount,
    fields,
    vtablePos,
    tablePos,
  };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'FlatBuffers'],
      ['Root table offset', String(m.rootOffset)],
      ['File identifier', m.identifier ?? '(none)'],
      ['Table position', String(m.tablePos)],
      ['Vtable position', String(m.vtablePos)],
      ['Vtable size', String(m.vtableSize)],
      ['Table size', String(m.tableSize)],
      ['Fields', String(m.fieldCount)],
    ],
  };
}

function tableFields(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.fields.slice(0, max) : [];
  return {
    headers: ['Field', 'Offset', 'Position'],
    rows: shown.map((f) => [String(f.index), String(f.offset), String(f.tablePos)]),
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(50000, Number(options.maxRows ?? 100) || 0));

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No file was provided.', 'Choose a FlatBuffers binary message to inspect.');
  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 64 MB.');

  const bytes = new Uint8Array(await source.arrayBuffer());
  const m = parseFlatBuffer(bytes);

  const table = format === 'fields' ? tableFields(m, maxRows) : tableSummary(m);
  return {
    outputs: [] as OutputFile[],
    report: { output: JSON.stringify(table), render: 'table' },
    notes: ['FlatBuffers message with ' + m.fieldCount + ' table field(s).'],
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
