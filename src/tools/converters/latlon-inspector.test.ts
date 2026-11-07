import { describe, it, expect } from 'vitest';
import tool from './latlon-inspector.tool';

const COORD_DD = '40.7128, -74.0060';
const COORD_DMS = '40 42 46.08 N, 74 0 21.6 W';

const ORACLE = {
  latDD: '40.7128',
  lonDD: '-74.006',
  hemi: 'NW',
  latDms: '40 42 46.08 N',
  lonDms: '74 0 21.6 W',
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('latlon-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/coordinate/i);
  });

  it('reads a decimal-degree pair', () => {
    const t = rowsOf(tool.run({ text: COORD_DD, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Latitude (DD)')).toBe(ORACLE.latDD);
    expect(m.get('Longitude (DD)')).toBe(ORACLE.lonDD);
    expect(m.get('Hemisphere')).toBe(ORACLE.hemi);
    expect(m.get('Valid')).toBe('yes');
  });

  it('reads a DMS pair and converts it', () => {
    const t = rowsOf(tool.run({ text: COORD_DMS, options: { format: 'dms' } }));
    expect(t.rows[0]?.[0]).toBe('Latitude');
    expect(t.rows[0]?.[4]).toBe('N');
    expect(t.rows[1]?.[4]).toBe('W');
    expect(t.rows[1]?.[5]).toBe(ORACLE.lonDD);
  });

  it('flags an out-of-range latitude', () => {
    const bad = '95.0, 10.0';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[0] ?? '').join('\n');
    expect(flat).toMatch(/latitude/i);
  });
});
