import { describe, it, expect } from 'vitest';
import tool from './iif-inspector.tool';

const IIF_B64 =
  'IVRSTlMJVFJOU0lECVRSTlNUWVBFCURBVEUJQUNDTlQJTkFNRQlBTU9VTlQJTUVNTwpUUk5TCTEJ' +
  'UEFZTUVOVAkxMS8wMS8yMDIyCUNoZWNraW5nCVZlbmRvciBBCTEwMC4wMAlJbnZvaWNlIDEyMwoh' +
  'U1BMCVNQTElECVRSTlNUWVBFCURBVEUJQUNDTlQJTkFNRQlBTU9VTlQJTUVNTwpTUEwJMQlQQVlN' +
  'RU5UCTExLzAxLzIwMjIJQ2hlY2tpbmcJVmVuZG9yIEEJLTEwMC4wMAlJbnZvaWNlIDEyMwohRU5E' +
  'VFJOUw==';

const IIF_TEXT = atob(IIF_B64);

const ORACLE = { records: 2, sections: 2, bySection: 'TRNS x1, SPL x1' };

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('iif-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/IIF/i);
  });

  it('reads the summary', () => {
    const t = rowsOf(tool.run({ text: IIF_TEXT, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('QuickBooks IIF');
    expect(m.get('Records')).toBe(String(ORACLE.records));
    expect(m.get('Sections')).toBe(String(ORACLE.sections));
    expect(m.get('By section')).toBe(ORACLE.bySection);
  });

  it('lists the sections', () => {
    const t = rowsOf(tool.run({ text: IIF_TEXT, options: { format: 'records' } }));
    expect(t.rows).toHaveLength(ORACLE.sections);
    expect(t.rows[0]?.[0]).toBe('TRNS');
    expect(t.rows[0]?.[1]).toBe('1');
    expect(t.rows[1]?.[0]).toBe('SPL');
  });

  it('flags a mismatched field count', () => {
    const bad =
      '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\nTRNS\t1\tPAYMENT\t11/01/2022\n!ENDTRNS\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[1] ?? '').join('\n');
    expect(flat).toMatch(/fields|header/i);
  });
});
