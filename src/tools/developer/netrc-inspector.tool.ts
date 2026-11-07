import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './netrc-inspector.meta';

const MAX_CHARS = 1024 * 1024;

interface Machine {
  index: number;
  line: number;
  host: string;
  login: string;
  hasPassword: boolean;
  account: string;
  isDefault: boolean;
}

interface Issue {
  index: number;
  line: number;
  message: string;
}

interface Model {
  machines: Machine[];
  issues: Issue[];
}

function parseNetrc(text: string): Model {
  const trimmed = text.trim();
  if (trimmed === '') throw new ToolError('No netrc file was provided.', 'Paste a .netrc file.');
  const lines = trimmed.split(String.fromCharCode(10));
  const machines: Machine[] = [];
  const issues: Issue[] = [];
  let index = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const lineNo = i + 1;
    const toks = line
      .trim()
      .split(/\s+/)
      .filter((t) => t !== '');
    if (toks.length === 0) continue;
    const head = (toks[0] ?? '').toLowerCase();

    if (head === 'machine') {
      index += 1;
      const host = toks[1] ?? '';
      if (host === '') {
        issues.push({ index, line: lineNo, message: 'machine has no host name.' });
      }
      const rest = toks.slice(2);
      const login = valueAfter(rest, 'login');
      const pass = valueAfter(rest, 'password');
      const account = valueAfter(rest, 'account');
      if (login === '')
        issues.push({ index, line: lineNo, message: 'machine "' + host + '" has no login.' });
      if (pass === '')
        issues.push({ index, line: lineNo, message: 'machine "' + host + '" has no password.' });
      machines.push({
        index,
        line: lineNo,
        host,
        login,
        hasPassword: pass !== '',
        account,
        isDefault: false,
      });
      continue;
    }
    if (head === 'default') {
      index += 1;
      const rest = toks.slice(1);
      const login = valueAfter(rest, 'login');
      const pass = valueAfter(rest, 'password');
      const account = valueAfter(rest, 'account');
      if (login === '')
        issues.push({ index, line: lineNo, message: 'default entry has no login.' });
      if (pass === '')
        issues.push({ index, line: lineNo, message: 'default entry has no password.' });
      machines.push({
        index,
        line: lineNo,
        host: '(default)',
        login,
        hasPassword: pass !== '',
        account,
        isDefault: true,
      });
      continue;
    }
    if (head === 'macdef') {
      issues.push({
        index: index + 1,
        line: lineNo,
        message: 'macdef block is present and not parsed.',
      });
      continue;
    }
    if (head === 'account') {
      continue;
    }
    issues.push({
      index: index + 1,
      line: lineNo,
      message: 'Line does not start with a known netrc token.',
    });
  }

  if (machines.length === 0) {
    throw new ToolError('That does not look like a netrc file.');
  }
  return { machines, issues };
}

function valueAfter(toks: string[], key: string): string {
  for (let i = 0; i < toks.length; i += 1) {
    if ((toks[i] ?? '').toLowerCase() === key) {
      return toks[i + 1] ?? '';
    }
  }
  return '';
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const named = m.machines.filter((x) => !x.isDefault).length;
  const withPass = m.machines.filter((x) => x.hasPassword).length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Entries', String(m.machines.length)],
      ['machine entries', String(named)],
      ['default entry', m.machines.some((x) => x.isDefault) ? 'yes' : 'no'],
      ['Entries with password', String(withPass)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableMachines(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Line', 'Host', 'Login', 'Password set', 'Account'],
    rows: m.machines.map((x) => [
      String(x.index),
      String(x.line),
      x.host,
      x.login === '' ? '-' : x.login,
      x.hasPassword ? 'yes' : 'no',
      x.account === '' ? '-' : x.account,
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
    throw new ToolError('No netrc file was provided.', 'Paste a .netrc file.');
  if (text.length > MAX_CHARS) throw new ToolError('That netrc file is larger than 1 MB.');

  const m = parseNetrc(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'machines') table = tableMachines(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
