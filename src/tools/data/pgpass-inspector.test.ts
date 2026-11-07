import { describe, it, expect } from 'vitest';
import tool from './pgpass-inspector.tool';

const PG_B64 =
  'bG9jYWxob3N0OjU0MzI6bXlkYjphbGljZTpzZWNyZXQxCmRiLmV4YW1wbGUuY29tOjU0MzI6Kjpi' +
  'b2I6aHVudGVyMgoqOio6KjpjaGFybGllOnB3Mwo=';

const PG_TEXT = atob(PG_B64);

const ORACLE = {
  entries: 3,
  withPassword: 3,
  wildcardHost: 1,
  wildcardDb: 2,
  issues: 0,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  return new Map<string, string>(rowsOf(t).rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('pgpass-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/pgpass/i);
  });

  it('reads the fixture summary', () => {
    const m = summaryOf(tool.run({ text: PG_TEXT, options: {} }));
    expect(m.get('Entries')).toBe(String(ORACLE.entries));
    expect(m.get('Entries with password')).toBe(String(ORACLE.withPassword));
    expect(m.get('Wildcard host entries')).toBe(String(ORACLE.wildcardHost));
    expect(m.get('Wildcard database entries')).toBe(String(ORACLE.wildcardDb));
    expect(m.get('Issues')).toBe(String(ORACLE.issues));
  });

  it('lists the entries without printing passwords', () => {
    const t = rowsOf(tool.run({ text: PG_TEXT, options: { format: 'entries' } }));
    expect(t.rows).toHaveLength(ORACLE.entries);
    expect(t.rows[0]?.[2]).toBe('localhost');
    expect(t.rows[0]?.[3]).toBe('5432');
    expect(t.rows[0]?.[4]).toBe('mydb');
    expect(t.rows[0]?.[5]).toBe('alice');
    expect(t.rows[0]?.[6]).toBe('yes');
    expect(t.rows[2]?.[2]).toBe('*');
    // the password value must never be shown
    const flat = JSON.stringify(t);
    expect(flat).not.toContain('secret1');
    expect(flat).not.toContain('hunter2');
  });

  it('flags a line without five fields', () => {
    const bad = 'host:5432:db:user\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/Expected 5 colon-separated fields, found 4/i);
  });

  it('flags an empty required field', () => {
    const bad = 'host:5432::user:pw\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/Database field is empty/i);
  });

  it('handles escaped colons in a password', () => {
    const m = summaryOf(tool.run({ text: 'h:1:d:u:pa\\:ss\n', options: {} }));
    expect(m.get('Entries')).toBe('1');
    expect(m.get('Issues')).toBe('0');
  });
});
