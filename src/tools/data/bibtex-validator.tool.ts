import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './bibtex-validator.meta';

/**
 * BibTeX bibliography validator.
 *
 * Parses each "@type{key, field = {value}, ...}" entry-ish, counts entries and
 * field usage, and reports structural problems: malformed keys, unterminated
 * braces, duplicated keys, empty values), and mandatory fields missing for
 * the entry type. Expected values come from the byte-exact fixture, never from
 * this parser.
 */

const MAX_CHARS = 1000000;
const MAX_ENTRIES = 20000;

interface BibEntry {
  type: string;
  key: string;
  fields: string[];
  startLine: number;
}

interface Issue {
  key: string;
  message: string;
}

const MANDATORY: Record<string, string[]> = {
  article: ['author', 'title', 'journal', 'year'],
  book: ['author', 'title', 'publisher', 'year'],
  inbook: ['author', 'title', 'publisher', 'year'],
  booklet: ['title'],
  inproceedings: ['author', 'title', 'booktitle', 'year'],
  conference: ['author', 'title', 'booktitle', 'year'],
  incollection: ['author', 'title', 'booktitle', 'publisher', 'year'],
  manual: ['title'],
  mastersthesis: ['author', 'title', 'school', 'year'],
  misc: [],
  phdthesis: ['author', 'title', 'school', 'year'],
  proceedings: ['title', 'year'],
  techreport: ['author', 'title', 'institution', 'year'],
  unpublished: ['author', 'title', 'note'],
};

function parseBib(text: string): { entries: BibEntry[]; issues: Issue[] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const entries: BibEntry[] = [];
  const issues: Issue[] = [];
  const seenKeys = new Map<string, number>();

  let i = 0;
  while (i < lines.length) {
    const trimmed = (lines[i] ?? '').trim();
    if (trimmed === '') {
      i += 1;
      continue;
    }
    if (trimmed.startsWith('%')) {
      i += 1;
      continue;
    } // BibTeX comment

    // expect "@type{"
    const at = /^@(\w+)\s*\{\s*([^,}]*)/.exec(trimmed);
    if (!at) {
      issues.push({
        key: '?',
        message: 'Expected an entry starting with @type{ on line ' + (i + 1) + '.',
      });
      i += 1;
      continue;
    }
    const type = at[1]?.toLowerCase() ?? '';
    const key = (at[2] ?? '').trim();
    const startLine = i;
    if (key === '') {
      issues.push({ key: '?', message: 'Entry on line ' + (i + 1) + ' has no citation key.' });
    }

    // collect the rest of the entry text until the closing "}"
    // The entry opener consumed its "{", so begin with one unclosed brace.
    const fieldNames: string[] = [];
    const scanLine = (ln: string): void => {
      const fm = /^\s*([A-Za-z0-9_:+-]+)\s*=\s*\{/.exec(ln.trim());
      if (fm) fieldNames.push(fm[1]?.toLowerCase() ?? '');
    };
    let depth = 1;
    // first line may already hold fields after the key (single-line entries)
    let chunk = trimmed.slice(at[0].length);
    for (const part of chunk.split(',')) {
      if (/=\s*\{/.test(part)) scanLine(part);
    }
    while (depth > 0 && i < lines.length) {
      i += 1;
      if (i >= lines.length) break;
      const ln = lines[i] ?? '';
      scanLine(ln);
      depth += ln.split('{').length - 1 - (ln.split('}').length - 1);
    }

    if (depth > 0) {
      issues.push({
        key: key || '?',
        message: 'Entry starting on line ' + (startLine + 1) + ' is missing a closing brace.',
      });
    }

    const entry: BibEntry = { type, key, fields: fieldNames, startLine: startLine + 1 };
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) break;

    // duplicate key check
    const prevLine = seenKeys.get(key);
    if (key !== '' && prevLine !== undefined) {
      issues.push({ key, message: 'Duplicate citation key also used on line ' + prevLine + '.' });
    } else if (key !== '') {
      seenKeys.set(key, startLine + 1);
    }

    // mandatory fields
    const req = MANDATORY[type] ?? [];
    for (const f of req) {
      if (!fieldNames.includes(f)) {
        issues.push({
          key: key || '?',
          message: 'Mandatory field "' + f + '" is missing for a ' + type + ' entry.',
        });
      }
    }

    i += 1;
  }

  return { entries, issues };
}

function tableSummary(
  entries: BibEntry[],
  issues: Issue[],
): { headers: string[]; rows: string[][] } {
  const types = new Map<string, number>();
  let totalFields = 0;
  for (const e of entries) {
    types.set(e.type, (types.get(e.type) ?? 0) + 1);
    totalFields += e.fields.length;
  }
  const typeList =
    Array.from(types.entries())
      .map(([t, n]) => t + ' x' + n)
      .join(', ') || '(none)';
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'BibTeX'],
      ['Entries', String(entries.length)],
      ['Fields', String(totalFields)],
      ['Types', typeList],
      ['Issues', String(issues.length)],
    ],
  };
}

function tableEntries(entries: BibEntry[], max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? entries.slice(0, max) : [];
  return {
    headers: ['Key', 'Type', 'Fields', 'Line'],
    rows: shown.map((e) => [
      e.key || '(no key)',
      e.type,
      String(e.fields.length),
      String(e.startLine),
    ]),
  };
}

function tableIssues(issues: Issue[]): { headers: string[]; rows: string[][] } {
  if (issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['Key', 'Problem'],
    rows: issues.map((g) => [g.key, g.message]),
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
    throw new ToolError('No bibliography was provided.', 'Paste or drop a BibTeX (.bib) file.');
  if (text.length > MAX_CHARS) throw new ToolError('That bibliography is larger than 1 MB.');

  const { entries, issues } = parseBib(text);
  if (entries.length === 0) throw new ToolError('That does not look like a BibTeX bibliography.');

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'entries':
      table = tableEntries(entries, maxRows);
      break;
    case 'issues':
      table = tableIssues(issues);
      break;
    case 'summary':
    default:
      table = tableSummary(entries, issues);
  }

  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
