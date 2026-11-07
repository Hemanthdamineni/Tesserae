import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './procfile-validator.meta';

const MAX_CHARS = 1024 * 1024;

interface Process {
  index: number;
  line: number;
  type: string;
  command: string;
}

interface Issue {
  index: number;
  line: number;
  message: string;
}

interface Model {
  processes: Process[];
  issues: Issue[];
}

const TYPE_RE = /^[a-zA-Z0-9_-]+$/;

function parseProcfile(text: string): Model {
  const trimmed = text.trim();
  if (trimmed === '') throw new ToolError('No Procfile was provided.', 'Paste a Procfile.');
  const lines = trimmed.split(String.fromCharCode(10));
  const processes: Process[] = [];
  const issues: Issue[] = [];
  const seen = new Map<string, number>();
  let index = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    const lineNo = i + 1;
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('#')) continue;

    const colon = line.indexOf(':');
    if (colon === -1) {
      issues.push({
        index: index + 1,
        line: lineNo,
        message: 'Line has no colon: "' + line + '".',
      });
      continue;
    }
    index += 1;
    const type = line.slice(0, colon).trim();
    const command = line.slice(colon + 1).trim();

    if (type === '') {
      issues.push({ index, line: lineNo, message: 'Process type is empty.' });
    } else if (!TYPE_RE.test(type)) {
      issues.push({
        index,
        line: lineNo,
        message: 'Process type "' + type + '" has invalid characters.',
      });
    }
    if (command === '') {
      issues.push({
        index,
        line: lineNo,
        message: 'Process "' + (type === '' ? '(empty)' : type) + '" has an empty command.',
      });
    }
    if (type !== '') {
      const prev = seen.get(type);
      if (prev !== undefined) {
        issues.push({
          index,
          line: lineNo,
          message:
            'Process type "' +
            type +
            '" is declared more than once (first on line ' +
            String(prev) +
            ').',
        });
      } else {
        seen.set(type, lineNo);
      }
    }
    processes.push({ index, line: lineNo, type, command });
  }

  if (processes.length === 0 && issues.length === 0) {
    throw new ToolError('That does not look like a Procfile.');
  }
  return { processes, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const types = new Set<string>();
  for (const p of m.processes) if (p.type !== '') types.add(p.type);
  const withCmd = m.processes.filter((p) => p.command !== '').length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Processes', String(m.processes.length)],
      ['Distinct types', String(types.size)],
      ['With command', String(withCmd)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableProcesses(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Line', 'Process type', 'Command'],
    rows: m.processes.map((p) => [
      String(p.index),
      String(p.line),
      p.type === '' ? '(empty)' : p.type,
      p.command === '' ? '(empty)' : p.command,
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
    throw new ToolError('No Procfile was provided.', 'Paste a Procfile.');
  if (text.length > MAX_CHARS) throw new ToolError('That Procfile is larger than 1 MB.');

  const m = parseProcfile(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'processes') table = tableProcesses(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
