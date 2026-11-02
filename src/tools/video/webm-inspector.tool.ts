import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './webm-inspector.meta';

/**
 * Matroska / WebM (EBML) inspector.
 *
 * A Matroska or WebM file is a sequence of EBML elements, each an
 * (element ID, element size, payload) triple. The element ID and size are
 * variable-length fields whose first byte carries a leading-one marker that
 * encodes the field width. The expected values in the tests come from the
 * byte-exact fixture built by the Python generator and confirmed by the
 * `file`(1) reference tool ("WebM"), never from this parser.
 */

const MAX_BYTES = 512 * 1024 * 1024;

const ELEMENT_NAMES: Record<number, string> = {
  0x1a45dfa3: 'EBML',
  0x4286: 'EBMLVersion',
  0x42f7: 'EBMLReadVersion',
  0x42f2: 'EBMLMaxIDLength',
  0x42f3: 'EBMLMaxSizeLength',
  0x4282: 'DocType',
  0x4287: 'DocTypeVersion',
  0x4285: 'DocTypeReadVersion',
  0x18538067: 'Segment',
  0x1549a966: 'Info',
  0x2ad7b1: 'TimestampScale',
  0x4d80: 'MuxingApp',
  0x5741: 'WritingApp',
  0x73a4: 'SegmentUID',
  0x4489: 'Duration',
  0x1f43b675: 'Cluster',
  0x1f43b668: 'ClusterTimestamp',
  0xa0: 'BlockGroup',
  0xa1: 'Block',
  0xa7: 'SimpleBlock',
  0xe7: 'ClusterTimestampOld',
  0x1654ae6b: 'Tracks',
  0xae: 'TrackEntry',
  0xd7: 'TrackNumber',
  0x73c5: 'TrackUID',
  0x83: 'TrackType',
  0x86: 'CodecID',
};

const MASTER_IDS = new Set<number>([
  0x1a45dfa3, 0x18538067, 0x1549a966, 0x1f43b675, 0xa0, 0x1654ae6b, 0xae,
]);

interface Element {
  id: number;
  name: string;
  size: number;
  depth: number;
  dataStart: number;
  type: 'master' | 'value';
  intVal?: string;
  strVal?: string;
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'summary');

    const file = input.files[0];
    if (!file)
      throw new ToolError(
        'Choose a WebM or Matroska (.mkv) file to inspect.',
        'Pick a .webm or .mkv file.',
      );
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 1) throw new ToolError('File is empty.');

    const warnings: string[] = [];
    const elements: Element[] = [];

    const readId = (o: number): { value: number; next: number; length: number } => {
      const b = buf[o] ?? 0;
      let mask = 0x80;
      let n = 1;
      while ((b & mask) === 0 && n < 4) {
        mask >>= 1;
        n += 1;
      }
      let value = b;
      for (let i = 1; i < n; i += 1) value = (value << 8) | (buf[o + i] ?? 0);
      return { value, next: o + n, length: n };
    };

    const readSize = (o: number): { value: number; next: number; length: number } => {
      const b = buf[o] ?? 0;
      let mask = 0x80;
      let n = 1;
      while ((b & mask) === 0 && n < 8) {
        mask >>= 1;
        n += 1;
      }
      if ((b & mask) === 0) throw new ToolError('Could not decode the EBML size field.');
      let value = b & (mask - 1);
      for (let i = 1; i < n; i += 1) value = (value << 8) | (buf[o + i] ?? 0);
      return { value, next: o + n, length: n };
    };

    // Walk the top-level element tree, treating known master elements as containers.
    const walk = (start: number, depth: number, limit: number, maxDepth: number): number => {
      let o = start;
      while (o < limit) {
        if (o + 4 > buf.length) break;
        const idInfo = readId(o);
        const sizeInfo = readSize(idInfo.next);
        const dataStart = sizeInfo.next;
        const size = sizeInfo.value;
        if (dataStart + size > buf.length) {
          warnings.push('Element at offset ' + o + ' overruns the end of the file.');
          break;
        }
        const name = ELEMENT_NAMES[idInfo.value] ?? '0x' + idInfo.value.toString(16);
        const isMaster = MASTER_IDS.has(idInfo.value);
        const el: Element = {
          id: idInfo.value,
          name,
          size,
          depth,
          dataStart,
          type: isMaster ? 'master' : 'value',
        };
        if (!isMaster) {
          const text = textOf(buf, dataStart, size);
          if (text !== undefined) el.strVal = text;
          else if (size <= 8) el.intVal = '0x' + hexOf(buf, dataStart, size);
        }
        elements.push(el);
        if (isMaster && depth < maxDepth) {
          walk(dataStart, depth + 1, dataStart + size, maxDepth);
          o = dataStart + size;
        } else {
          o = dataStart + size;
        }
      }
      return o;
    };

    let rootId = 0;
    try {
      const r = readId(0);
      rootId = r.value;
      walk(0, 0, buf.length, 32);
    } catch (e) {
      if (e instanceof ToolError) throw e;
      throw new ToolError('Not a valid Matroska or WebM file (unreadable EBML structure).');
    }

    if (rootId !== 0x1a45dfa3) {
      throw new ToolError(
        'Not a Matroska or WebM file (missing the EBML header element).',
        'A WebM or MKV starts with the EBML element ID 0x1A45DFA3.',
      );
    }

    // Extract key values
    let doctype = 'unknown';
    let doctypeVersion = 0;
    let doctypeReadVersion = 0;
    let hasSegment = false;
    for (const el of elements) {
      if (el.name === 'DocType' && el.strVal) doctype = el.strVal;
      else if (el.name === 'DocTypeVersion' && el.intVal) doctypeVersion = parseInt(el.intVal, 16);
      else if (el.name === 'DocTypeReadVersion' && el.intVal)
        doctypeReadVersion = parseInt(el.intVal, 16);
      else if (el.name === 'Segment') hasSegment = true;
    }

    const masterCount = elements.filter((e) => e.type === 'master').length;

    if (view === 'tree') {
      const rows = elements.map((el) => [
        '  '.repeat(el.depth) + el.name,
        el.type,
        String(el.size),
        el.strVal !== undefined ? '"' + el.strVal + '"' : (el.intVal ?? ''),
      ]);
      return renderTable(
        ['element', 'type', 'size', 'value'],
        rows,
        'WebM/Matroska EBML element tree',
        undefined,
        warnings,
      );
    }

    if (view === 'header') {
      const rows = elements
        .filter((el) => el.depth <= 1 || el.name === 'Info')
        .map((el) => [
          '  '.repeat(el.depth) + el.name,
          String(el.size),
          el.strVal !== undefined ? '"' + el.strVal + '"' : (el.intVal ?? ''),
        ]);
      return renderTable(['element', 'size', 'value'], rows, 'EBML header', undefined, warnings);
    }

    // summary
    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['Document type', doctype],
      ['DocTypeVersion', doctypeVersion > 0 ? String(doctypeVersion) : 'n/a'],
      ['DocTypeReadVersion', doctypeReadVersion > 0 ? String(doctypeReadVersion) : 'n/a'],
      ['Top-level EBML header', 'present'],
      ['Segment', hasSegment ? 'present' : 'missing'],
      ['Elements parsed', String(elements.length)],
      ['Master elements', String(masterCount)],
    ];

    const notes: string[] = [];
    if (doctype !== 'unknown') notes.push('Document type: ' + doctype + '.');
    if (elements.some((e) => e.name === 'Info')) notes.push('The Segment contains an Info block.');

    return renderTable(['field', 'value'], summary, 'WebM/Matroska summary', notes, warnings);
  },
};

function textOf(buf: Uint8Array, start: number, size: number): string | undefined {
  if (size === 0) return undefined;
  let printable = true;
  for (let i = 0; i < size; i += 1) {
    const c = buf[start + i] ?? 0;
    if (c < 0x20 || c > 0x7e) {
      printable = false;
      break;
    }
  }
  if (!printable) return undefined;
  let s = '';
  for (let i = 0; i < size; i += 1) s += String.fromCharCode(buf[start + i] ?? 0);
  return s;
}

function hexOf(buf: Uint8Array, start: number, size: number): string {
  let s = '';
  for (let i = 0; i < size; i += 1) {
    s += (buf[start + i] ?? 0).toString(16).padStart(2, '0');
  }
  return s;
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
