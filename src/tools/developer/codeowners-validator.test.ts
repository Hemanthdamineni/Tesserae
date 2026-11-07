import { describe, it, expect } from 'vitest';
import tool from './codeowners-validator.tool';

const CODEOWNERS_B64 =
  'IyBkZWZhdWx0IG93bmVycwoqIEBvcmcvYWxsCi9kb2NzLyBAb3JnL2RvY3MtdGVhbQovc3JjLyoq' +
  'LyoudHMgQGFsaWNlIEBib2IKL3NyYy9pbnZhbGlkX3BhdGggQGJvYgovc2NyaXB0cy9idWlsZC5z' +
  'aCBAZGV2b3BzLWJvdAojIHRyYWlsaW5nIHJ1bGUgd2lucwovZG9jcy9hcGkgQGphbmUK';

const CODEOWNERS_TEXT = atob(CODEOWNERS_B64);

const ORACLE = {
  rules: 6,
  withOwners: 6,
  comments: 2,
  blankLines: 0,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  const rows = rowsOf(t).rows;
  return new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('codeowners-validator', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/CODEOWNERS/i);
  });

  it('reads the fixture summary', () => {
    const m = summaryOf(tool.run({ text: CODEOWNERS_TEXT, options: {} }));
    expect(m.get('Rules')).toBe(String(ORACLE.rules));
    expect(m.get('Rules with owners')).toBe(String(ORACLE.withOwners));
    expect(m.get('Comments')).toBe(String(ORACLE.comments));
  });

  it('lists the rules in order', () => {
    const t = rowsOf(tool.run({ text: CODEOWNERS_TEXT, options: { format: 'rules' } }));
    expect(t.rows).toHaveLength(ORACLE.rules);
    expect(t.rows[0]?.[2]).toBe('*');
    expect(t.rows[0]?.[3]).toBe('@org/all');
    expect(t.rows[2]?.[2]).toBe('/src/**/*.ts');
    expect(t.rows[2]?.[3]).toBe('@alice, @bob');
  });

  it('flags an invalid owner and a missing-owner rule', () => {
    const bad = '* @alice\n/src/not-valid bob\n/src/lone\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/not a valid user/i);
    expect(flat).toMatch(/has no owners/i);
  });

  it('accepts email and team owners', () => {
    const ok = '/a @org/team\n/emails @alice example@example.com\n';
    const m = summaryOf(tool.run({ text: ok, options: {} }));
    expect(m.get('Issues')).toBe('0');
  });
});
