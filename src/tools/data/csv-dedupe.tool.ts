import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './csv-dedupe.meta';

/**
 * CSV duplicate remover.
 *
 * Parses CSV with RFC 4180 quoting (embedded commas and doubled quotes), then
 * groups rows by their whole-row key or by chosen columns. Reports the
 * original, distinct and removed counts, the repeated rows, and a preview of
 * the deduplicated result. Expected values come from an independent Python csv
 * parser, never from this parser.
 */

const MAX_CHARS = 8 * 1024 * 1024;
const MAX_ROWS = 200000;

interface Table {
  header: string[];
  rows: string[][];
}

interface Group {
  key: string;
  count: number;
  firstIndex: number;
  row: string[];
}

function parseCsv(text: string): Table {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.length > 1 || (r[0] ?? '') !== '');
  if (nonEmpty.length === 0) throw new ToolError('No CSV rows were found.');
  const header = nonEmpty[0] as string[];
  const body = nonEmpty.slice(1);
  if (body.length === 0) throw new ToolError('That CSV has a header but no data rows.');
  if (body.length > MAX_ROWS) throw new ToolError('That CSV has more than 200,000 rows.');
  return { header, rows: body };
}

function resolveColumns(table: Table, options: Record<string, unknown>): number[] {
  const raw = String(options.columns ?? '').trim();
  if (raw === '') return table.header.map((_, i) => i);
  const wanted = raw
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c !== '');
  const picked: number[] = [];
  for (const name of wanted) {
    let found = -1;
    for (let i = 0; i < table.header.length; i += 1) {
      if ((table.header[i] ?? '').toLowerCase() === name) {
        found = i;
        break;
      }
    }
    if (found === -1) throw new ToolError('Column "' + name + '" was not found in the header.');
    picked.push(found);
  }
  if (picked.length === 0) throw new ToolError('Choose at least one column to dedupe by.');
  return picked;
}

function groupRows(table: Table, cols: number[]): Group[] {
  const order: string[] = [];
  const map = new Map<string, Group>();
  for (let r = 0; r < table.rows.length; r += 1) {
    const row = table.rows[r] as string[];
    const key = cols.map((c) => row[c] ?? '').join('\u0001');
    const existing = map.get(key);
    if (existing === undefined) {
      map.set(key, { key, count: 1, firstIndex: r + 1, row });
      order.push(key);
    } else {
      existing.count += 1;
    }
  }
  return order.map((k) => map.get(k) as Group);
}

function tableSummary(
  groups: Group[],
  totalRows: number,
  cols: number[],
  header: string[],
): { headers: string[]; rows: string[][] } {
  let distinct = 0;
  let removed = 0;
  let dupGroups = 0;
  for (const g of groups) {
    if (g.count > 1) {
      dupGroups += 1;
      removed += g.count - 1;
    } else {
      distinct += 1;
    }
  }
  const byName = cols.map((c) => header[c] ?? 'column ' + (c + 1)).join(', ');
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Original rows', String(totalRows)],
      ['Distinct rows', String(groups.length)],
      ['Unique rows', String(distinct)],
      ['Duplicate groups', String(dupGroups)],
      ['Removable rows', String(removed)],
      ['Deduped by', byName],
    ],
  };
}

function tableDuplicates(
  groups: Group[],
  header: string[],
  max: number,
): { headers: string[]; rows: string[][] } {
  const dups = groups.filter((g) => g.count > 1);
  const shown = max > 0 ? dups.slice(0, max) : [];
  return {
    headers: ['First row', 'Repeats', ...header],
    rows: shown.map((g) => [String(g.firstIndex), String(g.count), ...g.row]),
  };
}

function tableResult(groups: Group[], max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? groups.slice(0, max) : [];
  return {
    headers: ['Row'],
    rows: shown.map((g) => [g.row.join(',')]),
  };
}

function run(input: TextRunInput): TextRunResult {
  const options = input.options;
  const mode = String(options.mode ?? 'dedupe');
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(50000, Number(options.maxRows ?? 100) || 0));

  const text = input.text ?? '';
  if (text.trim().length === 0)
    throw new ToolError('No CSV was provided.', 'Paste a CSV to remove duplicate rows.');
  if (text.length > MAX_CHARS) throw new ToolError('That CSV is larger than 8 MB.');

  const table = parseCsv(text);
  const cols =
    mode === 'by-column' ? resolveColumns(table, options) : table.header.map((_, i) => i);
  const groups = groupRows(table, cols);

  let out: { headers: string[]; rows: string[][] };
  if (format === 'duplicates') out = tableDuplicates(groups, table.header, maxRows);
  else if (format === 'result') out = tableResult(groups, maxRows);
  else out = tableSummary(groups, table.rows.length, cols, table.header);

  return { output: JSON.stringify(out), render: 'table' };
}

const tool: TextToolModule = { meta, run };
export default tool;
