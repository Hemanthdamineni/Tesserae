import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './iif-inspector.meta';

/**
 * QuickBooks IIF inspector.
 *
 * IIF is a tab-separated import format. Lines that begin with "!" are header
 * rows (which define the fields for a record section such as TRNS) or section
 * markers (ENDTRNS). Other lines are data rows whose first tab-separated field
 * names the record type. Counts records per section, lists the fields each
 * header defines, and flags structural problems. Expected values come from the
 * byte-exact fixture, never from this parser.
 */

const MAX_CHARS = 1000000;
const MAX_ROWS = 50000;

interface Section {
  name: string;
  fields: string[];
  records: number;
}

interface Issue {
  line: number;
  message: string;
}

interface Model {
  sections: Section[];
  recordCount: number;
  issues: Issue[];
}

function parseIif(text: string): Model {
  const lines = text.replace(/\r\n|\r/g, '\n').split('\n');
  const sections: Section[] = [];
  const issues: Issue[] = [];
  let recordCount = 0;
  let current: Section | null = null;
  const openSections = new Map<string, number>();

  for (let i = 0; i < lines.length; i += 1) {
    const ln = (lines[i] ?? '').replace(/\s+$/, '');
    if (ln === '') continue;
    if (ln.startsWith('!')) {
      const body = ln.slice(1);
      const cols = body.split('\t');
      const name = cols[0] ?? '';
      if (name.startsWith('END')) {
        const section = name.slice(3);
        const start = openSections.get(section);
        if (start === undefined) {
          issues.push({
            line: i + 1,
            message: 'END marker "' + name + '" has no matching "' + section + '" section.',
          });
        } else {
          openSections.delete(section);
          current = null;
        }
      } else {
        // header row: defines fields for this section
        const sec: Section = { name, fields: cols.slice(1), records: 0 };
        sections.push(sec);
        current = sec;
        openSections.set(name, i + 1);
      }
      continue;
    }

    // data row
    recordCount += 1;
    const cols = ln.split('\t');
    if (cols.length === 1 && cols[0] === '') {
      issues.push({ line: i + 1, message: 'A row has no tab-separated fields.' });
      continue;
    }
    const recType = cols[0] ?? '';
    if (current) {
      const expected = current.fields.length;
      const actual = cols.length - 1;
      if (expected > 0 && actual !== expected) {
        issues.push({
          line: i + 1,
          message:
            'Row has ' +
            actual +
            ' fields but the ' +
            current.name +
            ' header defines ' +
            expected +
            '.',
        });
      }
      if (current.name === recType) current.records += 1;
    } else {
      issues.push({
        line: i + 1,
        message: 'Row "' + recType + '" appears before any header section.',
      });
    }
    if (recordCount > MAX_ROWS) break;
  }

  if (openSections.size > 0) {
    for (const [name, line] of openSections) {
      issues.push({ line, message: 'Section "' + name + '" has no END marker.' });
    }
  }

  return { sections, recordCount, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const secList = m.sections.map((s) => s.name + ' x' + s.records).join(', ') || '(none)';
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'QuickBooks IIF'],
      ['Records', String(m.recordCount)],
      ['Sections', String(m.sections.length)],
      ['By section', secList],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableRecords(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.sections.slice(0, max) : [];
  return {
    headers: ['Section', 'Records', 'Fields'],
    rows: shown.map((s) => [
      s.name,
      String(s.records),
      s.fields.slice(0, 6).join(', ') || '(none)',
    ]),
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['Line', 'Problem'],
    rows: m.issues.map((g) => [String(g.line), g.message]),
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
    throw new ToolError('No IIF file was provided.', 'Paste or drop a QuickBooks IIF data file.');
  if (text.length > MAX_CHARS) throw new ToolError('That IIF file is larger than 1 MB.');

  const m = parseIif(text);
  if (m.recordCount === 0)
    throw new ToolError('That does not look like a QuickBooks IIF data file.');

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'records':
      table = tableRecords(m, maxRows);
      break;
    case 'issues':
      table = tableIssues(m);
      break;
    case 'summary':
    default:
      table = tableSummary(m);
  }

  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
