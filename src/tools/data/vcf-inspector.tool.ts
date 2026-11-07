import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './vcf-inspector.meta';

/**
 * vCard (.vcf) inspector.
 *
 * Unfolds vCard content lines, counts VCARD entries, lists each field with its
 * parameters, and reports structural problems: missing VERSION/FN, an
 * unterminated card, a line with no colon, or a duplicate FN. Expected values
 * come from the byte-exact fixture, never from this parser.
 */

const MAX_CHARS = 1000000;
const MAX_CARDS = 20000;

interface VcfField {
  name: string;
  params: string[];
  value: string;
}

interface VcfCard {
  fields: VcfField[];
  line: number;
}

interface Issue {
  message: string;
}

interface Model {
  cards: VcfCard[];
  issues: Issue[];
}

function unfold(text: string): string {
  return text.replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '');
}

function parseVcf(text: string): Model {
  const lines = unfold(text).split('\n');
  const cards: VcfCard[] = [];
  const issues: Issue[] = [];
  let current: VcfCard | null = null;
  const seenFn = new Set<string>();
  const seenUids = new Set<string>();

  for (let i = 0; i < lines.length; i += 1) {
    const ln = (lines[i] ?? '').trim();
    if (ln === '') continue;
    if (ln.startsWith('BEGIN:VCARD')) {
      current = { fields: [], line: i + 1 };
      cards.push(current);
      if (cards.length > MAX_CARDS) break;
      continue;
    }
    if (ln.startsWith('END:VCARD')) {
      if (current) {
        current = null;
      } else {
        issues.push({ message: 'END:VCARD on line ' + (i + 1) + ' has no matching BEGIN:VCARD.' });
      }
      continue;
    }

    const colon = ln.indexOf(':');
    if (colon === -1) {
      issues.push({
        message: 'Line ' + (i + 1) + ' has no colon separating the field name from its value.',
      });
      continue;
    }
    const namePart = ln.slice(0, colon);
    const value = ln.slice(colon + 1);
    const parts = namePart.split(';');
    const name = (parts[0] ?? '').toUpperCase();
    const params = parts
      .slice(1)
      .map((p) => p.trim())
      .filter((p) => p !== '');
    if (current) current.fields.push({ name, params, value });
  }

  if (current) {
    issues.push({
      message: 'A VCARD beginning on line ' + current.line + ' is missing its END:VCARD.',
    });
  }

  if (cards.length === 0) {
    throw new ToolError('That does not look like a vCard contact file.');
  }

  for (const c of cards) {
    if (!c.fields.some((f) => f.name === 'VERSION')) {
      issues.push({ message: 'Card on line ' + c.line + ' is missing the VERSION field.' });
    }
    const fn = c.fields.find((f) => f.name === 'FN');
    if (!fn || fn.value === '') {
      issues.push({ message: 'Card on line ' + c.line + ' is missing a formatted name (FN).' });
    } else {
      const norm = fn.value.toLowerCase();
      if (seenFn.has(norm)) {
        issues.push({ message: 'Duplicate formatted name "' + fn.value + '" across cards.' });
      } else {
        seenFn.add(norm);
      }
    }
    for (const f of c.fields) {
      if (f.name === 'UID' && f.value !== '') {
        if (seenUids.has(f.value)) {
          issues.push({ message: 'Duplicate UID "' + f.value + '".' });
        } else {
          seenUids.add(f.value);
        }
      }
    }
  }

  return { cards, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  let totalFields = 0;
  for (const c of m.cards) totalFields += c.fields.length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'vCard (VCF)'],
      ['Cards', String(m.cards.length)],
      ['Fields', String(totalFields)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableCards(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.cards.slice(0, max) : [];
  return {
    headers: ['Card', 'FN', 'Tel', 'Email', 'Line'],
    rows: shown.map((c, idx) => {
      const g = (n: string): string => {
        const f = c.fields.find((x) => x.name === n);
        return f ? f.value : '(none)';
      };
      return [String(idx + 1), g('FN'), g('TEL'), g('EMAIL'), String(c.line)];
    }),
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['Problem'],
    rows: m.issues.map((g) => [g.message]),
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
    throw new ToolError('No contact file was provided.', 'Paste or drop a vCard (.vcf) file.');
  if (text.length > MAX_CHARS) throw new ToolError('That contact file is larger than 1 MB.');

  const m = parseVcf(text);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'cards':
      table = tableCards(m, maxRows);
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
