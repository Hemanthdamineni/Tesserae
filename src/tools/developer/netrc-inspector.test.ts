import { describe, it, expect } from 'vitest';
import tool from './netrc-inspector.tool';

const NETRC_B64 =
  'bWFjaGluZSBleGFtcGxlLmNvbSBsb2dpbiBhbGljZSBwYXNzd29yZCBzM2NyZXQKbWFjaGluZSBm' +
  'dHAuZXhhbXBsZS5vcmcgbG9naW4gYm9iIHBhc3N3b3JkIHB3MiBhY2NvdW50IHdvcmsKZGVmYXVs' +
  'dCBsb2dpbiBndWVzdCBwYXNzd29yZCBndWVzdHB3Cm1hY2hpbmUgaW5jb21wbGV0ZS5leGFtcGxl' +
  'IGxvZ2luIGFsaWNlCm1hY2hpbmUgYmFkbGluZS5leGFtcGxlCg==';

const NETRC_TEXT = atob(NETRC_B64);

const ORACLE = {
  entries: 5,
  namedMachines: 4,
  hasDefault: 'yes',
  withPassword: 3,
  issues: 3,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  return new Map<string, string>(rowsOf(t).rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('netrc-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/netrc/i);
  });

  it('rejects text that is not a netrc file', () => {
    expect(() => tool.run({ text: 'just some random words here', options: {} })).toThrow(/netrc/i);
  });

  it('reads the fixture summary', () => {
    const m = summaryOf(tool.run({ text: NETRC_TEXT, options: {} }));
    expect(m.get('Entries')).toBe(String(ORACLE.entries));
    expect(m.get('machine entries')).toBe(String(ORACLE.namedMachines));
    expect(m.get('default entry')).toBe(ORACLE.hasDefault);
    expect(m.get('Entries with password')).toBe(String(ORACLE.withPassword));
    expect(m.get('Issues')).toBe(String(ORACLE.issues));
  });

  it('lists the machines without printing passwords', () => {
    const t = rowsOf(tool.run({ text: NETRC_TEXT, options: { format: 'machines' } }));
    expect(t.rows).toHaveLength(ORACLE.entries);
    expect(t.rows[0]?.[2]).toBe('example.com');
    expect(t.rows[0]?.[3]).toBe('alice');
    expect(t.rows[0]?.[4]).toBe('yes');
    expect(t.rows[1]?.[2]).toBe('ftp.example.org');
    expect(t.rows[1]?.[5]).toBe('work');
    // the password value must never be shown in the table
    const flat = JSON.stringify(t);
    expect(flat).not.toContain('s3cret');
    expect(flat).not.toContain('guestpw');
  });

  it('flags a missing password and an unknown token', () => {
    const t = rowsOf(tool.run({ text: NETRC_TEXT, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/has no password/i);
    expect(flat).toMatch(/has no login/i);
  });

  it('accepts a macdef block as an issue note', () => {
    const t = rowsOf(
      tool.run({
        text: 'macdef init\nmachine a.com login u password p\n',
        options: { format: 'issues' },
      }),
    );
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/macdef/i);
  });
});
