import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './eml-inspector.meta';

/**
 * .eml email message inspector.
 *
 * Reads the RFC 5322 header block and the MIME body of a single saved email.
 * Expected values in the tests come from the byte-exact fixture built by the
 * Python generator (a two-part multipart/mixed message with a base64 text part
 * and a base64 attachment), never from this parser.
 */

const MAX_BYTES = 32 * 1024 * 1024;

function b64decode(s: string): Uint8Array | null {
  // strip whitespace
  const clean = s.replace(/\s+/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  try {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function qpDecode(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === '=') {
      const hex = s.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        out += String.fromCharCode(parseInt(hex, 16));
        i += 2;
      } else {
        out += c;
      }
    } else if (c === '_') {
      out += ' ';
    } else {
      out += c;
    }
  }
  return out;
}

/** Decode an RFC 2047 encoded-word, e.g. =?utf-8?B?...?= or =?utf-8?Q?...?=. */
function decodeHeaderValue(v: string): string {
  const m = /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/.exec(v);
  if (!m) return v;
  const enc = m[1] ?? '';
  const kind = (m[2] ?? '').toLowerCase();
  const payload = m[3] ?? '';
  try {
    if (kind === 'b') {
      const bytes = b64decode(payload);
      if (bytes) return new TextDecoder(enc === 'utf-8' ? 'utf-8' : 'latin1').decode(bytes);
      return v;
    }
    return qpDecode(payload);
  } catch {
    return v;
  }
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'overview');

    let raw: string;
    const file = input.files[0];
    if (file) {
      if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
      const buf = new Uint8Array(await file.arrayBuffer());
      raw = new TextDecoder().decode(buf);
    } else if (typeof input.text === 'string') {
      raw = input.text;
    } else {
      throw new ToolError(
        'Choose an .eml file or paste the message text to inspect.',
        'Provide an .eml file or raw message text.',
      );
    }
    if (raw.length === 0) throw new ToolError('The message is empty.');

    const text = raw.replace(/\r\n/g, '\n');
    const lines = text.split('\n');

    const warnings: string[] = [];

    // ---- split headers from body at the first blank line ----
    let sep = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if ((lines[i] ?? '') === '') {
        sep = i;
        break;
      }
    }
    if (sep < 0) {
      warnings.push('No blank line separates the headers from the body.');
    }
    const headerLines = sep >= 0 ? lines.slice(0, sep) : lines;
    const bodyLines = sep >= 0 ? lines.slice(sep + 1) : [];

    // ---- parse headers (handle folded continuation lines) ----
    const headers: { name: string; value: string }[] = [];
    for (let i = 0; i < headerLines.length; i += 1) {
      const ln = headerLines[i] ?? '';
      if ((ln[0] === ' ' || ln[0] === '\t') && headers.length > 0) {
        const last = headers[headers.length - 1];
        if (last) last.value = last.value + ' ' + ln.trim();
        continue;
      }
      const colon = ln.indexOf(':');
      if (colon <= 0) {
        warnings.push('Header line without a colon: "' + ln.slice(0, 40) + '".');
        continue;
      }
      headers.push({ name: ln.slice(0, colon).trim(), value: ln.slice(colon + 1).trim() });
    }

    const get = (name: string): string | undefined =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

    // ---- MIME parsing ----
    const contentType = get('Content-Type') ?? '';
    const boundaryMatch = /boundary\s*=\s*"?([^";]+)"?/i.exec(contentType);
    const boundary = boundaryMatch ? (boundaryMatch[1] ?? '') : '';

    interface Part {
      index: number;
      type: string;
      encoding: string;
      filename: string;
      bodyText: string;
      decodedBytes: number;
      isAttachment: boolean;
    }
    const parts: Part[] = [];

    function decodeBody(enc: string, body: string, index: number): number {
      const trimmed = body.trimEnd();
      const e = enc.toLowerCase();
      if (e === 'base64') {
        const dec = b64decode(trimmed);
        if (dec) {
          let count = 0;
          for (let i = 0; i < dec.length; i += 1) if ((dec[i] ?? 0) > 127) count += 1;
          return dec.length - count;
        }
        warnings.push('Base64 payload with broken padding in part ' + index + '.');
        return trimmed.length;
      }
      if (e === 'quoted-printable') return qpDecode(trimmed).length;
      return trimmed.length;
    }

    function parsePartHeaders(lines: string[]): Map<string, string> {
      const map = new Map<string, string>();
      for (const ln of lines) {
        const colon = ln.indexOf(':');
        if (colon > 0) map.set(ln.slice(0, colon).trim().toLowerCase(), ln.slice(colon + 1).trim());
      }
      return map;
    }

    function makePart(index: number, sub: Map<string, string>, body: string): Part {
      const type = (sub.get('content-type') || 'text/plain').split(';')[0] ?? 'text/plain';
      const enc = sub.get('content-transfer-encoding') ?? '7bit';
      const filename =
        (sub.get('content-disposition') || '').match(/filename\s*=\s*"?([^";]+)"?/i)?.[1] ?? '';
      return {
        index,
        type,
        encoding: enc,
        filename,
        bodyText: body,
        decodedBytes: decodeBody(enc, body, index),
        isAttachment: !!sub.get('content-disposition'),
      };
    }

    if (boundary) {
      // multipart: split the body into part blocks on the boundary delimiter
      const bm = '--' + boundary;
      const bmClose = bm + '--';
      const blocks: string[][] = [];
      let cur: string[] | null = null;
      let sawClosing = false;
      for (const ln of bodyLines) {
        if (ln === bm || ln === bmClose) {
          if (ln === bmClose) sawClosing = true;
          if (cur && cur.some((l) => l.trim() !== '')) blocks.push(cur);
          cur = [];
        } else if (cur) {
          cur.push(ln);
        }
      }
      if (cur && cur.some((l) => l.trim() !== '')) blocks.push(cur);
      for (const block of blocks) {
        // split part headers from part body at the first blank line
        let blank = -1;
        for (let i = 0; i < block.length; i += 1) {
          if ((block[i] ?? '') === '') {
            blank = i;
            break;
          }
        }
        const hLines = blank >= 0 ? block.slice(0, blank) : block;
        const bLines = blank >= 0 ? block.slice(blank + 1) : [];
        const sub = parsePartHeaders(hLines);
        parts.push(makePart(parts.length, sub, bLines.join('\n')));
      }
      if (!sawClosing)
        warnings.push('The multipart message is missing its closing boundary delimiter.');
    } else {
      // single-part message
      const sub = new Map<string, string>();
      sub.set('content-type', contentType);
      sub.set('content-transfer-encoding', get('Content-Transfer-Encoding') ?? '7bit');
      const cd = get('Content-Disposition') ?? '';
      if (cd) sub.set('content-disposition', cd);
      parts.push(makePart(0, sub, bodyLines.join('\n')));
    }

    // ---- views ----
    if (view === 'headers') {
      const rows = headers.map((h) => [h.name, h.value]);
      return renderTable(['header', 'value'], rows, 'EML headers', undefined, warnings);
    }

    if (view === 'parts') {
      const rows = parts.map((p) => [
        String(p.index),
        p.type,
        p.encoding,
        p.filename || '-',
        String(p.decodedBytes) + ' B',
        p.isAttachment ? 'yes' : 'no',
      ]);
      return renderTable(
        ['#', 'content type', 'encoding', 'filename', 'decoded size', 'attachment'],
        rows,
        'EML MIME parts',
        undefined,
        warnings,
      );
    }

    // overview
    const totalDecoded = parts.reduce((sum, p) => sum + p.decodedBytes, 0);
    const overview: string[][] = [
      ['From', decodeHeaderValue(get('From') ?? '-')],
      ['To', decodeHeaderValue(get('To') ?? '-')],
      ['Cc', decodeHeaderValue(get('Cc') ?? '-')],
      ['Subject', decodeHeaderValue(get('Subject') ?? '-')],
      ['Date', get('Date') ?? '-'],
      ['Message-ID', get('Message-ID') ?? '-'],
      ['Content type', contentType.split(';')[0] || '-'],
      ['Parts', String(parts.length)],
      ['Total decoded size', String(totalDecoded) + ' B'],
      ['MIME-Version', get('MIME-Version') ?? '-'],
    ];

    const notes: string[] = [];
    if (parts.some((p) => p.isAttachment))
      notes.push(
        'The message contains ' +
          parts.filter((p) => p.isAttachment).length +
          ' attachment part(s).',
      );

    return renderTable(['field', 'value'], overview, 'EML overview', notes, warnings);
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
