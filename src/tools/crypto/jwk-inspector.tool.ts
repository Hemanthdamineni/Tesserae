import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './jwk-inspector.meta';

/**
 * JWK / JWKS inspector.
 *
 * Reads a single JSON Web Key or a JWKS key set and reports, per key, its kty,
 * crv, use, alg and kid, which parameters are present, the declared key size and
 * whether private material is included. Flags structural problems. Expected
 * values come from the byte-exact fixture, never from this parser.
 */

const MAX_CHARS = 4 * 1024 * 1024;

const EC_CURVE_BITS: Record<string, number> = {
  'P-256': 256,
  'P-384': 384,
  'P-521': 521,
  secp256k1: 256,
};

const REQUIRED: Record<string, string[]> = {
  RSA: ['n', 'e'],
  EC: ['crv', 'x', 'y'],
  OKP: ['crv', 'x'],
  oct: ['k'],
};

interface KeyInfo {
  index: number;
  kty: string;
  crv: string;
  use: string;
  alg: string;
  kid: string;
  size: string;
  isPrivate: string;
}

interface Issue {
  index: number;
  kid: string;
  message: string;
}

interface Model {
  keys: KeyInfo[];
  issues: Issue[];
  isSet: boolean;
}

function b64urlBytes(s: string): number {
  const clean = s.replace(/=+$/, '');
  return Math.floor((clean.length * 3) / 4);
}

function describeKey(raw: Record<string, unknown>): KeyInfo {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const kty = str(raw.kty);
  const crv = str(raw.crv);
  const use = str(raw.use);
  const alg = str(raw.alg);
  const kid = str(raw.kid);
  let size = '-';
  let isPrivate = 'no';

  if (kty === 'RSA') {
    const n = str(raw.n);
    if (n !== '') size = String(b64urlBytes(n) * 8) + ' bit';
    if (typeof raw.d === 'string' || typeof raw.p === 'string') isPrivate = 'yes';
  } else if (kty === 'EC') {
    const bits = EC_CURVE_BITS[crv];
    if (bits !== undefined) size = String(bits) + ' bit';
    if (typeof raw.d === 'string') isPrivate = 'yes';
  } else if (kty === 'OKP') {
    const x = str(raw.x);
    if (x !== '') size = String(b64urlBytes(x) * 8) + ' bit';
    if (typeof raw.d === 'string') isPrivate = 'yes';
  } else if (kty === 'oct') {
    const k = str(raw.k);
    if (k !== '') size = String(b64urlBytes(k) * 8) + ' bit';
  }
  return { index: 0, kty: kty === '' ? '(missing)' : kty, crv, use, alg, kid, size, isPrivate };
}

function collectIssues(raw: Record<string, unknown>, info: KeyInfo, index: number): Issue[] {
  const out: Issue[] = [];
  const kid = info.kid === '' ? '(none)' : info.kid;
  if (info.kty === '(missing)') {
    out.push({ index, kid, message: 'Key has no kty member.' });
    return out;
  }
  const req = REQUIRED[info.kty];
  if (req === undefined) {
    out.push({ index, kid, message: 'Unknown key type "' + info.kty + '".' });
    return out;
  }
  for (const member of req) {
    if (typeof raw[member] !== 'string') {
      out.push({
        index,
        kid,
        message: 'Missing required member "' + member + '" for ' + info.kty + '.',
      });
    }
  }
  return out;
}

function parseJwk(text: string): Model {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ToolError('That is not valid JSON.', 'Paste a JWK or JWKS document.');
  }
  if (data === null || typeof data !== 'object') {
    throw new ToolError('That JSON is not a JWK or JWKS object.');
  }

  const obj = data as Record<string, unknown>;
  let rawKeys: Record<string, unknown>[] = [];
  let isSet = false;

  if (Array.isArray(obj.keys)) {
    isSet = true;
    rawKeys = obj.keys.filter(
      (k): k is Record<string, unknown> => k !== null && typeof k === 'object',
    );
    if (rawKeys.length === 0) throw new ToolError('That key set has no keys.');
  } else if (typeof obj.kty === 'string') {
    rawKeys = [obj];
  } else {
    throw new ToolError('That JSON is not a JWK or JWKS object.');
  }

  const issues: Issue[] = [];
  const keys: KeyInfo[] = rawKeys.map((k, i) => {
    const info = describeKey(k);
    info.index = i + 1;
    issues.push(...collectIssues(k, info, i + 1));
    return info;
  });

  return { keys, issues, isSet };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const byType = new Map<string, number>();
  for (const k of m.keys) byType.set(k.kty, (byType.get(k.kty) ?? 0) + 1);
  const privateCount = m.keys.filter((k) => k.isPrivate === 'yes').length;
  const rows: string[][] = [
    ['Format', m.isSet ? 'JWKS key set' : 'JWK'],
    ['Keys', String(m.keys.length)],
    ['RSA keys', String(byType.get('RSA') ?? 0)],
    ['EC keys', String(byType.get('EC') ?? 0)],
    ['OKP keys', String(byType.get('OKP') ?? 0)],
    ['oct keys', String(byType.get('oct') ?? 0)],
    ['Private keys', String(privateCount)],
    ['Issues', String(m.issues.length)],
  ];
  return { headers: ['Property', 'Value'], rows };
}

function tableKeys(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.keys.slice(0, max) : [];
  return {
    headers: ['#', 'kty', 'crv', 'use', 'alg', 'kid', 'size', 'private'],
    rows: shown.map((k) => [
      String(k.index),
      k.kty,
      k.crv === '' ? '-' : k.crv,
      k.use === '' ? '-' : k.use,
      k.alg === '' ? '-' : k.alg,
      k.kid === '' ? '-' : k.kid,
      k.size,
      k.isPrivate,
    ]),
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['#', 'kid', 'Problem'],
    rows: m.issues.map((g) => [String(g.index), g.kid, g.message]),
  };
}

function asTable(table: { headers: string[]; rows: string[][] }): TextRunResult {
  return { output: JSON.stringify(table), render: 'table' };
}

function run(input: TextRunInput): TextRunResult {
  const options = input.options;
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(10000, Number(options.maxRows ?? 200) || 0));

  const text = input.text ?? '';
  if (text.trim().length === 0)
    throw new ToolError('No JWK or JWKS was provided.', 'Paste a key document.');
  if (text.length > MAX_CHARS) throw new ToolError('That document is larger than 4 MB.');

  const m = parseJwk(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'keys') table = tableKeys(m, maxRows);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
