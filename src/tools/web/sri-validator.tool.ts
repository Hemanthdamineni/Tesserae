import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './sri-validator.meta';

/**
 * SRI hash validator.
 *
 * Splits an integrity attribute into its algorithm-token pairs and validates
 * each one: a known algorithm (sha256/sha384/sha512), decodable base64, and the
 * exact digest length required for that algorithm. Expected values come from
 * the byte-exact fixture, never from this parser.
 */

const MAX_CHARS = 4 * 1024 * 1024;

const ALGO_BYTES: Record<string, number> = {
  sha256: 32,
  sha384: 48,
  sha512: 64,
};

interface Token {
  index: number;
  algorithm: string;
  digest: string;
  validAlgo: boolean;
  validLength: boolean;
  lengthBytes: number;
}

interface Issue {
  index: number;
  token: string;
  message: string;
}

interface Model {
  tokens: Token[];
  issues: Issue[];
}

function decodeBase64(s: string): Uint8Array | null {
  const normalized = s.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(normalized);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function parseSri(text: string): Model {
  const trimmed = text.trim();
  if (trimmed === '')
    throw new ToolError('No SRI attribute was provided.', 'Paste an integrity value.');

  const parts = trimmed.split(/\s+/).filter((p) => p !== '');
  if (parts.length === 0) throw new ToolError('That SRI attribute has no tokens.');

  const issues: Issue[] = [];
  const tokens: Token[] = parts.map((part, i) => {
    const idx = i + 1;
    const dash = part.indexOf('-');
    const algorithm = dash === -1 ? part : part.slice(0, dash);
    const digest = dash === -1 ? '' : part.slice(dash + 1);
    const validAlgo = ALGO_BYTES[algorithm] !== undefined;

    let decoded: Uint8Array | null = null;
    if (digest !== '') decoded = decodeBase64(digest);

    let lengthBytes = 0;
    let validLength = false;
    if (decoded !== null) {
      lengthBytes = decoded.length;
      validLength = validAlgo && lengthBytes === (ALGO_BYTES[algorithm] as number);
    }

    if (dash === -1) {
      issues.push({ index: idx, token: part, message: 'Token has no algorithm-digest separator.' });
    } else if (!validAlgo) {
      issues.push({ index: idx, token: part, message: 'Unknown algorithm "' + algorithm + '".' });
    } else if (decoded === null) {
      issues.push({ index: idx, token: part, message: 'Malformed base64 digest.' });
    } else if (!validLength) {
      issues.push({
        index: idx,
        token: part,
        message:
          'Digest is ' +
          lengthBytes +
          ' bytes, expected ' +
          (ALGO_BYTES[algorithm] as number) +
          '.',
      });
    }
    return { index: idx, algorithm, digest, validAlgo, validLength, lengthBytes };
  });

  return { tokens, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const valid = m.tokens.filter((t) => t.validLength).length;
  const counts = new Map<string, number>();
  for (const t of m.tokens) counts.set(t.algorithm, (counts.get(t.algorithm) ?? 0) + 1);
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Tokens', String(m.tokens.length)],
      ['Valid hashes', String(valid)],
      ['sha256 tokens', String(counts.get('sha256') ?? 0)],
      ['sha384 tokens', String(counts.get('sha384') ?? 0)],
      ['sha512 tokens', String(counts.get('sha512') ?? 0)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableTokens(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Algorithm', 'Digest length (bytes)', 'Valid'],
    rows: m.tokens.map((t) => [
      String(t.index),
      t.algorithm,
      t.digest === '' ? '-' : String(t.lengthBytes),
      t.validLength ? 'yes' : 'no',
    ]),
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['#', 'Token', 'Problem'],
    rows: m.issues.map((g) => [String(g.index), g.token, g.message]),
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
    throw new ToolError('No SRI attribute was provided.', 'Paste an integrity value.');
  if (text.length > MAX_CHARS) throw new ToolError('That SRI attribute is larger than 4 MB.');

  const m = parseSri(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'tokens') table = tableTokens(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
