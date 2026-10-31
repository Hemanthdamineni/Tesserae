import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './jpeg-inspector.meta';

/**
 * JPEG segment inspector.
 *
 * Walks a JPEG as a stream of 0xFF markers (ITU-T T.81 / ISO 10918-1) and
 * decodes the commonly carried segments: SOF frame headers, DQT
 * quantisation tables, DHT Huffman tables, SOS scan headers, DRI restart
 * intervals and JFIF APP0 metadata. Expected values in the tests come from
 * the `file`(1) reference tool and a byte-level marker walk, never from this
 * parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_SEGMENTS = 5000;

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const DQT = 0xdb;
const DHT = 0xc4;
const DRI = 0xdd;
const TEM = 0x01;

/** SOF0..SOF3, SOF5..SOF9, SOF11..SOF15 and DHT/SOS etc. */
function sofPrecision(c: number): boolean {
  if (c >= 0xc0 && c <= 0xcf) {
    return c !== 0xc4 && c !== 0xc8 && c !== 0xcc;
  }
  return false;
}

function markerName(c: number): string {
  const names: Record<number, string> = {
    [0xd8]: 'SOI',
    [0xd9]: 'EOI',
    [0xda]: 'SOS',
    [0xdb]: 'DQT',
    [0xdc]: 'DNL',
    [0xdd]: 'DRI',
    [0xc0]: 'SOF0 (baseline)',
    [0xc1]: 'SOF1 (extended)',
    [0xc2]: 'SOF2 (progressive)',
    [0xc3]: 'SOF3 (lossless)',
    [0xc4]: 'DHT',
    [0xc5]: 'SOF5',
    [0xc6]: 'SOF6',
    [0xc7]: 'SOF7',
    [0xc9]: 'SOF9',
    [0xca]: 'SOF10',
    [0xcb]: 'SOF11',
    [0xcd]: 'SOF13',
    [0xce]: 'SOF14',
    [0xcf]: 'SOF15',
    [0xc8]: 'JPG',
    [0xcc]: 'DAC',
    [0x01]: 'TEM',
    [0xfe]: 'COM',
    [0xe0]: 'APP0 (JFIF)',
    [0xe1]: 'APP1 (Exif/XMP)',
    [0xe2]: 'APP2 (ICC)',
    [0xe3]: 'APP3',
    [0xe4]: 'APP4',
    [0xe5]: 'APP5',
    [0xe6]: 'APP6',
    [0xe7]: 'APP7',
    [0xe8]: 'APP8',
    [0xe9]: 'APP9',
    [0xea]: 'APP10',
    [0xeb]: 'APP11',
    [0xec]: 'APP12',
    [0xed]: 'APP13',
    [0xee]: 'APP14',
    [0xef]: 'APP15',
    [0xd0]: 'RST0',
    [0xd1]: 'RST1',
    [0xd2]: 'RST2',
    [0xd3]: 'RST3',
    [0xd4]: 'RST4',
    [0xd5]: 'RST5',
    [0xd6]: 'RST6',
    [0xd7]: 'RST7',
  };
  return names[c] ?? '0x' + c.toString(16).padStart(2, '0');
}

function isStandalone(c: number): boolean {
  return c === SOI || c === EOI || c === TEM || (c >= 0xd0 && c <= 0xd7);
}

function hex(c: number): string {
  return '0x' + c.toString(16).padStart(2, '0');
}

function readU16(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) * 256 + (b[o + 1] ?? 0)) >>> 0;
}

function readStr(b: Uint8Array, o: number, maxLen: number): string {
  let end = o;
  const cap = Math.min(b.length, o + maxLen);
  while (end < cap && (b[end] ?? 0) !== 0) end += 1;
  let out = '';
  const lim = Math.min(cap, o + 60);
  for (let i = o; i < lim; i += 1) {
    const by = b[i] ?? 0;
    out += by >= 32 && by <= 126 ? String.fromCharCode(by) : '.';
  }
  return out;
}

interface SegmentRec {
  index: number;
  offset: number;
  code: number;
  length: number;
  detail: string;
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'segments');

    const file = input.files[0];
    if (!file) throw new ToolError('Choose a JPEG image to inspect.', 'Pick a .jpg or .jpeg file.');
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 4) throw new ToolError('File is too short to be a JPEG.');
    if (buf[0] !== 0xff || buf[1] !== SOI) {
      throw new ToolError(
        'Not a JPEG image (missing SOI marker).',
        'A JPEG must start with the bytes FF D8.',
      );
    }

    // ---- walk the marker stream ----
    const segments: SegmentRec[] = [];
    let o = 2;
    // SOI is a standalone marker at offset 0; record it explicitly.
    segments.push({ index: 0, offset: 0, code: SOI, length: 0, detail: '' });
    let stuffed = 0;
    let sawEoi = false;
    let width = 0;
    let height = 0;
    let precision = 0;
    let components = 0;
    let frameMarker = '';
    let dqtCount = 0;
    let dhtCount = 0;
    let restart = 0;
    let jfifVersion = '';
    let jfifUnits = '';
    let jfifDensity = '';
    let app1Label = '';
    let app2Icc = '';
    let comment = '';

    const quantTables: string[][] = [];
    const huffTables: string[][] = [];

    let guard = 0;
    while (o + 1 < buf.length && segments.length < MAX_SEGMENTS && guard++ < 100000) {
      if (buf[o] !== 0xff) {
        // non-marker byte in the header region: tolerate if it is entropy
        // data after an SOS, otherwise stop.
        break;
      }
      const codeRaw = buf[o + 1] ?? 0;
      let code = codeRaw;
      if (code === 0xff) {
        // fill byte
        o += 1;
        continue;
      }
      if (code === 0x00) {
        // byte-stuffed 0xFF00 inside a scan: not a real marker
        stuffed += 1;
        o += 2;
        continue;
      }
      const rec: SegmentRec = { index: segments.length, offset: o, code, length: 0, detail: '' };
      if (isStandalone(code)) {
        if (code === EOI) sawEoi = true;
        segments.push(rec);
        o += 2;
        continue;
      }
      // length-bearing marker
      if (o + 3 >= buf.length) break;
      const segLen = readU16(buf, o + 2);
      const payloadOff = o + 4;
      const payloadLen = segLen >= 2 ? segLen - 2 : 0;
      if (payloadOff + payloadLen > buf.length) {
        rec.detail = 'TRUNCATED segment';
        rec.length = segLen;
        segments.push(rec);
        break;
      }
      rec.length = segLen;

      // ---- decode payload ----
      if (sofPrecision(code)) {
        if (payloadLen >= 6) {
          precision = buf[payloadOff] ?? 0;
          height = readU16(buf, payloadOff + 1);
          width = readU16(buf, payloadOff + 3);
          components = buf[payloadOff + 5] ?? 0;
          frameMarker = markerName(code);
          let comps = '';
          let p = payloadOff + 6;
          for (let c = 0; c < components && p + 3 <= payloadOff + payloadLen; c += 1) {
            const id = buf[p] ?? 0;
            const samp = buf[p + 1] ?? 0;
            const hv = ((samp >> 4) & 0x0f) + 'x' + (samp & 0x0f);
            const tq = buf[p + 2] ?? 0;
            comps += (c > 0 ? ', ' : '') + 'C' + id + ' ' + hv + ' q' + tq;
            p += 3;
          }
          rec.detail =
            precision +
            '-bit ' +
            width +
            'x' +
            height +
            ', ' +
            components +
            ' comp' +
            (components === 1 ? '' : 's') +
            (comps ? ': ' + comps : '');
        }
      } else if (code === DQT) {
        let p = payloadOff;
        const end = payloadOff + payloadLen;
        let first = '';
        while (p < end) {
          const info = buf[p] ?? 0;
          const pq = info >> 4;
          const tq = info & 0x0f;
          const elSize = pq === 0 ? 1 : 2;
          if (p + 1 + elSize * 64 > end) break;
          const vals: number[] = [];
          for (let i = 0; i < 64; i += 1) {
            const v = pq === 0 ? (buf[p + 1 + i] ?? 0) : readU16(buf, p + 1 + i * 2);
            vals.push(v);
          }
          const firstStr = vals[0] ?? 0;
          const lastStr = vals[63] ?? 0;
          if (!first) {
            first =
              'id' +
              tq +
              ' ' +
              (pq === 0 ? '8-bit' : '16-bit') +
              ' first=' +
              firstStr +
              ' last=' +
              lastStr;
          }
          quantTables.push([
            String(tq),
            pq === 0 ? '8-bit' : '16-bit',
            String(vals.length),
            String(firstStr),
          ]);
          dqtCount += 1;
          p += 1 + elSize * 64;
        }
        rec.detail =
          dqtCount + ' table' + (dqtCount === 1 ? '' : 's') + (first ? ' (' + first + ')' : '');
      } else if (code === DHT) {
        let p = payloadOff;
        const end = payloadOff + payloadLen;
        while (p < end) {
          const info = buf[p] ?? 0;
          const cls = info >> 4;
          const th = info & 0x0f;
          if (p + 17 > end) break;
          let total = 0;
          for (let i = 0; i < 16; i += 1) total += buf[p + 1 + i] ?? 0;
          const codes = total;
          huffTables.push([cls === 0 ? 'DC' : 'AC', String(th), String(codes)]);
          dhtCount += 1;
          p += 17 + codes;
        }
        rec.detail = dhtCount + ' table' + (dhtCount === 1 ? '' : 's');
      } else if (code === SOS) {
        if (payloadLen >= 3) {
          const n = buf[payloadOff] ?? 0;
          let comps = '';
          let p = payloadOff + 1;
          for (let c = 0; c < n && p + 2 <= payloadOff + payloadLen; c += 1) {
            const id = buf[p] ?? 0;
            const sel = buf[p + 1] ?? 0;
            comps += (c > 0 ? ', ' : '') + 'C' + id + ' DC' + (sel >> 4) + '/AC' + (sel & 0x0f);
            p += 2;
          }
          const sSel = p < payloadOff + payloadLen ? (buf[p] ?? 0) : 0;
          rec.detail =
            n + ' comp' + (n === 1 ? '' : 's') + (comps ? ': ' + comps : '') + ' Ss=' + sSel;
        }
      } else if (code === DRI) {
        if (payloadLen >= 2) {
          restart = readU16(buf, payloadOff);
          rec.detail = 'restart interval ' + restart;
        }
      } else if (code === 0xe0) {
        // APP0
        if (payloadLen >= 2) {
          const sig = readStr(buf, payloadOff, 5);
          if (sig.startsWith('JFIF')) {
            const verMajor = buf[payloadOff + 5] ?? 0;
            const verMinor = buf[payloadOff + 6] ?? 0;
            const ver = verMajor + '.' + String(verMinor).padStart(2, '0');
            const unitsByte = buf[payloadOff + 7] ?? 0;
            const units = unitsByte === 0 ? 'none' : unitsByte === 1 ? 'dpi' : 'dpc';
            const x = readU16(buf, payloadOff + 8);
            const y = readU16(buf, payloadOff + 10);
            jfifVersion = ver;
            jfifUnits = units;
            jfifDensity = x + 'x' + y;
            rec.detail = 'JFIF ' + ver + ' ' + units + ' ' + x + 'x' + y;
          }
        }
      } else if (code === 0xe1) {
        if (payloadLen >= 4) {
          const sig = readStr(buf, payloadOff, 6);
          app1Label = sig.startsWith('Exif')
            ? 'Exif'
            : sig.startsWith('http')
              ? 'XMP'
              : 'APP1 data';
          rec.detail = app1Label;
        }
      } else if (code === 0xe2) {
        if (payloadLen >= 4) {
          const sig = readStr(buf, payloadOff, 12);
          app2Icc = sig.startsWith('ICC_PROFILE') ? 'ICC profile' : 'APP2 data';
          rec.detail = app2Icc;
        }
      } else if (code === 0xfe) {
        if (payloadLen > 0) {
          comment = readStr(buf, payloadOff, payloadLen);
          rec.detail = comment ? 'comment: ' + comment : 'empty comment';
        }
      }

      segments.push(rec);
      o += 2 + segLen;
      if (code === SOS) break;
    }

    // After the scan data, look for a closing EOI marker (0xFF 0xD9),
    // respecting byte-stuffing (0xFF00 is data, not a marker).
    if (!sawEoi) {
      let p = o;
      while (p + 1 < buf.length) {
        if (buf[p] === 0xff) {
          const nxt = buf[p + 1] ?? 0;
          if (nxt === 0xd9) {
            sawEoi = true;
            segments.push({ index: segments.length, offset: p, code: EOI, length: 0, detail: '' });
            break;
          }
          if (nxt === 0x00) {
            p += 2; // stuffed FF00
            continue;
          }
        }
        p += 1;
      }
    }

    // ---- views ----
    if (view === 'tables') {
      const rows: string[][] = [];
      for (const t of quantTables) rows.push(['DQT', ...t]);
      for (const h of huffTables) rows.push(['DHT', ...h]);
      if (rows.length === 0) rows.push(['(none)', '', '', '']);
      return renderTable(['type', 'id', 'kind', 'value'], rows, 'Quantisation and Huffman tables');
    }

    if (view === 'segments') {
      const rows = segments.map((s) => [
        String(s.index),
        String(s.offset),
        hex(s.code),
        markerName(s.code),
        s.length > 0 ? String(s.length) : '-',
        s.detail,
      ]);
      return renderTable(
        ['#', 'offset', 'marker', 'name', 'length', 'detail'],
        rows,
        'JPEG segments',
      );
    }

    // summary view
    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['SOI marker', 'present'],
      ['EOI marker', sawEoi ? 'present' : 'MISSING'],
      ['Frame', frameMarker || '(none)'],
      ['Precision', precision ? String(precision) + ' bit' : '-'],
      ['Dimensions', width && height ? width + 'x' + height : '-'],
      ['Components', components ? String(components) : '-'],
      ['Quantisation tables', String(dqtCount)],
      ['Huffman tables', String(dhtCount)],
      ['Restart interval', String(restart)],
      ['JFIF version', jfifVersion || '-'],
      ['Density units', jfifUnits || '-'],
      ['Pixel density', jfifDensity || '-'],
      ['APP1', app1Label || '-'],
      ['APP2', app2Icc || '-'],
      ['Comment', comment || '-'],
      ['Byte-stuffed FF00', String(stuffed)],
    ];

    const notes: string[] = [];
    if (!sawEoi) notes.push('No EOI marker found: the file may be truncated.');
    if (stuffed > 0) notes.push('Byte-stuffed FF00 sequences seen in entropy data.');

    return renderTable(['field', 'value'], summary, 'JPEG summary', notes);
  },
};

function renderTable(
  headers: string[],
  rows: string[][],
  title: string,
  notes: string[] = [],
): FileRunResult {
  const output = JSON.stringify({ title, headers, rows });
  return {
    outputs: [] as OutputFile[],
    report: { output, render: 'table' },
    notes: notes.length > 0 ? notes : undefined,
    stats: { rows: rows.length },
  };
}

export default tool;
