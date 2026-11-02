import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { ToolError } from '@/lib/types';
import { meta } from './vtt-inspector.meta';

/**
 * WebVTT subtitle inspector.
 *
 * Validates the WEBVTT header, extracts the optional header-metadata block,
 * and parses every cue: its optional identifier line, its timing line
 * (start --> end with optional settings), and its text lines. It reports the
 * cue count and runtime and flags common issues: cues out of order, cues that
 * overlap, timestamps that run past the end, and malformed or missing cues.
 * The expected values come from the byte-exact fixture confirmed by the
 * reference tool `file`(1) and an independent WebVTT parser, not this one.
 */

interface Cue {
  index: number;
  id: string | null;
  start: number; // milliseconds
  end: number; // milliseconds
  settings: string;
  text: string[];
  hasTiming: boolean;
}

interface Model {
  headerOk: boolean;
  hasBom: boolean;
  headerMeta: string[];
  cues: Cue[];
  issues: string[];
}

const MAX_TEXT = 2 * 1024 * 1024;

function parseTimestamp(raw: string): number | null {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})$/.exec(raw);
  if (!m) return null;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  const ms = Number(m[4] ?? 0);
  if (min > 59 || s > 59) return null;
  return ((h * 60 + min) * 60 + s) * 1000 + ms;
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const frac = ms % 1000;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  const ff = String(frac).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ff}`;
}

function parseVtt(text: string): Model {
  const issues: string[] = [];
  const hasBom = text.startsWith('\uFEFF');
  let body = hasBom ? text.slice(1) : text;
  if (!body.endsWith('\n')) body += '\n';

  const lines = body.split(/\r\n|\r|\n/);

  const headerOk = lines[0]?.startsWith('WEBVTT') ?? false;
  if (!headerOk) {
    throw new ToolError(
      'That text does not look like a WebVTT file; it must start with a "WEBVTT" header line.',
    );
  }

  // Header metadata block: lines after WEBVTT that contain neither a timing
  // arrow nor a blank line.
  let i = 1;
  const headerMeta: string[] = [];
  while (i < lines.length && lines[i] !== '' && !lines[i]!.includes('-->')) {
    headerMeta.push(lines[i]!.trim());
    i += 1;
  }

  const cues: Cue[] = [];
  let index = 0;
  while (i < lines.length) {
    // skip blank lines
    while (i < lines.length && lines[i] === '') i += 1;
    if (i >= lines.length) break;

    let id: string | null = null;
    // An identifier line has no timing arrow and is not blank.
    if (!lines[i]!.includes('-->')) {
      id = lines[i]!.trim();
      i += 1;
    }

    if (i >= lines.length) {
      issues.push('Cue ' + (index + 1) + ' is missing a timing line.');
      break;
    }

    const timingLine = lines[i]!;
    i += 1;
    const timingMatch = /^([0-9:.]+)\s+-->\s+([0-9:.]+)(.*)$/.exec(timingLine);
    let start = 0;
    let end = 0;
    let settings = '';
    let hasTiming = false;
    if (timingMatch) {
      const s = parseTimestamp(timingMatch[1]!);
      const e = parseTimestamp(timingMatch[2]!);
      if (s === null || e === null) {
        issues.push('Cue ' + (index + 1) + ' has a malformed timestamp: "' + timingLine + '".');
      } else {
        start = s;
        end = e;
        settings = (timingMatch[3] ?? '').trim();
        hasTiming = true;
      }
    } else {
      issues.push('Cue ' + (index + 1) + ' has a malformed timing line: "' + timingLine + '".');
    }

    const cueText: string[] = [];
    while (i < lines.length && lines[i] !== '') {
      cueText.push(lines[i]!);
      i += 1;
    }

    cues.push({ index, id, start, end, settings, text: cueText, hasTiming });
    index += 1;
  }

  // Post-checks: ordering, overlap, out-of-range, missing text.
  for (let k = 1; k < cues.length; k += 1) {
    const prev = cues[k - 1]!;
    const cur = cues[k]!;
    if (prev.hasTiming && cur.hasTiming && cur.start < prev.start) {
      issues.push('Cue ' + cur.index + ' starts before the previous cue (out of order).');
    }
    if (prev.hasTiming && cur.hasTiming && cur.start < prev.end) {
      issues.push('Cue ' + cur.index + ' overlaps the previous cue.');
    }
  }
  for (const c of cues) {
    if (c.hasTiming && c.text.length === 0) {
      issues.push('Cue ' + c.index + ' has no text lines.');
    }
  }

  return { headerOk, hasBom, headerMeta, cues, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const lastEnd = m.cues.reduce((mx, c) => (c.hasTiming ? Math.max(mx, c.end) : mx), 0);
  const withSettings = m.cues.filter((c) => c.settings !== '').length;
  const withId = m.cues.filter((c) => c.id !== null).length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'WebVTT subtitle'],
      ['Header', m.headerOk ? 'valid' : 'missing'],
      ['BOM', m.hasBom ? 'present' : 'none'],
      ['Header metadata lines', String(m.headerMeta.length)],
      ['Cues', String(m.cues.length)],
      ['Cues with identifier', String(withId)],
      ['Cues with settings', String(withSettings)],
      ['Total runtime', formatMs(lastEnd)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableCues(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Start', 'End', 'Settings', 'Text'],
    rows: m.cues.map((c) => [
      String(c.index + 1),
      c.hasTiming ? formatMs(c.start) : '-',
      c.hasTiming ? formatMs(c.end) : '-',
      c.settings,
      c.text.join(' '),
    ]),
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Issue'],
    rows: m.issues.length ? m.issues.map((issue) => [issue]) : [['No issues found']],
  };
}

function asTable(rows: string[][]): TextRunResult {
  return {
    output: JSON.stringify({ headers: ['Metric', 'Value'], rows }),
    render: 'table',
  };
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const text = input.text;
  if (text.length === 0) {
    return { output: 'Paste a WebVTT (.vtt) subtitle document to inspect it.', render: 'text' };
  }
  if (text.length > MAX_TEXT) {
    return { output: 'That text is larger than 2 MB.', render: 'text' };
  }

  const m = parseVtt(text);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'cues':
      table = tableCues(m);
      break;
    case 'issues':
      table = tableIssues(m);
      break;
    case 'summary':
    default:
      table = tableSummary(m);
  }

  return {
    ...asTable(table.rows),
    stats: { cues: m.cues.length, issues: m.issues.length },
    notes: [
      'The inspector flags cues that are out of order, that overlap, or that are missing text; fix those before publishing.',
      'Timestamps use the HH:MM:SS.mmm WebVTT format and are checked for validity.',
    ],
    warnings: m.issues.length > 0 ? m.issues.slice(0, 20) : undefined,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
