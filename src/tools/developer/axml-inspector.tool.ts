import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './axml-inspector.meta';

/**
 * AXML (Android binary XML) inspector.
 *
 * An AXML file is a series of chunks: a RES_XML_TYPE header, a string pool,
 * and XML node chunks (namespace, element, CDATA, and the trailing last
 * chunk). Expected values in the tests come from the byte-exact fixture built
 * by the Python generator and confirmed by the `file`(1) reference tool
 * ("Android binary XML"), never from this parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_CHUNKS = 200000;

const XML_TYPE = 0x0003;
const STRING_POOL_TYPE = 0x0001;
const NS_START = 0x0100;
const NS_END = 0x0101;
const ELEMENT_START = 0x0102;
const ELEMENT_END = 0x0103;
const CDATA = 0x0104;
const XML_LAST = 0x0105;

const CHUNK_NAMES: Record<number, string> = {
  0x0100: 'namespace start',
  0x0101: 'namespace end',
  0x0102: 'element start',
  0x0103: 'element end',
  0x0104: 'CDATA',
  0x0105: 'XML last',
};

function u16le(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) + ((b[o + 1] ?? 0) << 8)) >>> 0;
}

function u32le(b: Uint8Array, o: number): number {
  return (u16le(b, o) + u16le(b, o + 2) * 65536) >>> 0;
}

/** Decode a UTF-16LE string with a 1-byte length prefix. */
function readUtf16(b: Uint8Array, o: number): { str: string; next: number } {
  const n = b[o] ?? 0;
  let chars = n;
  let pos = o + 1;
  if (n & 0x80) {
    // 2-byte length
    chars = ((n & 0x7f) << 8) | (b[o + 1] ?? 0);
    pos = o + 2;
  }
  const raw = b.slice(pos, pos + chars * 2);
  let out = '';
  for (let i = 0; i < chars; i += 1) {
    out += String.fromCharCode(u16le(raw, i * 2));
  }
  return { str: out, next: pos + chars * 2 };
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'summary');

    const file = input.files[0];
    if (!file)
      throw new ToolError('Choose an Android binary XML file to inspect.', 'Pick a .axml file.');
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 12) throw new ToolError('File is too short to be an Android binary XML file.');

    const warnings: string[] = [];

    // ---- header ----
    const type = u16le(buf, 0);
    const headerSize = u16le(buf, 2);
    const totalSize = u32le(buf, 4);
    if (type !== XML_TYPE) {
      throw new ToolError(
        'Not an Android binary XML file (missing RES_XML_TYPE header).',
        'An AXML file must start with chunk type 0x0003.',
      );
    }
    if (totalSize !== buf.length)
      warnings.push(
        'Declared file size ' + totalSize + ' does not match the actual ' + buf.length + ' bytes.',
      );

    // ---- string pool ----
    let strings: string[] = [];
    let poolStrings = 0;
    let o = headerSize;
    if (o + 28 <= buf.length) {
      const spType = u16le(buf, o);
      const spHeader = u16le(buf, o + 2);
      poolStrings = u32le(buf, o + 8);
      const spFlags = u32le(buf, o + 16);
      const spStart = u32le(buf, o + 20);
      if (spType === STRING_POOL_TYPE) {
        const isUtf8 = (spFlags & 0x0100) !== 0;
        for (let i = 0; i < poolStrings; i += 1) {
          const off = u32le(buf, o + spHeader + i * 4);
          const abs = o + spStart + off;
          if (abs >= buf.length) {
            warnings.push('String ' + i + ' offset overruns the file.');
            strings.push('(unreadable)');
            continue;
          }
          if (isUtf8) {
            // UTF-8: 2-byte length (chars, bytes), then utf8 bytes
            const nBytes = (buf[abs] ?? 0) & 0x7f;
            const sBytes = buf.slice(abs + 2, abs + 2 + nBytes);
            let s = '';
            try {
              s = new TextDecoder('utf-8').decode(sBytes);
            } catch {
              s = '(undecodable)';
            }
            strings.push(s);
          } else {
            const { str } = readUtf16(buf, abs);
            strings.push(str);
          }
        }
      } else {
        warnings.push(
          'String pool chunk not found after the header (type 0x' + spType.toString(16) + ').',
        );
      }
    }

    // ---- walk XML chunks ----
    let elements = 0;
    let attributes = 0;
    let namespaces = 0;
    const chunkRows: string[][] = [];
    let lastSeen = false;
    let guard = 0;
    o = headerSize;
    while (o + 8 <= buf.length && guard++ < MAX_CHUNKS) {
      const ctype = u16le(buf, o);
      const csize = u32le(buf, o + 4);
      if (csize < 8 || o + csize > buf.length) {
        warnings.push(
          'Chunk at offset ' + o + ' (type 0x' + ctype.toString(16) + ') overruns the file.',
        );
        break;
      }
      if (ctype === STRING_POOL_TYPE) {
        o += csize;
        continue;
      }
      if (ctype === NS_START || ctype === NS_END) {
        namespaces += 1;
        const ns = u32le(buf, o + 8);
        const prefix = u32le(buf, o + 12);
        chunkRows.push([
          String(o),
          CHUNK_NAMES[ctype] ?? '0x' + ctype.toString(16),
          'ns=' + String(ns) + ' prefix=' + String(prefix),
        ]);
        o += csize;
        continue;
      }
      if (ctype === ELEMENT_START) {
        elements += 1;
        // header(8) + node line(4) comment(4) + attrExt ns(4) name(4) attrStart(2) attrSize(2) attrCount(2)
        const ns = u32le(buf, o + 16);
        const name = u32le(buf, o + 20);
        const attrCount = u16le(buf, o + 28);
        attributes += attrCount;
        const nameStr = name >= 0 && name < strings.length ? strings[name] : '#undefined';
        const nsStr = ns >= 0 && ns < strings.length ? strings[ns] : '#undefined';
        chunkRows.push([
          String(o),
          'element start',
          String(elements) +
            '. ' +
            nameStr +
            ' (' +
            String(attrCount) +
            ' attr) ns=' +
            (nsStr !== '#undefined' ? nsStr : 'global'),
        ]);
        o += csize;
        continue;
      }
      if (ctype === ELEMENT_END) {
        // header(8) + line(4) comment(4) + ns(4) name(4)
        const name = u32le(buf, o + 16);
        const nameStr = name >= 0 && name < strings.length ? strings[name] : '#undefined';
        chunkRows.push([String(o), 'element end', String(elements) + '. ' + nameStr]);
        o += csize;
        continue;
      }
      if (ctype === CDATA) {
        chunkRows.push([String(o), 'CDATA', '']);
        o += csize;
        continue;
      }
      if (ctype === XML_LAST) {
        lastSeen = true;
        chunkRows.push([String(o), 'XML last', '']);
        o += csize;
        break;
      }
      warnings.push('Unknown chunk type 0x' + ctype.toString(16) + ' at offset ' + o + '.');
      o += csize;
    }
    if (o < buf.length) warnings.push('Trailing bytes after the last chunk at offset ' + o + '.');
    if (!lastSeen) warnings.push('The XML last chunk (0x0105) was not found.');

    // ---- views ----
    if (view === 'strings') {
      const rows = strings.map((s, i) => [String(i), s]);
      return renderTable(['index', 'string'], rows, 'AXML string pool', undefined, warnings);
    }

    if (view === 'chunks') {
      return renderTable(
        ['offset', 'chunk', 'detail'],
        chunkRows,
        'AXML chunks',
        undefined,
        warnings,
      );
    }

    // summary
    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['Chunk type', '0x0003 (RES_XML_TYPE)'],
      ['String pool count', String(poolStrings)],
      ['Elements', String(elements)],
      ['Attributes', String(attributes)],
      ['Namespaces', String(namespaces)],
      ['Last chunk', lastSeen ? 'present' : 'missing'],
    ];

    return renderTable(['field', 'value'], summary, 'AXML summary', undefined, warnings);
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
