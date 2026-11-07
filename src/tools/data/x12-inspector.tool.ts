import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './x12-inspector.meta';

/**
 * ANSI X12 EDI inspector.
 *
 * Splits an interchange into segments on the tilde and elements on the
 * asterisk, then reports the ISA/GS/ST envelopes, control numbers, segment
 * counts, and structural problems. Expected values come from the byte-exact
 * fixture, never from this parser.
 */

const MAX_CHARS = 1000000;

interface Transaction {
  id: string;
  control: string;
  segments: number;
  line: number;
}

interface Issue {
  segment: string;
  message: string;
}

interface Model {
  segments: number;
  elements: number;
  interchangeControl: string;
  groupControl: string;
  transactions: Transaction[];
  issues: Issue[];
}

function parseX12(text: string): Model {
  const issues: Issue[] = [];
  const segments = text
    .replace(/\r\n|\r/g, '\n')
    .split('~')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  const transactions: Transaction[] = [];
  let elements = 0;
  let txStart = 0;

  if (segments.length === 0) {
    throw new ToolError('That does not look like an X12 EDI document.');
  }

  let interchangeControl = '';
  let groupControl = '';
  const stack: string[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i] ?? '';
    const parts = seg.split('*');
    const id = parts[0] ?? '';
    elements += parts.length;

    if (id === 'ISA') {
      interchangeControl = parts[13] ?? '';
      stack.push('ISA');
    } else if (id === 'IEA') {
      if (stack[stack.length - 1] !== 'ISA') {
        issues.push({ segment: id, message: 'IEA on line ' + (i + 1) + ' has no matching ISA.' });
      } else {
        stack.pop();
      }
      if (interchangeControl !== '' && (parts[2] ?? '') !== interchangeControl) {
        issues.push({ segment: id, message: 'IEA control number does not match the ISA.' });
      }
    } else if (id === 'GS') {
      groupControl = parts[6] ?? '';
      stack.push('GS');
    } else if (id === 'GE') {
      if (stack[stack.length - 1] !== 'GS') {
        issues.push({ segment: id, message: 'GE on line ' + (i + 1) + ' has no matching GS.' });
      } else {
        stack.pop();
      }
      if (groupControl !== '' && (parts[2] ?? '') !== groupControl) {
        issues.push({ segment: id, message: 'GE control number does not match the GS.' });
      }
    } else if (id === 'ST') {
      txStart = i;
      transactions.push({ id: parts[1] ?? '', control: parts[2] ?? '', segments: 0, line: i + 1 });
      stack.push('ST');
    } else if (id === 'SE') {
      const top = transactions[transactions.length - 1];
      if (stack[stack.length - 1] !== 'ST') {
        issues.push({ segment: id, message: 'SE on line ' + (i + 1) + ' has no matching ST.' });
      } else {
        stack.pop();
      }
      if (top) top.segments = i - txStart + 1;
      if (top && (parts[2] ?? '') !== top.control) {
        issues.push({ segment: id, message: 'SE control number does not match its ST.' });
      }
    }
  }

  if (stack.length > 0) {
    issues.push({
      segment: stack[stack.length - 1] ?? '?',
      message: 'Unterminated ' + stack[stack.length - 1] + ' envelope.',
    });
  }

  if (segments[0] !== undefined && !segments[0].startsWith('ISA')) {
    issues.push({ segment: '?', message: 'The first segment is not an ISA interchange header.' });
  }

  return {
    segments: segments.length,
    elements,
    interchangeControl,
    groupControl,
    transactions,
    issues,
  };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'ANSI X12 EDI'],
      ['Segments', String(m.segments)],
      ['Elements', String(m.elements)],
      ['Transactions', String(m.transactions.length)],
      ['ISA control', m.interchangeControl || '(none)'],
      ['GS control', m.groupControl || '(none)'],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableTransactions(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.transactions.slice(0, max) : [];
  return {
    headers: ['Set', 'Control', 'Segments', 'Line'],
    rows: shown.map((t) => [t.id || '(none)', t.control, String(t.segments), String(t.line)]),
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['Segment', 'Problem'],
    rows: m.issues.map((g) => [g.segment, g.message]),
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
    throw new ToolError('No EDI document was provided.', 'Paste or drop an X12 interchange.');
  if (text.length > MAX_CHARS) throw new ToolError('That EDI document is larger than 1 MB.');

  const m = parseX12(text);
  if (m.segments === 0) throw new ToolError('That does not look like an X12 EDI document.');

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'transactions':
      table = tableTransactions(m, maxRows);
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
