import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './ldif-inspector.meta';

const MAX_CHARS = 4 * 1024 * 1024;

interface LdapEntry {
  index: number;
  dn: string;
  attributes: string[];
  lines: number;
}

interface Issue {
  index: number;
  line: number;
  message: string;
}

interface Model {
  entries: LdapEntry[];
  attributeTypes: string[];
  issues: Issue[];
}

function validBase64(s: string): boolean {
  if (s.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(s);
}

function parseLdif(text: string): Model {
  const trimmed = text.trim();
  if (trimmed === '') throw new ToolError('No LDIF file was provided.', 'Paste an LDIF file.');
  const lines = trimmed.split(String.fromCharCode(10));
  const entries: LdapEntry[] = [];
  const issues: Issue[] = [];
  const attrSet = new Set<string>();

  let current: LdapEntry | null = null;
  let lastAttr = '';

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const lineNo = i + 1;
    if (line.trim() === '') {
      if (current !== null) {
        entries.push(current);
        current = null;
        lastAttr = '';
      }
      continue;
    }
    if (line.startsWith(' ')) {
      // continuation line
      if (current === null || lastAttr === '') {
        issues.push({
          index: entries.length + 1,
          line: lineNo,
          message: 'Continuation line has no attribute before it.',
        });
      }
      continue;
    }
    if (/^#/.test(line)) continue;

    if (current === null) {
      current = { index: entries.length + 1, dn: '', attributes: [], lines: 0 };
    }
    current.lines += 1;

    const colon = line.indexOf(':');
    if (colon === -1) {
      issues.push({
        index: current.index,
        line: lineNo,
        message: 'Line has no colon: "' + line + '".',
      });
      continue;
    }
    const attr = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1);
    const base64Value = rest.startsWith(':');
    const value = base64Value ? rest.slice(1).trim() : rest.trim();
    lastAttr = attr;

    if (attr.toLowerCase() === 'dn') {
      current.dn = value;
      if (value === '')
        issues.push({ index: current.index, line: lineNo, message: 'Entry has an empty DN.' });
    } else {
      current.attributes.push(attr);
      attrSet.add(attr);
      if (base64Value && !validBase64(value)) {
        issues.push({
          index: current.index,
          line: lineNo,
          message: 'Base64 value for "' + attr + '" is not valid.',
        });
      }
    }
  }
  if (current !== null) entries.push(current);

  for (const e of entries) {
    if (e.dn === '')
      issues.push({ index: e.index, line: e.lines > 0 ? 1 : 1, message: 'Entry has no DN.' });
  }

  if (entries.length === 0) throw new ToolError('That does not look like an LDIF file.');
  return { entries, attributeTypes: Array.from(attrSet), issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const attrCount = m.entries.reduce((acc, e) => acc + e.attributes.length, 0);
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Entries', String(m.entries.length)],
      ['Attribute lines', String(attrCount)],
      ['Distinct attribute types', String(m.attributeTypes.length)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableEntries(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'DN', 'Attributes', 'Lines'],
    rows: m.entries.map((e) => [
      String(e.index),
      e.dn === '' ? '(missing)' : e.dn,
      String(e.attributes.length),
      String(e.lines),
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
    throw new ToolError('No LDIF file was provided.', 'Paste an LDIF file.');
  if (text.length > MAX_CHARS) throw new ToolError('That LDIF file is larger than 4 MB.');

  const m = parseLdif(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'entries') table = tableEntries(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
