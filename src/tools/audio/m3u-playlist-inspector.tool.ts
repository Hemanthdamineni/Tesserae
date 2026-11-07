import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './m3u-playlist-inspector.meta';

const MAX_CHARS = 4 * 1024 * 1024;

interface Entry {
  index: number;
  line: number;
  duration: string;
  title: string;
  uri: string;
}

interface Issue {
  index: number;
  line: number;
  message: string;
}

interface Model {
  entries: Entry[];
  bareUris: number;
  hasHeader: boolean;
  issues: Issue[];
}

function parseM3u(text: string): Model {
  const trimmed = text.trim();
  if (trimmed === '') throw new ToolError('No playlist was provided.', 'Paste an M3U playlist.');
  const lines = trimmed.split(String.fromCharCode(10)).map((l) => l.trimEnd());
  if (lines.length === 0) throw new ToolError('That playlist is empty.');

  const hasHeader = /^#EXTM3U\b/i.test(lines[0] ?? '');
  const issues: Issue[] = [];
  const entries: Entry[] = [];
  let bareUris = 0;
  let index = 0;

  if (!hasHeader) {
    issues.push({ index: 0, line: 1, message: 'Playlist does not start with #EXTM3U.' });
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line === '' || line.startsWith('#')) {
      if (/^#EXTINF:/i.test(line)) {
        index += 1;
        const spec = line.slice(8);
        const comma = spec.indexOf(',');
        const duration = comma === -1 ? spec : spec.slice(0, comma);
        const title = comma === -1 ? '' : spec.slice(comma + 1);
        const lineNo = i + 1;
        if (!/^-?\d+(\.\d+)?$/.test(duration)) {
          issues.push({
            index,
            line: lineNo,
            message: 'Duration "' + duration + '" is not numeric.',
          });
        }
        let j = i + 1;
        while (j < lines.length && ((lines[j] ?? '') === '' || (lines[j] ?? '').startsWith('#'))) {
          j += 1;
        }
        const uri = j < lines.length ? (lines[j] ?? '') : '';
        if (uri === '') {
          issues.push({ index, line: lineNo, message: 'EXTINF entry has no following URI.' });
          entries.push({ index, line: lineNo, duration, title, uri: '' });
          i += 1;
          continue;
        }
        entries.push({ index, line: lineNo, duration, title, uri });
        i = j + 1;
        continue;
      }
      i += 1;
      continue;
    }
    bareUris += 1;
    issues.push({
      index: index + 1,
      line: i + 1,
      message: 'URI "' + line + '" has no EXTINF metadata.',
    });
    i += 1;
  }

  if (entries.length === 0 && bareUris === 0) {
    throw new ToolError('That does not look like an M3U playlist.');
  }
  return { entries, bareUris, hasHeader, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const distinct = new Set<string>();
  for (const e of m.entries) if (e.uri !== '') distinct.add(e.uri);
  const withUris = m.entries.filter((e) => e.uri !== '').length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['EXTINF header', m.hasHeader ? 'yes' : 'no'],
      ['Entries', String(m.entries.length)],
      ['Entries with URI', String(withUris)],
      ['Distinct URIs', String(distinct.size)],
      ['Bare URIs', String(m.bareUris)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableEntries(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Line', 'Duration', 'Title', 'URI'],
    rows: m.entries.map((e) => [
      String(e.index),
      String(e.line),
      e.duration === '' ? '-' : e.duration,
      e.title === '' ? '-' : e.title,
      e.uri === '' ? '(missing)' : e.uri,
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
    throw new ToolError('No playlist was provided.', 'Paste an M3U playlist.');
  if (text.length > MAX_CHARS) throw new ToolError('That playlist is larger than 4 MB.');

  const m = parseM3u(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'entries') table = tableEntries(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
