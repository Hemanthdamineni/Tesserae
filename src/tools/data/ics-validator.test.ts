import { describe, it, expect } from 'vitest';
import tool from './ics-validator.tool';

const ICS_B64 =
  'QkVHSU46VkNBTEVOREFSClZFUlNJT046Mi4wClBST0RJRDotLy9FeGFtcGxlLy9FdmVudC8vRU4K' +
  'QkVHSU46VkVWRU5UClVJRDpldmVudC0wMDFAZXhhbXBsZS5jb20KRFRTVEFNUDoyMDI0MTEwNlQx' +
  'MjAwMDBaCkRUU1RBUlQ6MjAyNDExMTBUMTAwMDAwWgpEVEVORDoyMDI0MTExMFQxMTAwMDBaClNV' +
  'TU1BUlk6UHJvamVjdCByZXZpZXcKTE9DQVRJT046Um9vbSAzCkJFR0lOOlZBTEFSTQpBQ1RJT046' +
  'RElTUExBWQpUUklHR0VSOi1QVDE1TQpERVNDUklQVElPTjpSZW1pbmRlcgpFTkQ6VkFMQVJNCkVO' +
  'RDpWRVZFTlQKRU5EOlZDQUxFTkRBUg==';

const ICS_TEXT = atob(ICS_B64);

const ORACLE = { components: 3, props: 9, kinds: 'VCALENDAR x1, VEVENT x1, VALARM x1' };

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('ics-validator', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/calendar/i);
  });

  it('reads the summary', () => {
    const t = rowsOf(tool.run({ text: ICS_TEXT, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('iCalendar (ICS)');
    expect(m.get('Components')).toBe(String(ORACLE.components));
    expect(m.get('Kinds')).toBe(ORACLE.kinds);
    expect(m.get('Issues')).toBe('0');
  });

  it('lists the components', () => {
    const t = rowsOf(tool.run({ text: ICS_TEXT, options: { format: 'components' } }));
    expect(t.rows).toHaveLength(ORACLE.components);
    expect(t.rows[0]?.[0]).toBe('VCALENDAR');
    expect(t.rows[1]?.[0]).toBe('VEVENT');
    expect(t.rows[2]?.[0]).toBe('VALARM');
  });

  it('flags a missing UID and a bad date', () => {
    const bad =
      'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//x//EN\nBEGIN:VEVENT\nDTSTART:notadate\nSUMMARY:S\nEND:VEVENT\nEND:VCALENDAR\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[1] ?? '').join('\n');
    expect(flat).toMatch(/UID/i);
    expect(flat).toMatch(/not a valid date/i);
  });
});
