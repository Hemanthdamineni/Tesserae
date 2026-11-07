import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './har-inspector.meta';

const MAX_CHARS = 16 * 1024 * 1024;

interface Entry {
  index: number;
  method: string;
  url: string;
  status: number;
  time: number;
  size: number;
}

interface Issue {
  index: number;
  url: string;
  message: string;
}

interface Model {
  version: string;
  creator: string;
  entries: Entry[];
  issues: Issue[];
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v !== '' ? v : fallback;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function parseHar(text: string): Model {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ToolError('That is not valid JSON.', 'Paste a HAR file exported from DevTools.');
  }
  const root = obj(data);
  const log = obj(root.log);
  if (Object.keys(log).length === 0) {
    throw new ToolError('That JSON has no log object, so it is not a HAR file.');
  }
  const rawEntries = Array.isArray(log.entries) ? log.entries : [];
  if (rawEntries.length === 0) throw new ToolError('That HAR file has no entries.');

  const version = str(log.version, '(missing)');
  const creatorObj = obj(log.creator);
  const creatorName = str(creatorObj.name, '');
  const creatorVersion = str(creatorObj.version, '');
  const creator =
    creatorName === ''
      ? '(unknown)'
      : creatorName + (creatorVersion === '' ? '' : ' ' + creatorVersion);

  const issues: Issue[] = [];
  const entries: Entry[] = rawEntries.map((raw, i) => {
    const e = obj(raw);
    const req = obj(e.request);
    const res = obj(e.response);
    const content = obj(res.content);
    const url = str(req.url, '');
    const method = str(req.method, '');
    const status = num(res.status);
    const time = num(e.time);
    const size = num(content.size);
    const idx = i + 1;

    if (url === '')
      issues.push({ index: idx, url: '(missing)', message: 'Entry has no request URL.' });
    if (method === '') issues.push({ index: idx, url, message: 'Entry has no request method.' });
    if (status === 0) issues.push({ index: idx, url, message: 'Entry has no response status.' });
    else if (status >= 400)
      issues.push({ index: idx, url, message: 'Request failed with status ' + status + '.' });

    return { index: idx, method: method === '' ? '-' : method, url, status, time, size };
  });

  if (version !== '1.2' && version !== '1.1') {
    issues.push({
      index: 0,
      url: '(archive)',
      message: 'Unexpected HAR version "' + version + '".',
    });
  }

  return { version, creator, entries, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  let ok = 0;
  let failed = 0;
  let totalTime = 0;
  let totalSize = 0;
  let slowest = 0;
  for (const e of m.entries) {
    if (e.status > 0 && e.status < 400) ok += 1;
    else if (e.status >= 400) failed += 1;
    totalTime += e.time;
    totalSize += e.size;
    if (e.time > slowest) slowest = e.time;
  }
  const distinct = new Set<string>();
  for (const e of m.entries) if (e.url !== '') distinct.add(e.url);
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['HAR version', m.version],
      ['Creator', m.creator],
      ['Entries', String(m.entries.length)],
      ['Successful', String(ok)],
      ['Failed', String(failed)],
      ['Distinct URLs', String(distinct.size)],
      ['Total time (ms)', String(totalTime)],
      ['Slowest request (ms)', String(slowest)],
      ['Total content size (bytes)', String(totalSize)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableRequests(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Method', 'Status', 'Time (ms)', 'Size (bytes)', 'URL'],
    rows: m.entries.map((e) => [
      String(e.index),
      e.method,
      e.status === 0 ? '-' : String(e.status),
      String(e.time),
      String(e.size),
      e.url === '' ? '(missing)' : e.url,
    ]),
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['#', 'URL', 'Problem'],
    rows: m.issues.map((g) => [String(g.index), g.url, g.message]),
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
    throw new ToolError('No HAR file was provided.', 'Paste a HAR export.');
  if (text.length > MAX_CHARS) throw new ToolError('That HAR file is larger than 16 MB.');

  const m = parseHar(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'requests') table = tableRequests(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
