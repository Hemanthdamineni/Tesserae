import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './pgpass-inspector.meta';

const MAX_CHARS = 1024 * 1024;

interface PgEntry {
  index: number;
  line: number;
  host: string;
  port: string;
  database: string;
  username: string;
  hasPassword: boolean;
}

interface Issue {
  index: number;
  line: number;
  message: string;
}

interface Model {
  entries: PgEntry[];
  issues: Issue[];
}

function splitFields(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? '';
    if (ch === '\\' && i + 1 < line.length) {
      cur += line[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (ch === ':') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parsePgpass(text: string): Model {
  const trimmed = text.trim();
  if (trimmed === '') throw new ToolError('No .pgpass file was provided.', 'Paste a .pgpass file.');
  const lines = trimmed.split(String.fromCharCode(10));
  const entries: PgEntry[] = [];
  const issues: Issue[] = [];
  let index = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    const lineNo = i + 1;
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('#')) continue;

    index += 1;
    const fields = splitFields(line);
    if (fields.length !== 5) {
      issues.push({
        index,
        line: lineNo,
        message: 'Expected 5 colon-separated fields, found ' + String(fields.length) + '.',
      });
      entries.push({
        index,
        line: lineNo,
        host: fields[0] ?? '',
        port: fields[1] ?? '',
        database: fields[2] ?? '',
        username: fields[3] ?? '',
        hasPassword: false,
      });
      continue;
    }
    const host = fields[0] ?? '';
    const port = fields[1] ?? '';
    const database = fields[2] ?? '';
    const username = fields[3] ?? '';
    const password = fields[4] ?? '';
    if (host === '') issues.push({ index, line: lineNo, message: 'Hostname field is empty.' });
    if (database === '') issues.push({ index, line: lineNo, message: 'Database field is empty.' });
    if (username === '') issues.push({ index, line: lineNo, message: 'Username field is empty.' });
    if (password === '') issues.push({ index, line: lineNo, message: 'Password field is empty.' });
    entries.push({
      index,
      line: lineNo,
      host,
      port,
      database,
      username,
      hasPassword: password !== '',
    });
  }

  if (entries.length === 0) throw new ToolError('That does not look like a .pgpass file.');
  return { entries, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const withPw = m.entries.filter((e) => e.hasPassword).length;
  const wildcardHost = m.entries.filter((e) => e.host === '*').length;
  const wildcardDb = m.entries.filter((e) => e.database === '*').length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Entries', String(m.entries.length)],
      ['Entries with password', String(withPw)],
      ['Wildcard host entries', String(wildcardHost)],
      ['Wildcard database entries', String(wildcardDb)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableEntries(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Line', 'Host', 'Port', 'Database', 'Username', 'Password set'],
    rows: m.entries.map((e) => [
      String(e.index),
      String(e.line),
      e.host === '' ? '-' : e.host,
      e.port === '' ? '-' : e.port,
      e.database === '' ? '-' : e.database,
      e.username === '' ? '-' : e.username,
      e.hasPassword ? 'yes' : 'no',
    ]),
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['#', 'Line', 'Problem'],
    rows: m.issues.map((g) => [String(g.index), String(g.line), g.message]),
  };
}

function asTable(table: { headers: string[]; rows: string[][] }): TextRunResult {
  return { output: JSON.stringify(table), render: 'table' };
}

function run(input: TextRunInput): TextRunResult {
  const options = input.options;
  const format = String(options.format ?? 'summary');
  const text = input.text ?? '';
  if (text.trim().length === 0)
    throw new ToolError('No .pgpass file was provided.', 'Paste a .pgpass file.');
  if (text.length > MAX_CHARS) throw new ToolError('That .pgpass file is larger than 1 MB.');

  const m = parsePgpass(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'entries') table = tableEntries(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
