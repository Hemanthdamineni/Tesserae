import { describe, it, expect } from 'vitest';
import tool from './npmrc-inspector.tool';

const NPMRC_B64 =
  'cmVnaXN0cnk9aHR0cHM6Ly9yZWdpc3RyeS5ucG1qcy5vcmcvCnNhdmUtZXhhY3Q9dHJ1ZQpmdW5k' +
  'PWZhbHNlCkBteW9yZzpyZWdpc3RyeT1odHRwczovL25wbS5teW9yZy5jb20vCi8vbnBtLm15b3Jn' +
  'LmNvbS86X2F1dGhUb2tlbj1hYmMxMjMKbGVnYWN5LXBlZXItZGVwcz10cnVlCg==';

const NPMRC_TEXT = atob(NPMRC_B64);

const ORACLE = {
  settings: 6,
  scoped: 1,
  authTokens: 1,
  booleans: 3,
  issues: 0,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  return new Map<string, string>(rowsOf(t).rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('npmrc-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/npmrc/i);
  });

  it('reads the fixture summary', () => {
    const m = summaryOf(tool.run({ text: NPMRC_TEXT, options: {} }));
    expect(m.get('Settings')).toBe(String(ORACLE.settings));
    expect(m.get('Scoped registries')).toBe(String(ORACLE.scoped));
    expect(m.get('Auth tokens')).toBe(String(ORACLE.authTokens));
    expect(m.get('Boolean flags')).toBe(String(ORACLE.booleans));
    expect(m.get('Issues')).toBe(String(ORACLE.issues));
  });

  it('lists the settings without printing auth token values', () => {
    const t = rowsOf(tool.run({ text: NPMRC_TEXT, options: { format: 'settings' } }));
    expect(t.rows).toHaveLength(ORACLE.settings);
    expect(t.rows[0]?.[2]).toBe('registry');
    expect(t.rows[0]?.[3]).toBe('https://registry.npmjs.org/');
    expect(t.rows[3]?.[2]).toBe('@myorg:registry');
    expect(t.rows[4]?.[2]).toBe('//npm.myorg.com/:_authToken');
    expect(t.rows[4]?.[3]).toBe('(hidden)');
    // the token value must never be shown
    expect(JSON.stringify(t)).not.toContain('abc123');
  });

  it('flags a line with no equals sign and a duplicate key', () => {
    const bad = 'registry=https://a/\nregistry=https://b/\njust-a-line\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/no equals sign/i);
    expect(flat).toMatch(/more than once/i);
  });

  it('flags an empty key and an empty value', () => {
    const bad = '=value\nfund=\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/Key is empty/i);
    expect(flat).toMatch(/is empty/i);
  });

  it('does not flag an empty auth token value', () => {
    const m = summaryOf(tool.run({ text: '//r/:_authToken=\n', options: {} }));
    expect(m.get('Issues')).toBe('0');
    expect(m.get('Auth tokens')).toBe('1');
  });
});
