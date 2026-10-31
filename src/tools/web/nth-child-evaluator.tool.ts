import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './nth-child-evaluator.meta';

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CHILDREN = 1000;
const MAX_MATCH_SHOW = 40;

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Parsed {
  A: number;
  B: number;
  /** Original trimmed An+B text, e.g. "2n+1" or "even". */
  raw: string;
  kind: 'keyword' | 'integer' | 'dimension' | 'formula';
}

interface Model {
  input: string;
  isOfType: boolean;
  parsed: Parsed | null;
  findings: Finding[];
  children: number;
  /** 1-based index to test, or 0 when not requested. */
  index: number;
} /**
 * Parse a CSS An+B microsyntax value into its coefficients (A, B).
 *
 * Covered forms from the CSS Values An+B grammar:
 *   odd | even            -> 2n+1 | 2n+0
 *   <integer>             -> 0n + B        (e.g. 3)
 *   n | -n | +n           -> 1n+0 | -1n+0
 *   <n-dimension>         -> An+0          (e.g. 2n)
 *   An <sign> B           -> e.g. 2n+1, 2n - 1, -2n + 5, n+2
 *   An-B                  -> e.g. 2n-1, n-2   (no space)
 *   An- B                 -> e.g. 2n- 1       (space after the minus)
 * The offset must carry an explicit sign; a trailing sign with no digits,
 * and a signless offset such as "2n1", are rejected as invalid.
 */
function parseAnb(raw: string, findings: Finding[]): Parsed | null {
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (lower === 'even') return { A: 2, B: 0, raw: t, kind: 'keyword' };
  if (lower === 'odd') return { A: 2, B: 1, raw: t, kind: 'keyword' };

  if (/^[+-]?\d+$/u.test(t)) {
    return { A: 0, B: Number(t), raw: t, kind: 'integer' };
  }

  const m = /^([+-]?)(\d*)[nN]\s*([+-]?)\s*(\d*)$/u.exec(t);
  if (m !== null) {
    const signA = m[1] === '-' ? -1 : 1;
    const coeff = m[2] ?? '';
    const A = signA * (coeff === '' ? 1 : Number(coeff));
    const signB = m[3] ?? '';
    const digitsB = m[4] ?? '';

    if (signB === '' && digitsB !== '') {
      findings.push({
        severity: 'error',
        kind: 'grammar',
        detail: `"${t}" needs a sign before its offset, as in "2n+1".`,
      });
      return null;
    }
    if (signB !== '' && digitsB === '') {
      findings.push({
        severity: 'error',
        kind: 'grammar',
        detail: `"${t}" ends with a sign but no offset digits.`,
      });
      return null;
    }
    const B = digitsB === '' ? 0 : (signB === '-' ? -1 : 1) * Number(digitsB);
    return { A, B, raw: t, kind: 'formula' };
  }

  findings.push({
    severity: 'error',
    kind: 'grammar',
    detail: `"${t}" is not a valid An+B microsyntax value.`,
  });
  return null;
} /** Return the matching 1-based child indices for A n + B with N children. */
function matchingIndices(A: number, B: number, N: number): number[] {
  const out: number[] = [];
  if (N <= 0) return out;
  if (A === 0) {
    if (B >= 1 && B <= N) return [B];
    return out;
  }
  let n = 0;
  const guard = N + 5;
  while (n <= guard) {
    const i = A * n + B;
    if (A > 0 && i > N) break;
    if (A < 0 && i < 1) break;
    if (i >= 1 && i <= N && !out.includes(i)) out.push(i);
    n += 1;
  }
  out.sort((x, y) => x - y);
  return out;
}

/** Whether the 1-based index i is selected by A n + B. */
function matchesIndex(A: number, B: number, i: number): boolean {
  if (i < 1) return false;
  if (A === 0) return i === B;
  const d = i - B;
  if (d % A !== 0) return false;
  return d / A >= 0;
}

/** First few matching indices with no upper bound, capped at limit. */
function firstMatches(A: number, B: number, limit: number): number[] {
  const out: number[] = [];
  let n = 0;
  const guard = limit + 10;
  while (out.length < limit && n <= guard) {
    const i = A * n + B;
    if (i >= 1 && !out.includes(i)) out.push(i);
    n += 1;
  }
  return out.slice(0, limit);
}
function buildModel(text: string, children: number, index: number): Model {
  const t = text.trim();
  const findings: Finding[] = [];
  const isOfType = /:nth-of-type/iu.test(t);
  const wrapped = /^:\s*nth(?:-of-type|-child)\s*\(/iu.test(t);
  let body: string;
  if (wrapped) {
    body = t.replace(/^:\s*nth(?:-of-type|-child)\s*\(/iu, '').replace(/\)\s*$/u, '');
  } else {
    // A bare An+B value is also accepted and treated as :nth-child.
    body = t;
  }
  const parsed = parseAnb(body, findings);
  return { input: t, isOfType, parsed, findings, children, index };
}

function matchesTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Item', 'Value'];
  const rows: string[][] = [];
  if (m.parsed === null) {
    rows.push(['Matches', '(parse failed)']);
    return { headers, rows };
  }
  const { A, B } = m.parsed;
  const indices = matchingIndices(A, B, m.children);
  rows.push(['Selector', m.isOfType ? ':nth-of-type' : ':nth-child']);
  rows.push(['An+B', m.parsed.raw]);
  rows.push(['Coefficients', `A = ${A}, B = ${B}`]);
  rows.push([
    'Formula',
    `${A === 0 ? String(B) : A === 1 ? 'n' : A === -1 ? '-n' : A + 'n'}${B > 0 ? ' + ' + B : B < 0 ? ' - ' + Math.abs(B) : ''}`,
  ]);
  rows.push(['Children', String(m.children)]);
  rows.push(['Matches', indices.length === 0 ? '(none)' : indices.join(', ')]);
  const shown = firstMatches(A, B, MAX_MATCH_SHOW);
  if (shown.length > 0) rows.push(['First matches', shown.join(', ')]);
  if (m.index >= 1) {
    rows.push([`Index ${m.index}`, matchesIndex(A, B, m.index) ? 'matches' : 'does not match']);
  }
  return { headers, rows };
}

function parseTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Item', 'Value'];
  const rows: string[][] = [];
  if (m.parsed === null) {
    rows.push(['Status', 'invalid']);
    return { headers, rows };
  }
  rows.push(['Kind', m.parsed.kind]);
  rows.push(['A', String(m.parsed.A)]);
  rows.push(['B', String(m.parsed.B)]);
  rows.push(['Raw', m.parsed.raw]);
  return { headers, rows };
}

function findingsTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Severity', 'Kind', 'Detail'];
  const rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
  if (rows.length === 0) rows.push(['info', 'ok', 'No findings.']);
  return { headers, rows };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    let text = input.text ?? '';
    if (file !== undefined) {
      if (file.size > MAX_BYTES)
        throw new ToolError('File is too large.', 'Provide a shorter selector.');
      text = await file.text();
    }
    const childrenNum = Number(options.children);
    const children = Number.isFinite(childrenNum)
      ? Math.max(0, Math.min(MAX_CHILDREN, Math.round(childrenNum)))
      : 10;
    const indexNum = Number(options.index);
    const index = Number.isFinite(indexNum) ? Math.max(0, Math.round(indexNum)) : 0;
    const m = buildModel(text, children, index);
    const view = String(options.format ?? 'matches');
    let report: FileRunResult['report'];
    if (view === 'parse') report = { output: JSON.stringify(parseTable(m)), render: 'table' };
    else if (view === 'findings')
      report = { output: JSON.stringify(findingsTable(m)), render: 'table' };
    else report = { output: JSON.stringify(matchesTable(m)), render: 'table' };
    return { outputs: [], report, notes: [], warnings: [] };
  },
};

export default tool;
