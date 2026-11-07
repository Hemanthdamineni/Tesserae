import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './npmrc-inspector.meta';

const MAX_CHARS = 1024 * 1024;

interface Setting {
  index: number;
  line: number;
  key: string;
  value: string;
  isAuthToken: boolean;
  isScoped: boolean;
}

interface Issue {
  index: number;
  line: number;
  message: string;
}

interface Model {
  settings: Setting[];
  issues: Issue[];
}

function parseNpmrc(text: string): Model {
  const trimmed = text.trim();
  if (trimmed === '') throw new ToolError('No .npmrc file was provided.', 'Paste an .npmrc file.');
  const lines = trimmed.split(String.fromCharCode(10));
  const settings: Setting[] = [];
  const issues: Issue[] = [];
  const seen = new Map<string, number>();
  let index = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    const lineNo = i + 1;
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('#') || line.startsWith(';')) continue;

    index += 1;
    const eq = line.indexOf('=');
    if (eq === -1) {
      issues.push({ index, line: lineNo, message: 'Line has no equals sign: "' + line + '".' });
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    const isAuthToken = /_authToken$/i.test(key);
    const isScoped = key.startsWith('@');

    if (key === '') {
      issues.push({ index, line: lineNo, message: 'Key is empty.' });
    } else {
      const prev = seen.get(key);
      if (prev !== undefined) {
        issues.push({
          index,
          line: lineNo,
          message: 'Key "' + key + '" is set more than once (first on line ' + String(prev) + ').',
        });
      } else {
        seen.set(key, lineNo);
      }
    }
    if (value === '' && !isAuthToken) {
      issues.push({ index, line: lineNo, message: 'Value for "' + key + '" is empty.' });
    }
    settings.push({ index, line: lineNo, key, value, isAuthToken, isScoped });
  }

  if (settings.length === 0) throw new ToolError('That does not look like an .npmrc file.');
  return { settings, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const scoped = m.settings.filter((s) => s.isScoped).length;
  const tokens = m.settings.filter((s) => s.isAuthToken).length;
  const flags = m.settings.filter((s) => s.value === 'true' || s.value === 'false').length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Settings', String(m.settings.length)],
      ['Scoped registries', String(scoped)],
      ['Auth tokens', String(tokens)],
      ['Boolean flags', String(flags)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableSettings(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Line', 'Key', 'Value'],
    rows: m.settings.map((s) => [
      String(s.index),
      String(s.line),
      s.key === '' ? '(empty)' : s.key,
      s.isAuthToken ? '(hidden)' : s.value === '' ? '(empty)' : s.value,
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
    throw new ToolError('No .npmrc file was provided.', 'Paste an .npmrc file.');
  if (text.length > MAX_CHARS) throw new ToolError('That .npmrc file is larger than 1 MB.');

  const m = parseNpmrc(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'settings') table = tableSettings(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
