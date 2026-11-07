import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './ics-validator.meta';

/**
 * iCalendar (.ics) validator.
 *
 * Unfolds RFC 5545 content lines, counts the VCALENDAR/VEVENT/VTODO/VALARM
 * components, and reports structural problems: missing VCALENDAR/VERSION,
 * unbalanced BEGIN/END, empty or duplicated UIDs, missing required properties,
 * and malformed date-time values. Expected values come from the byte-exact
 * fixture, never from this parser.
 */

const MAX_CHARS = 1000000;
const MAX_COMPONENTS = 20000;

interface IcsComponent {
  kind: string;
  props: Map<string, string>;
  line: number;
}

interface Issue {
  kind: string;
  message: string;
}

function unfold(text: string): string {
  // RFC 5545 line-folding: a CRLF followed by a single space/tab continues
  // the previous line. Join folded lines and drop the fold whitespace.
  return text.replace(/\r\n|\r|\n/g, '\n').replace(/\n[ \t]/g, '');
}

const DATE_RE = /^(\d{4})(\d{2})(\d{2})$/;
const DATETIME_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;

function validDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  return validDateParts(m);
}

function validDateTime(s: string): boolean {
  const m = DATETIME_RE.exec(s);
  if (!m) return false;
  return validDateParts(m);
}

function validDateParts(m: RegExpExecArray): boolean {
  const y = parseInt(m[1] ?? '0', 10);
  const mo = parseInt(m[2] ?? '0', 10);
  const d = parseInt(m[3] ?? '0', 10);
  if (y < 1 || mo < 1 || mo > 12 || d < 1) return false;
  const dim = [
    31,
    y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return d <= (dim[mo - 1] ?? 31);
}

function parseIcs(text: string): { components: IcsComponent[]; issues: Issue[] } {
  const lines = unfold(text).split('\n');
  const components: IcsComponent[] = [];
  const issues: Issue[] = [];
  const stack: IcsComponent[] = [];
  const seenUids = new Map<string, number>();

  let i = 0;
  while (i < lines.length) {
    const ln = (lines[i] ?? '').trim();
    if (ln === '') {
      i += 1;
      continue;
    }
    if (ln.startsWith('BEGIN:')) {
      const kind = ln.slice(6).trim();
      const comp: IcsComponent = { kind, props: new Map<string, string>(), line: i + 1 };
      stack.push(comp);
      components.push(comp);
      if (components.length > MAX_COMPONENTS) break;
      i += 1;
      continue;
    }
    if (ln.startsWith('END:')) {
      const kind = ln.slice(4).trim();
      const top = stack[stack.length - 1];
      if (!top) {
        issues.push({
          kind,
          message: 'END:' + kind + ' on line ' + (i + 1) + ' has no matching BEGIN.',
        });
      } else if (top.kind !== kind) {
        issues.push({
          kind,
          message:
            'END:' + kind + ' on line ' + (i + 1) + ' does not match BEGIN:' + top.kind + '.',
        });
        stack.pop();
      } else {
        stack.pop();
      }
      i += 1;
      continue;
    }

    // property content line: NAME[;params]:value
    const colon = ln.indexOf(':');
    if (colon === -1) {
      i += 1;
      continue;
    }
    const namePart = ln.slice(0, colon);
    const value = ln.slice(colon + 1);
    const name = namePart.split(';')[0] ?? '';
    const comp = stack[stack.length - 1];
    if (comp && name !== '') comp.props.set(name, value);
    i += 1;
  }

  if (stack.length > 0) {
    for (const c of stack) {
      issues.push({
        kind: c.kind,
        message:
          'Component ' + c.kind + ' starting on line ' + c.line + ' is missing END:' + c.kind + '.',
      });
    }
  }

  // validate per-component
  const hasCalendar = components.some((c) => c.kind === 'VCALENDAR');
  if (!hasCalendar)
    issues.push({ kind: 'VCALENDAR', message: 'No VCALENDAR component was found.' });

  for (const c of components) {
    if (c.kind === 'VCALENDAR') {
      if (!c.props.has('VERSION'))
        issues.push({ kind: c.kind, message: 'VCALENDAR is missing the VERSION property.' });
      if (!c.props.has('PRODID'))
        issues.push({ kind: c.kind, message: 'VCALENDAR is missing the PRODID property.' });
    } else if (c.kind === 'VEVENT') {
      const uid = c.props.get('UID');
      if (!uid || uid === '') {
        issues.push({ kind: c.kind, message: 'VEVENT on line ' + c.line + ' is missing a UID.' });
      } else {
        const prev = seenUids.get(uid);
        if (prev !== undefined) {
          issues.push({
            kind: c.kind,
            message: 'Duplicate UID "' + uid + '" also used on line ' + prev + '.',
          });
        } else {
          seenUids.set(uid, c.line);
        }
      }
      if (!c.props.has('DTSTAMP'))
        issues.push({ kind: c.kind, message: 'VEVENT on line ' + c.line + ' is missing DTSTAMP.' });
      if (!c.props.has('SUMMARY'))
        issues.push({ kind: c.kind, message: 'VEVENT on line ' + c.line + ' is missing SUMMARY.' });
      const ds = c.props.get('DTSTART');
      if (ds && !validDateTime(ds) && !validDate(ds)) {
        issues.push({
          kind: c.kind,
          message: 'VEVENT DTSTART "' + ds + '" is not a valid date-time.',
        });
      }
      const de = c.props.get('DTEND');
      if (de && !validDateTime(de) && !validDate(de)) {
        issues.push({
          kind: c.kind,
          message: 'VEVENT DTEND "' + de + '" is not a valid date-time.',
        });
      }
    } else if (c.kind === 'VTODO') {
      if (!c.props.has('SUMMARY'))
        issues.push({ kind: c.kind, message: 'VTODO on line ' + c.line + ' is missing SUMMARY.' });
    }
  }

  return { components, issues };
}

function tableSummary(
  components: IcsComponent[],
  issues: Issue[],
): { headers: string[]; rows: string[][] } {
  const kinds = new Map<string, number>();
  let totalProps = 0;
  for (const c of components) {
    kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
    totalProps += c.props.size;
  }
  const kindList =
    Array.from(kinds.entries())
      .map(([k, n]) => k + ' x' + n)
      .join(', ') || '(none)';
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'iCalendar (ICS)'],
      ['Components', String(components.length)],
      ['Properties', String(totalProps)],
      ['Kinds', kindList],
      ['Issues', String(issues.length)],
    ],
  };
}

function tableComponents(
  components: IcsComponent[],
  max: number,
): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? components.slice(0, max) : [];
  return {
    headers: ['Kind', 'Line', 'Key properties'],
    rows: shown.map((c) => {
      const keys = Array.from(c.props.keys()).slice(0, 4).join(', ') || '(none)';
      return [c.kind, String(c.line), keys];
    }),
  };
}

function tableIssues(issues: Issue[]): { headers: string[]; rows: string[][] } {
  if (issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['Component', 'Problem'],
    rows: issues.map((g) => [g.kind, g.message]),
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
    throw new ToolError(
      'No calendar file was provided.',
      'Paste or drop an iCalendar (.ics) file.',
    );
  if (text.length > MAX_CHARS) throw new ToolError('That calendar file is larger than 1 MB.');

  const { components, issues } = parseIcs(text);
  if (components.length === 0)
    throw new ToolError('That does not look like an iCalendar (.ics) file.');

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'components':
      table = tableComponents(components, maxRows);
      break;
    case 'issues':
      table = tableIssues(issues);
      break;
    case 'summary':
    default:
      table = tableSummary(components, issues);
  }

  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
