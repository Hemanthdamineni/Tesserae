import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './codeowners-validator.meta';

const MAX_CHARS = 2 * 1024 * 1024;

interface Rule {
  index: number;
  pattern: string;
  owners: string[];
  line: number;
}

interface Issue {
  index: number;
  line: number;
  message: string;
}

interface Model {
  rules: Rule[];
  comments: number;
  blankLines: number;
  issues: Issue[];
}

function validOwner(owner: string): boolean {
  if (owner.startsWith('@')) {
    const rest = owner.slice(1);
    if (rest === '') return false;
    if (rest.includes('/')) {
      const org = rest.split('/')[0] ?? '';
      const team = rest.split('/')[1] ?? '';
      const ok = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(org) && /^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(team);
      return ok;
    }
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(rest);
  }
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner);
}

function parse(text: string): Model {
  const trimmed = text.trim();
  if (trimmed === '')
    throw new ToolError('No CODEOWNERS file was provided.', 'Paste a CODEOWNERS file.');
  const lines = trimmed.split('\n');
  const rules: Rule[] = [];
  const issues: Issue[] = [];
  let comments = 0;
  let blankLines = 0;
  let idx = 0;
  for (let li = 0; li < lines.length; li += 1) {
    const line = lines[li] as string;
    if (line.trim() === '') {
      blankLines += 1;
      continue;
    }
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('#')) {
      comments += 1;
      continue;
    }
    idx += 1;
    const parts = trimmedLine.split(/\s+/).filter((p) => p !== '');
    const pattern = parts[0] ?? '';
    const owners = parts.slice(1);
    const ruleIdx = idx;
    const lineNo = li + 1;
    if (pattern === '') {
      issues.push({ index: ruleIdx, line: lineNo, message: 'Rule has no pattern.' });
      continue;
    }
    if (owners.length === 0) {
      issues.push({
        index: ruleIdx,
        line: lineNo,
        message: 'Pattern "' + pattern + '" has no owners.',
      });
    } else {
      for (const owner of owners) {
        if (!validOwner(owner)) {
          issues.push({
            index: ruleIdx,
            line: lineNo,
            message: 'Owner "' + owner + '" is not a valid user, team or email.',
          });
        }
      }
    }
    if (!pattern.startsWith('/') && !pattern.startsWith('*')) {
      issues.push({
        index: ruleIdx,
        line: lineNo,
        message: 'Pattern "' + pattern + '" should start with / or *.',
      });
    }
    rules.push({ index: ruleIdx, pattern, owners, line: lineNo });
  }
  if (rules.length === 0 && comments === 0 && blankLines === 0) {
    throw new ToolError('That does not look like a CODEOWNERS file.');
  }
  return { rules, comments, blankLines, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const withOwners = m.rules.filter((r) => r.owners.length > 0).length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Rules', String(m.rules.length)],
      ['Rules with owners', String(withOwners)],
      ['Comments', String(m.comments)],
      ['Blank lines', String(m.blankLines)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableRules(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Line', 'Pattern', 'Owners'],
    rows: m.rules.map((r) => [
      String(r.index),
      String(r.line),
      r.pattern,
      r.owners.join(', ') || '(none)',
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
    throw new ToolError('No CODEOWNERS file was provided.', 'Paste a CODEOWNERS file.');
  if (text.length > MAX_CHARS) throw new ToolError('That CODEOWNERS file is larger than 2 MB.');
  const m = parse(text);
  let table: { headers: string[]; rows: string[][] };
  if (format === 'rules') table = tableRules(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
