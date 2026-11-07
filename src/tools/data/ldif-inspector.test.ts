import { describe, it, expect } from 'vitest';
import tool from './ldif-inspector.tool';

const LDIF_B64 =
  'ZG46IGNuPUFsaWNlIFNtaXRoLG91PXBlb3BsZSxkYz1leGFtcGxlLGRjPWNvbQpvYmplY3RDbGFz' +
  'czogaW5ldE9yZ1BlcnNvbgpjbjogQWxpY2UgU21pdGgKc246IFNtaXRoCm1haWw6IGFsaWNlQGV4' +
  'YW1wbGUuY29tCgpkbjogY249Qm9iIEpvbmVzLG91PXBlb3BsZSxkYz1leGFtcGxlLGRjPWNvbQpv' +
  'YmplY3RDbGFzczogaW5ldE9yZ1BlcnNvbgpjbjogQm9iIEpvbmVzCnNuOiBKb25lcwoK';

const LDIF_TEXT = atob(LDIF_B64);

const ORACLE = {
  entries: 2,
  attrLines: 7,
  distinctTypes: 4,
  issues: 0,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  return new Map<string, string>(rowsOf(t).rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('ldif-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/LDIF/i);
  });

  it('reads the fixture summary', () => {
    const m = summaryOf(tool.run({ text: LDIF_TEXT, options: {} }));
    expect(m.get('Entries')).toBe(String(ORACLE.entries));
    expect(m.get('Attribute lines')).toBe(String(ORACLE.attrLines));
    expect(m.get('Distinct attribute types')).toBe(String(ORACLE.distinctTypes));
    expect(m.get('Issues')).toBe(String(ORACLE.issues));
  });

  it('lists the entries with their DNs', () => {
    const t = rowsOf(tool.run({ text: LDIF_TEXT, options: { format: 'entries' } }));
    expect(t.rows).toHaveLength(ORACLE.entries);
    expect(t.rows[0]?.[1]).toBe('cn=Alice Smith,ou=people,dc=example,dc=com');
    expect(t.rows[0]?.[2]).toBe('4');
    expect(t.rows[1]?.[1]).toBe('cn=Bob Jones,ou=people,dc=example,dc=com');
    expect(t.rows[1]?.[2]).toBe('3');
  });

  it('flags a line with no colon', () => {
    const bad = 'dn: cn=A,dc=x\ncn Alice\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/no colon/i);
  });

  it('flags an invalid base64 value', () => {
    const bad = 'dn: cn=A,dc=x\njpegPhoto:: !!!invalid!!!\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/not valid/i);
  });

  it('flags an entry with no DN', () => {
    const bad = 'objectClass: inetOrgPerson\ncn: X\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/no DN/i);
  });
});
