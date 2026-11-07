import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './gitmodules-inspector.meta';

const MAX_CHARS = 1024 * 1024;

interface Submodule {
  index: number;
  name: string;
  path: string;
  url: string;
  branch: string;
}

interface Issue {
  index: number;
  line: number;
  message: string;
}

interface Model {
  submodules: Submodule[];
  issues: Issue[];
}

function parseGitmodules(text: string): Model {
  const trimmed = text.trim();
  if (trimmed === '')
    throw new ToolError('No .gitmodules file was provided.', 'Paste a .gitmodules file.');
  const lines = trimmed.split(String.fromCharCode(10));
  const submodules: Submodule[] = [];
  const issues: Issue[] = [];
  let current: Partial<Submodule> | null = null;
  let name = '';
  let sectionLine = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    const lineNo = i + 1;
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;

    const sec = /^\[submodule\s+"([^"]*)"\]$/.exec(line);
    if (sec !== null) {
      if (current !== null) {
        finish(current, name, sectionLine, submodules, issues);
      }
      name = sec[1] ?? '';
      current = {};
      sectionLine = lineNo;
      if (name === '') {
        issues.push({
          index: submodules.length + 1,
          line: lineNo,
          message: 'Submodule section has an empty name.',
        });
      }
      continue;
    }

    const otherSec = /^\[([^\]]+)\]$/.exec(line);
    if (otherSec !== null) {
      if (current !== null) {
        finish(current, name, sectionLine, submodules, issues);
      }
      name = otherSec[1] ?? '';
      current = {};
      sectionLine = lineNo;
      continue;
    }

    const kv = /^([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*(.*)$/.exec(line);
    if (kv === null) {
      issues.push({
        index: submodules.length + 1,
        line: lineNo,
        message: 'Malformed line: "' + line + '".',
      });
      continue;
    }
    if (current === null) {
      issues.push({
        index: submodules.length + 1,
        line: lineNo,
        message: 'Key "' + (kv[1] ?? '') + '" appears outside a section.',
      });
      continue;
    }
    const key = (kv[1] ?? '').toLowerCase();
    const value = (kv[2] ?? '').trim();
    if (key === 'path') (current as { path?: string }).path = value;
    else if (key === 'url') (current as { url?: string }).url = value;
    else if (key === 'branch') (current as { branch?: string }).branch = value;
  }
  if (current !== null) {
    finish(current, name, sectionLine, submodules, issues);
  }

  if (submodules.length === 0 && issues.length === 0) {
    throw new ToolError('That does not look like a .gitmodules file.');
  }
  return { submodules, issues };
}

function finish(
  cur: Partial<Submodule>,
  name: string,
  line: number,
  submodules: Submodule[],
  issues: Issue[],
): void {
  const path = cur.path ?? '';
  const url = cur.url ?? '';
  const branch = cur.branch ?? '';
  const idx = submodules.length + 1;
  if (path === '')
    issues.push({ index: idx, line, message: 'Submodule "' + name + '" has no path.' });
  else if (name !== '' && path !== name) {
    issues.push({
      index: idx,
      line,
      message: 'Submodule path "' + path + '" does not match section name "' + name + '".',
    });
  }
  if (url === '')
    issues.push({
      index: idx,
      line,
      message: 'Submodule "' + (path === '' ? name : path) + '" has no url.',
    });
  submodules.push({ index: idx, name, path, url, branch });
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const withUrl = m.submodules.filter((s) => s.url !== '').length;
  const withPath = m.submodules.filter((s) => s.path !== '').length;
  const withBranch = m.submodules.filter((s) => s.branch !== '').length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Submodules', String(m.submodules.length)],
      ['With path', String(withPath)],
      ['With URL', String(withUrl)],
      ['With branch', String(withBranch)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableSubmodules(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Name', 'Path', 'URL', 'Branch'],
    rows: m.submodules.map((s) => [
      String(s.index),
      s.name === '' ? '(unnamed)' : s.name,
      s.path === '' ? '(missing)' : s.path,
      s.url === '' ? '(missing)' : s.url,
      s.branch === '' ? '-' : s.branch,
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
    throw new ToolError('No .gitmodules file was provided.', 'Paste a .gitmodules file.');
  if (text.length > MAX_CHARS) throw new ToolError('That .gitmodules file is larger than 1 MB.');

  const m = parseGitmodules(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'submodules') table = tableSubmodules(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
