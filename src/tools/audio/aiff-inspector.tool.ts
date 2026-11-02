import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './aiff-inspector.meta';

/**
 * AIFF / AIFF-C (Audio Interchange File Format) inspector.
 *
 * An AIFF file is a big-endian IFF container: a FORM chunk whose type is
 * "AIFF" or "AIFC", followed by a series of sub-chunks (COMM, SSND, NAME,
 * AUTH, ANNO, ...). Each chunk is an ID (4 bytes), a big-endian size, data,
 * and an extra padding byte when the data length is odd. The sample rate in
 * the COMM chunk is an 80-bit IEEE 754 extended float. The expected values
 * come from the byte-exact fixture built by the Python generator and
 * confirmed by the `file`(1) reference tool ("IFF data, AIFF audio"), never
 * from this parser.
 */

const MAX_BYTES = 512 * 1024 * 1024;

interface Chunk {
  id: string;
  size: number;
  dataStart: number;
  text?: string;
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'summary');

    const file = input.files[0];
    if (!file)
      throw new ToolError('Choose an AIFF audio file to inspect.', 'Pick a .aiff or .aifc file.');
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 12) throw new ToolError('File is too short to be an AIFF file.');

    const warnings: string[] = [];
    const ascii4 = (o: number): string => {
      let s = '';
      for (let i = 0; i < 4; i += 1) {
        const c = buf[o + i] ?? 0;
        s += c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : '.';
      }
      return s;
    };

    const formId = ascii4(0);
    if (formId !== 'FORM') {
      throw new ToolError(
        'Not an AIFF file (missing the FORM container).',
        'An AIFF file starts with the 4 bytes "FORM".',
      );
    }
    const formSize =
      ((buf[4] ?? 0) << 24) | ((buf[5] ?? 0) << 16) | ((buf[6] ?? 0) << 8) | (buf[7] ?? 0);
    const formType = ascii4(8);

    if (formType !== 'AIFF' && formType !== 'AIFC') {
      throw new ToolError(
        'Not an AIFF file (unknown form type "' + formType + '").',
        'The FORM type must be "AIFF" or "AIFC".',
      );
    }

    if (formSize + 8 > buf.length)
      warnings.push(
        'The FORM size (' + formSize + ') is larger than the file (' + buf.length + ' bytes).',
      );

    // Walk chunks starting at offset 12
    const chunks: Chunk[] = [];
    let o = 12;
    while (o + 8 <= buf.length) {
      const id = ascii4(o);
      const size =
        ((buf[o + 4] ?? 0) << 24) |
        ((buf[o + 5] ?? 0) << 16) |
        ((buf[o + 6] ?? 0) << 8) |
        (buf[o + 7] ?? 0);
      const dataStart = o + 8;
      if (dataStart + size > buf.length) {
        warnings.push('Chunk "' + id + '" at offset ' + o + ' overruns the end of the file.');
        break;
      }
      const ch: Chunk = { id, size, dataStart };
      if (id === 'NAME' || id === 'AUTH' || id === 'ANNO' || id === 'COMM') {
        const t = textOf(buf, dataStart, size);
        if (t !== undefined) ch.text = t;
      }
      chunks.push(ch);
      o = dataStart + size + (size % 2 === 1 ? 1 : 0);
    }

    // Decode the COMM chunk
    let channels = 0;
    let frames = 0;
    let sampleSize = 0;
    let sampleRate: number | null = null;
    let compression = 'PCM (uncompressed)';
    let hasComm = false;

    const comm = chunks.find((c) => c.id === 'COMM');
    if (comm) {
      hasComm = true;
      channels = ((buf[comm.dataStart] ?? 0) << 8) | (buf[comm.dataStart + 1] ?? 0);
      frames =
        ((buf[comm.dataStart + 2] ?? 0) << 24) |
        ((buf[comm.dataStart + 3] ?? 0) << 16) |
        ((buf[comm.dataStart + 4] ?? 0) << 8) |
        (buf[comm.dataStart + 5] ?? 0);
      sampleSize = ((buf[comm.dataStart + 6] ?? 0) << 8) | (buf[comm.dataStart + 7] ?? 0);
      if (comm.size >= 18) sampleRate = readExtendedFloat(buf, comm.dataStart + 8);
      if (formType === 'AIFC' && comm.size >= 22) {
        compression = ascii4(comm.dataStart + 18);
      }
    }

    const ssnd = chunks.find((c) => c.id === 'SSND');
    const ssndOffset = ssnd
      ? ((buf[ssnd.dataStart] ?? 0) << 24) |
        ((buf[ssnd.dataStart + 1] ?? 0) << 16) |
        ((buf[ssnd.dataStart + 2] ?? 0) << 8) |
        (buf[ssnd.dataStart + 3] ?? 0)
      : -1;
    const ssndBlockSize = ssnd
      ? ((buf[ssnd.dataStart + 4] ?? 0) << 24) |
        ((buf[ssnd.dataStart + 5] ?? 0) << 16) |
        ((buf[ssnd.dataStart + 6] ?? 0) << 8) |
        (buf[ssnd.dataStart + 7] ?? 0)
      : -1;
    const ssndDataSize = ssnd ? ssnd.size - 8 : 0;

    if (!hasComm) warnings.push('No COMM chunk was found; the audio parameters are unknown.');
    if (!ssnd) warnings.push('No SSND (sound data) chunk was found.');

    if (view === 'chunks') {
      const rows = chunks.map((c) => [
        c.id,
        String(c.size),
        c.text !== undefined ? '"' + c.text + '"' : '',
      ]);
      return renderTable(['chunk', 'size', 'text'], rows, 'AIFF chunks', undefined, warnings);
    }

    // summary
    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['FORM type', formType],
      ['FORM size', String(formSize) + ' B'],
      ['Chunks', String(chunks.length)],
      ['Channels', hasComm ? String(channels) : 'n/a'],
      ['Sample frames', hasComm ? String(frames) : 'n/a'],
      ['Sample size', hasComm ? String(sampleSize) + ' bit' : 'n/a'],
      ['Sample rate', sampleRate !== null ? String(sampleRate) + ' Hz' : 'n/a'],
      ['Compression', compression],
      [
        'Sound data',
        ssnd
          ? String(ssndDataSize) + ' B (offset ' + ssndOffset + ', block ' + ssndBlockSize + ')'
          : 'none',
      ],
    ];

    const notes: string[] = [];
    if (comm?.text) notes.push('COMM: ' + comm.text + '.');
    const nameChunk = chunks.find((c) => c.id === 'NAME');
    if (nameChunk?.text) notes.push('Title: ' + nameChunk.text + '.');
    const authChunk = chunks.find((c) => c.id === 'AUTH');
    if (authChunk?.text) notes.push('Author: ' + authChunk.text + '.');

    return renderTable(['field', 'value'], summary, 'AIFF summary', notes, warnings);
  },
};

function readExtendedFloat(buf: Uint8Array, o: number): number {
  // 80-bit IEEE 754 extended: 1 sign + 15 exponent + 64 mantissa
  const se = ((buf[o] ?? 0) << 8) | (buf[o + 1] ?? 0);
  const sign = (se & 0x8000) !== 0 ? -1 : 1;
  const exp = se & 0x7fff;
  const mant =
    (buf[o + 2] ?? 0) * 2 ** 56 +
    (buf[o + 3] ?? 0) * 2 ** 48 +
    (buf[o + 4] ?? 0) * 2 ** 40 +
    (buf[o + 5] ?? 0) * 2 ** 32 +
    (buf[o + 6] ?? 0) * 2 ** 24 +
    (buf[o + 7] ?? 0) * 2 ** 16 +
    (buf[o + 8] ?? 0) * 2 ** 8 +
    (buf[o + 9] ?? 0);
  if (exp === 0 && mant === 0) return 0;
  if (exp === 0x7fff) return Number.NaN;
  return sign * (1 + mant / 2 ** 63) * 2 ** (exp - 16383);
}

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
