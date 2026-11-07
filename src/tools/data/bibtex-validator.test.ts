import { describe, it, expect } from 'vitest';
import tool from './bibtex-validator.tool';

const BIB_B64 =
  'QGFydGljbGV7a251dGgxOTg0LAogIGF1dGhvciA9IHtEb25hbGQgRS4gS251dGh9LAogIHRpdGxl' +
  'ID0ge0xpdGVyYXRlIFByb2dyYW1taW5nfSwKICBqb3VybmFsID0ge1RoZSBDb21wdXRlciBKb3Vy' +
  'bmFsfSwKICB5ZWFyID0gezE5ODR9LAogIHZvbHVtZSA9IHsyN30sCiAgbnVtYmVyID0gezJ9Cn0K' +
  'CkBib29re2xhbXBvcnQxOTk0LAogIGF1dGhvciA9IHtMZXNsaWUgTGFtcG9ydH0sCiAgdGl0bGUg' +
  'PSB7TGFUZVg6IEEgRG9jdW1lbnQgUHJlcGFyYXRpb24gU3lzdGVtfSwKICBwdWJsaXNoZXIgPSB7' +
  'QWRkaXNvbi1XZXNsZXl9LAogIHllYXIgPSB7MTk5NH0KfQ==';

const BIB_TEXT = atob(BIB_B64);

const ORACLE = { entries: 2, fields: 10, types: 'article x1, book x1' };

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('bibtex-validator', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/BibTeX|bibliography/i);
  });

  it('reads the summary', () => {
    const t = rowsOf(tool.run({ text: BIB_TEXT, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('BibTeX');
    expect(m.get('Entries')).toBe(String(ORACLE.entries));
    expect(m.get('Fields')).toBe(String(ORACLE.fields));
    expect(m.get('Types')).toBe(ORACLE.types);
    expect(m.get('Issues')).toBe('0');
  });

  it('lists the entries', () => {
    const t = rowsOf(tool.run({ text: BIB_TEXT, options: { format: 'entries' } }));
    expect(t.rows).toHaveLength(ORACLE.entries);
    expect(t.rows[0]?.[0]).toBe('knuth1984');
    expect(t.rows[0]?.[1]).toBe('article');
    expect(t.rows[0]?.[2]).toBe('6');
    expect(t.rows[1]?.[0]).toBe('lamport1994');
    expect(t.rows[1]?.[1]).toBe('book');
  });

  it('flags a duplicate key and a missing mandatory field', () => {
    const bad =
      '@article{knuth1984,\n  title = {T}\n}\n@book{knuth1984,\n  author = {A},\n  title = {B}\n}\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[1] ?? '').join('\n');
    expect(flat).toMatch(/[Dd]uplicate/);
    expect(flat).toMatch(/journal/);
  });
});
