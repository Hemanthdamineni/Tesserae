import { describe, it, expect } from 'vitest';
import tool from './x12-inspector.tool';

const X12_B64 =
  'SVNBKjAwKiAgICAgICAgICAqMDAqICAgICAgICAgICpaWipTRU5ERVIgICAgICAgKlpaKlJFQ0VJ' +
  'VkVSICAgICAqMjIxMTAxKjEyMDAqVSowMDQwMSowMDAwMDAwMDEqMCpQKj5+CkdTKlBPKlNFTkRF' +
  'UipSRUNFSVZFUioyMDIyMTEwMSoxMjAwKjEqWCowMDQwMTB+ClNUKjg1MCowMDAxfgpCRUcqMDAq' +
  'U0EqUE8tMTIzNCoyMDIyMTEwMX4KU0UqNCowMDAxfgpHRSoxKjF+CklFQSoxKjAwMDAwMDAwMX4=';

const X12_TEXT = atob(X12_B64);

const ORACLE = {
  segments: 7,
  transactions: 1,
  isaControl: '000000001',
  set: '850',
  setControl: '0001',
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('x12-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/EDI|X12/i);
  });

  it('reads the summary', () => {
    const t = rowsOf(tool.run({ text: X12_TEXT, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('ANSI X12 EDI');
    expect(m.get('Segments')).toBe(String(ORACLE.segments));
    expect(m.get('Transactions')).toBe(String(ORACLE.transactions));
    expect(m.get('ISA control')).toBe(ORACLE.isaControl);
    expect(m.get('Issues')).toBe('0');
  });

  it('lists the transactions', () => {
    const t = rowsOf(tool.run({ text: X12_TEXT, options: { format: 'transactions' } }));
    expect(t.rows).toHaveLength(ORACLE.transactions);
    expect(t.rows[0]?.[0]).toBe(ORACLE.set);
    expect(t.rows[0]?.[1]).toBe(ORACLE.setControl);
  });

  it('flags an SE control mismatch', () => {
    const bad =
      'ISA*00*          *00*          *ZZ*A             *ZZ*B             *221101*1200*U*00401*000000001*0*P*>~\nGS*PO*A*B*20221101*1200*1*X*004010~\nST*850*0001~\nBEG*00*SA*PO-1*20221101~\nSE*4*9999~\nGE*1*1~\nIEA*1*000000001~\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[1] ?? '').join('\n');
    expect(flat).toMatch(/SE control/i);
  });
});
