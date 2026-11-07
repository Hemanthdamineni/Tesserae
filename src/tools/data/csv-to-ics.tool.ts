import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './csv-to-ics.meta';

const MAX_LEN = 1_000_000;
const PRODID = '-//Tesserae/csv-to-ics//EN';

type Parsed = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
};

function parseRecords(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  while (i < len) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      if (text[i] === '\r') i += 1;
      continue;
    }
    if (ch === '\r') {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== '' || row.length > 0) pushRow();
  return rows;
}

function detectDelimiter(text: string): string {
  const sample = text.slice(0, 2000);
  const cands = [',', '\t', ';'];
  let best = ',';
  let bestCount = -1;
  for (const c of cands) {
    let count = 0;
    let inQ = false;
    for (const ch of sample) {
      if (ch === '"') inQ = !inQ;
      else if (ch === c && !inQ) count += 1;
    }
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : ',';
}

function parseDatetime(raw: string, fmt: 'iso' | 'us' | 'eu'): Parsed | null {
  const s = raw.trim();
  let m: RegExpMatchArray | null = null;
  if (fmt === 'iso') {
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, se] = m;
    const hasTime = h !== undefined;
    return {
      year: Number(y),
      month: Number(mo),
      day: Number(d),
      ...(hasTime ? { hour: Number(h), minute: Number(mi ?? 0), second: Number(se ?? 0) } : {}),
    };
  }
  if (fmt === 'us') {
    m = s.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp])[Mm])?$/,
    );
    if (!m) return null;
    const [, mo, d, y, h, mi, se, ap] = m;
    if (h === undefined) return { year: Number(y), month: Number(mo), day: Number(d) };
    let hour = Number(h) % 12;
    if (ap && ap.toLowerCase() === 'p') hour += 12;
    return {
      year: Number(y),
      month: Number(mo),
      day: Number(d),
      hour,
      minute: Number(mi ?? 0),
      second: Number(se ?? 0),
    };
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, d, mo, y, h, mi, se] = m;
  if (h === undefined) return { year: Number(y), month: Number(mo), day: Number(d) };
  return {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h),
    minute: Number(mi ?? 0),
    second: Number(se ?? 0),
  };
}

function dateToken(p: Parsed, withTime: boolean, utc: boolean): string {
  const d = String(p.day).padStart(2, '0');
  const mo = String(p.month).padStart(2, '0');
  const base = String(p.year).padStart(4, '0') + mo + d;
  if (!withTime) return base;
  const hh = String(p.hour ?? 0).padStart(2, '0');
  const mm = String(p.minute ?? 0).padStart(2, '0');
  const ss = String(p.second ?? 0).padStart(2, '0');
  return base + 'T' + hh + mm + ss + (utc ? 'Z' : '');
}

function nextDay(p: Parsed): Parsed {
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  d.setUTCDate(d.getUTCDate() + 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function addHour(p: Parsed): Parsed {
  const d = new Date(
    Date.UTC(p.year, p.month - 1, p.day, p.hour ?? 0, p.minute ?? 0, p.second ?? 0),
  );
  d.setUTCHours(d.getUTCHours() + 1);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n');
}

/** Fold to 75 octets (RFC 5545) using UTF-8 byte length. */
function fold(line: string): string[] {
  const out: string[] = [];
  const enc = new TextEncoder();
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > 75 && cur !== '') {
      out.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  if (cur !== '') out.push(cur);
  return out;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const source = input.text ?? '';
  if (!source.trim()) throw new ToolError('Paste CSV rows describing events.');
  if (source.length > MAX_LEN)
    throw new ToolError('Input is too large.', 'Keep it under 1,000,000 characters.');

  const delimOpt = String(o.delimiter ?? 'auto');
  const delimiter = delimOpt === 'auto' ? detectDelimiter(source) : delimOpt;
  const fmt = String(o.dateFormat ?? 'iso') as 'iso' | 'us' | 'eu';
  const utc = o.utc === true;
  const allDayMode = String(o.allDay ?? 'auto');

  const rows = parseRecords(source, delimiter);
  if (rows.length < 2) throw new ToolError('Need a header row and at least one event row.');

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const pick = (...names: string[]): number => {
    const idx = header.findIndex((h) => names.includes(h));
    return idx;
  };
  const iTitle = pick('title', 'name', 'summary', 'subject');
  const iStart = pick('start', 'starttime', 'start_time', 'date', 'dtstart');
  const iEnd = pick('end', 'endtime', 'end_time', 'dateend', 'dtend');
  const iDesc = pick('description', 'desc', 'notes', 'note');
  const iLoc = pick('location', 'place', 'where');
  if (iTitle === -1 || iStart === -1) {
    throw new ToolError(
      'Could not find title and start columns.',
      'Use headers like "title,start,end,description".',
    );
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:' + PRODID,
    'CALSCALE:GREGORIAN',
  ];
  let events = 0;
  let skipped = 0;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

  rows.slice(1).forEach((row, idx) => {
    const title = (row[iTitle] ?? '').trim();
    const startRaw = (row[iStart] ?? '').trim();
    const endRaw = iEnd === -1 ? '' : (row[iEnd] ?? '').trim();
    const desc = iDesc === -1 ? '' : (row[iDesc] ?? '').trim();
    const loc = iLoc === -1 ? '' : (row[iLoc] ?? '').trim();
    if (title === '' || startRaw === '') {
      skipped += 1;
      return;
    }
    const start = parseDatetime(startRaw, fmt);
    if (!start) {
      skipped += 1;
      return;
    }
    const withTime = start.hour !== undefined;
    const allDay = withTime ? false : allDayMode === 'auto';

    lines.push('BEGIN:VEVENT');
    lines.push('UID:ev-' + (idx + 1) + '@tesserae.local');
    lines.push('DTSTAMP:' + stamp);
    if (allDay) {
      lines.push('DTSTART;VALUE=DATE:' + dateToken(start, false, false));
      const end = endRaw ? parseDatetime(endRaw, fmt) : null;
      lines.push(
        'DTEND;VALUE=DATE:' + dateToken(end ? nextDay(end) : nextDay(start), false, false),
      );
    } else {
      lines.push('DTSTART:' + dateToken(start, true, utc));
      const end = endRaw ? parseDatetime(endRaw, fmt) : null;
      const endP = end ?? addHour(start);
      lines.push('DTEND:' + dateToken(endP, true, utc));
    }
    lines.push('SUMMARY:' + escapeText(title));
    if (desc) lines.push('DESCRIPTION:' + escapeText(desc));
    if (loc) lines.push('LOCATION:' + escapeText(loc));
    lines.push('END:VEVENT');
    events += 1;
  });

  if (events === 0)
    throw new ToolError('No parseable events found.', 'Check column names and the date format.');

  lines.push('END:VCALENDAR');

  const folded: string[] = [];
  for (const line of lines) {
    const parts = fold(line);
    parts.forEach((p, k) => folded.push(k === 0 ? p : ' ' + p));
  }
  const ics = folded.join('\r\n');

  return {
    output: ics + '\r\n',
    render: 'text',
    language: 'text',
    stats: { events, skipped },
    notes: [
      events +
        ' event(s) → ' +
        (allDayMode === 'auto' ? 'all-day where the row has no time' : 'with times'),
      'Separator: ' +
        (delimiter === '\t' ? 'tab' : delimiter) +
        ' · format: ' +
        fmt +
        (utc ? ' · UTC (Z)' : ''),
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
