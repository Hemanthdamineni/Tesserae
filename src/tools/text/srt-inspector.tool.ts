import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './srt-inspector.meta';

/**
 * SubRip (SRT) subtitle inspector.
 *
 * Validates the standard cue layout (numeric index, a
 * "HH:MM:SS,mmm --> HH:MM:SS,mmm" timing line, one or more text lines, then a
 * blank separator) and reports cue count, total duration, and any structural
 * issues. Expected values come from the byte-exact fixture, never from this
 * parser.
 */

const MAX_CHARS = 1000000;
const MAX_CUES = 50000;

interface SrtCue {
  index: number;
  start: number;
  end: number;
  startText: string;
  endText: string;
  text: string[];
}

interface Issue {
  cue: number;
  message: string;
}

function parseMs(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(text);
  if (!m) return null;
  const h = parseInt(m[1] ?? '0', 10);
  const min = parseInt(m[2] ?? '0', 10);
  const sec = parseInt(m[3] ?? '0', 10);
  const msPart = (m[4] ?? '0').padEnd(3, '0');
  const ms = parseInt(msPart, 10);
  return h * 3600000 + min * 60000 + sec * 1000 + ms;
}

function fmtMs(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const min = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const m = ms % 1000;
  const pad = (n: number, w: number): string => String(n).padStart(w, '0');
  return pad(h, 2) + ':' + pad(min, 2) + ':' + pad(sec, 2) + ',' + pad(m, 3);
}

function parseSrt(text: string): { cues: SrtCue[]; issues: Issue[] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const cues: SrtCue[] = [];
  const issues: Issue[] = [];
  let i = 0;
  let expectedIndex = 1;

  while (i < lines.length) {
    // skip leading blank lines
    while (i < lines.length && lines[i] === '') {
      i += 1;
    }
    if (i >= lines.length) break;

    // cue index
    const indexLine = (lines[i] ?? '').trim();
    const index = parseInt(indexLine, 10);
    if (indexLine === '' || Number.isNaN(index)) {
      issues.push({
        cue: cues.length + 1,
        message: 'Expected a cue index, found "' + indexLine + '".',
      });
      i += 1;
      continue;
    }
    if (index !== expectedIndex) {
      issues.push({
        cue: cues.length + 1,
        message: 'Cue index is ' + index + ' but expected ' + expectedIndex + '.',
      });
    }
    expectedIndex = index + 1;
    i += 1;

    // timing line
    const timingLine = (lines[i] ?? '').trim();
    const arrow = timingLine.indexOf('-->');
    let start = 0;
    let end = 0;
    let startText = '';
    let endText = '';
    if (arrow === -1) {
      issues.push({ cue: cues.length + 1, message: 'Missing "-->" in the timing line.' });
    } else {
      const s = timingLine.slice(0, arrow).trim();
      const e = timingLine.slice(arrow + 3).trim();
      const sm = parseMs(s);
      const em = parseMs(e);
      startText = s;
      endText = e;
      if (sm === null || em === null) {
        issues.push({
          cue: cues.length + 1,
          message: 'Timing line is not "HH:MM:SS,mmm --> HH:MM:SS,mmm".',
        });
      } else {
        start = sm;
        end = em;
        if (end < start) {
          issues.push({
            cue: cues.length + 1,
            message: 'End time ' + fmtMs(end) + ' is before start ' + fmtMs(start) + '.',
          });
        }
      }
    }
    i += 1;

    // text lines until blank
    const text: string[] = [];
    while (i < lines.length && (lines[i] ?? '') !== '') {
      text.push(lines[i] ?? '');
      i += 1;
    }
    if (text.length === 0) {
      issues.push({ cue: cues.length + 1, message: 'Cue has no subtitle text.' });
    }

    cues.push({ index, start, end, startText, endText, text });
    if (cues.length > MAX_CUES) break;
  }

  return { cues, issues };
}

function tableSummary(cues: SrtCue[], issues: Issue[]): { headers: string[]; rows: string[][] } {
  const totalLines = cues.reduce((s, c) => s + c.text.length, 0);
  const duration = cues.length > 0 ? (cues[cues.length - 1]?.end ?? 0) : 0;
  const first = cues[0];
  const last = cues[cues.length - 1];
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'SubRip (SRT)'],
      ['Cues', String(cues.length)],
      ['Subtitle lines', String(totalLines)],
      ['Duration', fmtMs(duration)],
      ['First cue', first ? fmtMs(first.start) + ' to ' + fmtMs(first.end) : '(none)'],
      ['Last cue', last ? fmtMs(last.start) + ' to ' + fmtMs(last.end) : '(none)'],
      ['Issues', String(issues.length)],
    ],
  };
}

function tableCues(cues: SrtCue[], max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? cues.slice(0, max) : [];
  return {
    headers: ['Index', 'Start', 'End', 'Text'],
    rows: shown.map((c) => [
      String(c.index),
      c.startText,
      c.endText,
      c.text.join(' ') || '(empty)',
    ]),
  };
}

function tableIssues(issues: Issue[]): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Cue', 'Problem'],
    rows: issues.map((g) => [String(g.cue), g.message]),
  };
}

function asTable(table: { headers: string[]; rows: string[][] }): TextRunResult {
  return { output: JSON.stringify(table), render: 'table' };
}

function run(input: TextRunInput): TextRunResult {
  const options = input.options;
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(50000, Number(options.maxRows ?? 100) || 0));

  const text = input.text ?? '';
  if (text.length === 0)
    throw new ToolError('No subtitle text was provided.', 'Paste or drop an SRT subtitle file.');
  if (text.length > MAX_CHARS) throw new ToolError('That subtitle file is larger than 1 MB.');

  const { cues, issues } = parseSrt(text);
  if (cues.length === 0)
    throw new ToolError('That does not look like a SubRip (SRT) subtitle file.');

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'cues':
      table = tableCues(cues, maxRows);
      break;
    case 'issues':
      table = tableIssues(issues);
      break;
    case 'summary':
    default:
      table = tableSummary(cues, issues);
  }

  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
