import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ical-event.meta';

const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold a content line at 75 octets per RFC 5545 §3.1 (continuation = space). */
function fold(line: string): string {
  const encoded = new TextEncoder().encode(line);
  if (encoded.length <= 75) return line;
  const parts: string[] = [];
  let chunk = '';
  let len = 0;
  for (const ch of line) {
    const l = new TextEncoder().encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (len + l > limit) {
      parts.push(chunk);
      chunk = '';
      len = 0;
    }
    chunk += ch;
    len += l;
  }
  if (chunk) parts.push(chunk);
  return parts.join('\n ');
}

function randomHex(n: number): string {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

const pad = (n: number) => n.toString().padStart(2, '0');

/** Local wall-clock "YYYY-MM-DD HH:MM" → UTC "YYYYMMDDTHHMMSSZ". */
function toUtcStamp(value: string, field: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value.trim());
  if (!m) throw new ToolError(`Enter a valid ${field} like 2026-09-22 14:00.`);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  if (isNaN(d.getTime())) throw new ToolError(`Enter a valid ${field} like 2026-09-22 14:00.`);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  );
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const summary = String(o.summary ?? '').trim();
  const start = String(o.startDateTime ?? '').trim();
  const end = String(o.endDateTime ?? '').trim();
  const allDay = Boolean(o.allDay);
  const location = String(o.location ?? '').trim();
  const description = String(o.description ?? '').trim();
  const url = String(o.url ?? '').trim();
  const reminder = Math.max(0, Math.floor(Number(o.reminderMinutes ?? 0)));

  const dateOnly = (v: string, field: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
    if (!m) throw new ToolError(`Enter a valid ${field} like 2026-09-22.`);
    return `${m[1]}${m[2]}${m[3]}`;
  };

  let dtstart: string;
  let dtend: string;
  if (allDay) {
    dtstart = dateOnly(start, 'start date');
    dtend = end ? dateOnly(end, 'end date') : dtstart;
  } else {
    dtstart = toUtcStamp(start || '', 'start date and time');
    dtend = end ? toUtcStamp(end, 'end date and time') : dtstart;
  }
  if (dtend < dtstart) throw new ToolError('The end must not be before the start.');
  if (!summary && !description) throw new ToolError('Enter at least an event title.');

  const now = new Date();
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tesserae/EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${randomHex(12)}@tesserae`,
    `DTSTAMP:${dtstamp}`,
  ];
  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`, `DTEND;VALUE=DATE:${dtend}`);
  } else {
    lines.push(`DTSTART:${dtstart}`, `DTEND:${dtend}`);
  }
  if (summary) lines.push(`SUMMARY:${escapeText(summary)}`);
  if (location) lines.push(`LOCATION:${escapeText(location)}`);
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (url) lines.push(`URL:${url}`);
  if (reminder > 0) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${reminder}M`, 'END:VALARM');
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return {
    output: lines.map(fold).join('\n') + '\n',
    render: 'code',
    language: 'text',
    filename: 'event.ics',
    stats: {
      allDay: allDay ? 'yes' : 'no',
      reminder: reminder > 0 ? `${reminder} min before` : 'none',
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
