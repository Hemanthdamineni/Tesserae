import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './whois-inspector.meta';

const MAX_CHARS = 16 * 1024 * 1024;

interface Entry {
  line: number;
  field: string;
  key: string;
  value: string;
}

interface Issue {
  location: string;
  message: string;
}

interface Model {
  entries: Entry[];
  repeated: { key: string; count: number }[];
  issues: Issue[];
}

/** Field names seen in common WHOIS responses (lowercase, trimmed). */
const KNOWN_FIELDS = new Set([
  'domain name',
  'registry domain id',
  'registrar whois server',
  'registrar url',
  'updated date',
  'last updated on',
  'updated',
  'creation date',
  'registered on',
  'created on',
  'created',
  'registry expiry date',
  'expiry date',
  'expiration date',
  'expires',
  'expires date',
  'expire',
  'registrar',
  'registrar iana id',
  'status',
  'domain status',
  'name server',
  'nserver',
  'ns',
  'registrant org',
  'registrant organization',
  'registrant organisation',
  'registrant name',
  'registrant country',
  'registrant email',
  'registrant phone',
  'registrant address',
  'registrant street',
  'registrant city',
  'registrant state',
  'registrant postal code',
  'registrant region',
  'admin email',
  'admin name',
  'admin org',
  'tech email',
  'tech name',
  'tech org',
  'abuse contact email',
  'whois server',
  'whois',
  'referral url',
  'referral server',
  'server',
  'descr',
  'remarks',
  'country',
  'stateprov',
  'postalcode',
  'nethandle',
  'netrange',
  'netname',
  'cidr',
  'orgname',
  'org',
  'handle',
  'objecthandle',
  'person',
  'email',
  'address',
  'phone',
  'fax',
  'mnt-by',
  'changed',
  'source',
  'flags',
  'variant',
  'last update of whois database',
]);

const CREATION_KEYS = ['creation date', 'registered on', 'created on', 'created'];
const EXPIRY_KEYS = [
  'registry expiry date',
  'expiry date',
  'expiration date',
  'expires',
  'expires date',
  'expire',
];
const NAME_SERVER_KEYS = ['name server', 'nserver', 'ns'];
const ORG_KEYS = [
  'registrant org',
  'registrant organization',
  'registrant organisation',
  'org',
  'orgname',
];

function normField(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function firstValue(entries: Entry[], keys: string[]): string {
  const wanted = new Set(keys);
  for (const e of entries) if (wanted.has(e.key)) return e.value;
  return '';
}

function allValues(entries: Entry[], keys: string[]): string[] {
  const wanted = new Set(keys);
  return entries.filter((e) => wanted.has(e.key)).map((e) => e.value);
}

function parseWhois(text: string): Model {
  const entries: Entry[] = [];
  const issues: Issue[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    const lineNo = i + 1;
    if (line === '') return;
    if (line.startsWith('%') || line.startsWith('#') || line.startsWith('//')) return;

    const m = /^([^:]{1,100}):\s*(.*)$/.exec(line);
    if (!m) {
      issues.push({ location: 'Line ' + lineNo, message: 'Line has no "field: value" form.' });
      return;
    }
    const field = (m[1] ?? '').trim();
    const value = (m[2] ?? '').trim();
    const key = normField(field);
    if (!KNOWN_FIELDS.has(key)) {
      issues.push({ location: 'Line ' + lineNo, message: 'Unknown field name "' + field + '".' });
      return;
    }
    entries.push({ line: lineNo, field, key, value });
  });

  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.key, (counts.get(e.key) ?? 0) + 1);
  const repeated = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  if (!entries.some((e) => e.key === 'domain name'))
    issues.push({ location: 'Record', message: 'Record has no domain name.' });
  if (firstValue(entries, CREATION_KEYS) === '')
    issues.push({ location: 'Record', message: 'Record has no creation date.' });
  if (firstValue(entries, ['registrar']) === '')
    issues.push({ location: 'Record', message: 'Record has no registrar.' });
  if (/no match|not found|no entries found|no data found|does not exist/i.test(text))
    issues.push({ location: 'Record', message: 'Record reports no match / not found.' });

  return { entries, repeated, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const nameServers = allValues(m.entries, NAME_SERVER_KEYS);
  const statuses = allValues(m.entries, ['status', 'domain status']);
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Domain name', firstValue(m.entries, ['domain name']) || '(missing)'],
      ['Registrar', firstValue(m.entries, ['registrar']) || '(missing)'],
      ['Creation date', firstValue(m.entries, CREATION_KEYS) || '(missing)'],
      ['Expiry date', firstValue(m.entries, EXPIRY_KEYS) || '(missing)'],
      ['Name servers', String(nameServers.length)],
      ['Statuses', statuses.length === 0 ? '(none)' : statuses.join(', ')],
      ['Registrant org', firstValue(m.entries, ORG_KEYS) || '(missing)'],
      ['Field lines', String(m.entries.length)],
      ['Repeated fields', String(m.repeated.length)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableRecord(m: Model): { headers: string[]; rows: string[][] } {
  if (m.entries.length === 0) return { headers: ['Result'], rows: [['No field lines found']] };
  const note = new Map(m.repeated.map((r) => [r.key, r.count]));
  return {
    headers: ['#', 'Field', 'Value'],
    rows: m.entries.map((e, i) => [
      String(i + 1),
      e.field + (note.has(e.key) ? ' (×' + (note.get(e.key) ?? 1) + ')' : ''),
      e.value,
    ]),
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['Location', 'Problem'],
    rows: m.issues.map((g) => [g.location, g.message]),
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
    throw new ToolError('No WHOIS record was provided.', 'Paste a WHOIS response.');
  if (text.length > MAX_CHARS) throw new ToolError('That WHOIS record is larger than 16 MB.');

  const m = parseWhois(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'record') table = tableRecord(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
