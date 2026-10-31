import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './dicom-inspector.meta';

/**
 * DICOM inspector.
 *
 * Parses a DICOM part 10 file: the 128-byte preamble, the DICM prefix, the
 * meta information group (0002) and the data set. Expected values in the
 * tests come from the `file`(1) reference tool and a byte-level element
 * walk, never from this parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_ELEMENTS = 20000;

/** VRs that use a 2-byte reserved field + 4-byte length in Explicit VR. */
const LONG_VR = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN']);

const DICM = 'DICM';

function readU16LE(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) + ((b[o + 1] ?? 0) << 8)) >>> 0;
}

function readU32LE(b: Uint8Array, o: number): number {
  return (readU16LE(b, o) + readU16LE(b, o + 2) * 65536) >>> 0;
}

/** Read up to maxLen bytes of a (possibly NUL-padded) string value. */
function readText(b: Uint8Array, o: number, maxLen: number): string {
  let out = '';
  const lim = Math.min(b.length, o + Math.min(maxLen, 40));
  for (let i = o; i < lim; i += 1) {
    const by = b[i] ?? 0;
    if (by === 0) break;
    out += by >= 32 && by <= 126 ? String.fromCharCode(by) : '.';
  }
  return out;
}

function hex4(v: number): string {
  return v.toString(16).padStart(4, '0').toUpperCase();
}

/** Tag dictionary for a small set of commonly read DICOM attributes. */
const KNOWN: Record<string, string> = {
  '0008,0005': 'Specific Character Set',
  '0008,0008': 'Image Type',
  '0008,0012': 'Instance Creation Date',
  '0008,0016': 'SOP Class UID',
  '0008,0018': 'SOP Instance UID',
  '0008,0020': 'Study Date',
  '0008,0030': 'Study Time',
  '0008,0050': 'Accession Number',
  '0008,0060': 'Modality',
  '0008,0070': 'Manufacturer',
  '0008,1030': 'Study Description',
  '0008,103E': 'Series Description',
  '0010,0010': 'Patient Name',
  '0010,0020': 'Patient ID',
  '0010,0030': 'Patient Birth Date',
  '0010,0040': 'Patient Sex',
  '0018,0050': 'Slice Thickness',
  '0020,000D': 'Study Instance UID',
  '0020,000E': 'Series Instance UID',
  '0020,0013': 'Instance Number',
  '0028,0010': 'Rows',
  '0028,0011': 'Columns',
  '0028,0030': 'Pixel Spacing',
  '0028,0100': 'Bits Allocated',
  '0028,0101': 'Bits Stored',
  '0028,0102': 'High Bit',
  '0028,0103': 'Pixel Representation',
  '7FE0,0010': 'Pixel Data',
};

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'elements');

    const file = input.files[0];
    if (!file)
      throw new ToolError('Choose a DICOM file to inspect.', 'Pick a .dcm or .dicom file.');
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 132) throw new ToolError('File is too short to be a DICOM object.');

    // ---- preamble + DICM prefix ----
    const preamble = Array.from(buf.subarray(0, 128));
    const preambleNonZero = preamble.some((b) => b !== 0);
    const dicmText = String.fromCharCode(
      buf[128] ?? 0,
      buf[129] ?? 0,
      buf[130] ?? 0,
      buf[131] ?? 0,
    );
    if (dicmText !== DICM) {
      throw new ToolError(
        'Not a DICOM object (missing DICM prefix).',
        'A DICOM file must contain the bytes "DICM" at offset 128.',
      );
    }

    // ---- walk elements: meta group (0002) then data set ----
    interface El {
      offset: number;
      tag: string;
      vr: string;
      length: number;
      value: string;
      name: string;
      meta: boolean;
    }
    const els: El[] = [];
    let transferSyntax = '';
    let pixelDataLen = 0;
    let groupLenMismatch = false;

    let o = 132;
    let inMeta = true;
    let guard = 0;
    while (o < buf.length && els.length < MAX_ELEMENTS && guard++ < 200000) {
      if (o + 4 > buf.length) break;
      const group = readU16LE(buf, o);
      const element = readU16LE(buf, o + 2);
      if (group === 0xfffe) break; // sequence delimiters
      const tagStr = hex4(group) + ',' + hex4(element);

      // explicit VR: bytes at o+4..o+6 are the VR; implicit VR would have a
      // numeric-looking 4-byte group here. Check whether bytes 4..6 are a VR.
      const isExplicit =
        inMeta ||
        transferSyntax === '1.2.840.10008.1.2.1' ||
        transferSyntax === '1.2.840.10008.1.2.1.99' ||
        transferSyntax === '1.2.840.10008.1.2.2';
      const vrA = String.fromCharCode(buf[o + 4] ?? 0);
      const vrB = String.fromCharCode(buf[o + 5] ?? 0);
      const isVR = /[A-Z]{2}/.test(vrA + vrB);
      let vr = 'UN';
      let length: number;
      let valueOff: number;
      if (isExplicit && isVR) {
        vr = vrA + vrB;
        if (LONG_VR.has(vr)) {
          if (o + 12 > buf.length) break;
          length = readU32LE(buf, o + 8);
          valueOff = o + 12;
        } else {
          if (o + 8 > buf.length) break;
          length = readU16LE(buf, o + 6);
          valueOff = o + 8;
        }
      } else {
        // implicit VR little endian
        if (o + 8 > buf.length) break;
        length = readU32LE(buf, o + 4);
        valueOff = o + 8;
      }
      if (valueOff + length > buf.length) {
        els.push({
          offset: o,
          tag: tagStr,
          vr,
          length,
          value: '<TRUNCATED>',
          name: KNOWN[tagStr] ?? '',
          meta: inMeta,
        });
        break;
      }

      let value = '';
      if (length > 0 && valueOff < buf.length) {
        value = readText(buf, valueOff, length);
      }
      if (tagStr === '7FE0,0010') pixelDataLen = length;
      if (tagStr === '0002,0010') transferSyntax = value;
      if (group === 0x0002 && element === 0x0000) {
        // group length element; its value should equal (bytes in group after this element)
      }
      els.push({
        offset: o,
        tag: tagStr,
        vr,
        length,
        value,
        name: KNOWN[tagStr] ?? '',
        meta: group === 0x0002,
      });
      o = valueOff + length;
    }

    // ---- findings ----
    const warnings: string[] = [];
    if (preambleNonZero) warnings.push('Preamble is not all zeroes (may indicate a wrapped file).');
    if (groupLenMismatch) warnings.push('Meta group length does not match the parsed elements.');

    // ---- views ----
    if (view === 'meta') {
      const rows = els
        .filter((e) => e.meta)
        .map((e) => [e.tag, e.vr, String(e.length), e.value, e.name || KNOWN[e.tag] || '']);
      return renderTable(
        ['tag', 'VR', 'length', 'value', 'name'],
        rows,
        'DICOM meta information group (0002)',
      );
    }

    if (view === 'elements') {
      const rows = els.map((e) => [
        e.tag,
        e.vr,
        String(e.length),
        e.value,
        e.name || KNOWN[e.tag] || (e.meta ? 'meta' : ''),
      ]);
      return renderTable(['tag', 'VR', 'length', 'value', 'name'], rows, 'DICOM data elements');
    }

    // summary view
    const find = (t: string): string | undefined => els.find((e) => e.tag === t)?.value;
    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['Preamble', preambleNonZero ? 'non-zero' : 'all zero'],
      ['DICM prefix', 'present'],
      ['Transfer syntax', transferSyntax || '(none)'],
      ['SOP Class UID', find('0008,0016') || '-'],
      ['Modality', find('0008,0060') || '-'],
      ['Patient name', find('0010,0010') || '-'],
      ['Patient ID', find('0010,0020') || '-'],
      ['Patient sex', find('0010,0040') || '-'],
      ['Study date', find('0008,0020') || '-'],
      ['Study UID', find('0020,000D') || '-'],
      ['Series UID', find('0020,000E') || '-'],
      ['Rows / Columns', (find('0028,0010') || '?') + ' x ' + (find('0028,0011') || '?')],
      ['Pixel data length', pixelDataLen ? String(pixelDataLen) + ' B' : '-'],
      ['Elements', String(els.length)],
    ];

    const notes: string[] = [];
    if (pixelDataLen > 0)
      notes.push('Contains ' + pixelDataLen + ' bytes of pixel data (7FE0,0010).');

    return renderTable(['field', 'value'], summary, 'DICOM summary', notes, warnings);
  },
};

function renderTable(
  headers: string[],
  rows: string[][],
  title: string,
  notes: string[] = [],
  warnings: string[] = [],
): FileRunResult {
  const output = JSON.stringify({ title, headers, rows });
  return {
    outputs: [] as OutputFile[],
    report: { output, render: 'table' },
    notes: notes.length > 0 ? notes : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { rows: rows.length },
  };
}

export default tool;
