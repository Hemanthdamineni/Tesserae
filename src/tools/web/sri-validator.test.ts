import { describe, it, expect } from 'vitest';
import tool from './sri-validator.tool';

const SRI_B64 =
  'c2hhMzg0LVVlRXVtdXhZYm12dVJoQXJaaDFEaVF5TEZWdUxsazVJbkpOWWk3RnI1RG5OclVSMGxw' +
  'QW1UaHNoMU1xcWJ6T20gc2hhMjU2LTluZld0M0ROVDE0byt0WkNQM1lpbGZMd1RyaExJOThlcWJO' +
  'Njg5Qjdhalk9IHNoYTUxMi1Ld3F1RHdjdlhWdUZvVHlVL1lqS2Erd2NSTnBJL0d0a2Y3ZGQ1Z1R0' +
  'VEFvdlBpYTVYRjZJdVV1U3Y1aTdLMnhQd2FyU2xOendQSkxVbklha1JWY0IyUT09CmRtRnlJSGdn' +
  'UFNBeE93PT0K';

const WHOLE = atob(SRI_B64);
const LINES = WHOLE.trim().split('\n');
const INTEGRITY = LINES[0] ?? '';

const ORACLE = {
  tokens: 3,
  valid: 3,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  const rows = rowsOf(t).rows;
  return new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('sri-validator', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/SRI|integrity/i);
  });

  it('reads the fixture summary', () => {
    const m = summaryOf(tool.run({ text: INTEGRITY, options: {} }));
    expect(m.get('Tokens')).toBe(String(ORACLE.tokens));
    expect(m.get('Valid hashes')).toBe(String(ORACLE.valid));
    expect(m.get('sha256 tokens')).toBe('1');
    expect(m.get('sha384 tokens')).toBe('1');
    expect(m.get('sha512 tokens')).toBe('1');
    expect(m.get('Issues')).toBe('0');
  });

  it('lists the tokens with lengths', () => {
    const t = rowsOf(tool.run({ text: INTEGRITY, options: { format: 'tokens' } }));
    expect(t.rows).toHaveLength(ORACLE.tokens);
    expect(t.rows[0]?.[1]).toBe('sha384');
    expect(t.rows[0]?.[2]).toBe('48');
    expect(t.rows[0]?.[3]).toBe('yes');
    expect(t.rows[1]?.[1]).toBe('sha256');
    expect(t.rows[1]?.[2]).toBe('32');
  });

  it('flags a wrong-length digest', () => {
    // a sha256 digest that is only 16 bytes instead of the required 32
    const s = 'sha256-' + atob('b25lIHR3byB0aHJlZSBmb3VyIA==');
    const t = rowsOf(tool.run({ text: s, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/bytes, expected/i);
  });

  it('flags an unknown algorithm', () => {
    const s = 'md5-Q2hlY2tzdW0=';
    const t = rowsOf(tool.run({ text: s, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/Unknown algorithm/i);
  });

  it('flags a token without a separator', () => {
    const t = rowsOf(tool.run({ text: 'shasha256abc', options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/separator/i);
  });
});
