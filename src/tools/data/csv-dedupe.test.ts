import { describe, it, expect } from 'vitest';
import tool from './csv-dedupe.tool';

const CSV_B64 =
  'aWQsbmFtZSxjaXR5CjEsQWxpY2UsUGFyaXMKMixCb2IsIk5ldyBZb3JrLCBOWSIKMyxDYXJvbCxC' +
  'ZXJsaW4KMSxBbGljZSxQYXJpcwoyLEJvYiwiTmV3IFlvcmssIE5ZIgo0LCJEYXZlICIiVGhlIEhh' +
  'dCIiIixMb25kb24K';

const CSV_TEXT = atob(CSV_B64);

const ORACLE = {
  originalRows: 6,
  distinctRows: 4,
  uniqueRows: 2,
  duplicateGroups: 2,
  removableRows: 2,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('csv-dedupe', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/csv/i);
  });

  it('reads quoted fields with embedded commas and quotes', () => {
    const t = rowsOf(tool.run({ text: CSV_TEXT, options: { format: 'result' } }));
    const flat = t.rows.map((r) => r[0] ?? '').join('\n');
    expect(flat).toContain('New York, NY');
    expect(flat).toContain('The Hat');
  });

  it('reports the duplicate counts', () => {
    const t = rowsOf(tool.run({ text: CSV_TEXT, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Original rows')).toBe(String(ORACLE.originalRows));
    expect(m.get('Distinct rows')).toBe(String(ORACLE.distinctRows));
    expect(m.get('Unique rows')).toBe(String(ORACLE.uniqueRows));
    expect(m.get('Duplicate groups')).toBe(String(ORACLE.duplicateGroups));
    expect(m.get('Removable rows')).toBe(String(ORACLE.removableRows));
  });

  it('lists the duplicate groups', () => {
    const t = rowsOf(tool.run({ text: CSV_TEXT, options: { format: 'duplicates' } }));
    expect(t.rows).toHaveLength(ORACLE.duplicateGroups);
    expect(t.rows[0]?.[1]).toBe('2');
    expect(t.rows[0]?.[3]).toBe('Alice');
    expect(t.rows[1]?.[3]).toBe('Bob');
  });

  it('dedupes by a single column', () => {
    const t = rowsOf(
      tool.run({
        text: CSV_TEXT,
        options: { mode: 'by-column', columns: 'name', format: 'duplicates' },
      }),
    );
    // both Alice rows share name=Alice, both Bob rows share name=Bob => 2 groups, Dave unique
    expect(t.rows).toHaveLength(2);
  });

  it('rejects an unknown column', () => {
    expect(() =>
      tool.run({ text: CSV_TEXT, options: { mode: 'by-column', columns: 'nope' } }),
    ).toThrow(/not found/i);
  });
});
