import { describe, it, expect } from 'vitest';
import tool from './srt-inspector.tool';

const SRT_B64 =
  'MQowMDowMDowMSwwMDAgLS0+IDAwOjAwOjA0LDAwMApIZWxsbyB3b3JsZApGaXJzdCBsaW5lCgoy' +
  'CjAwOjAwOjA1LDUwMCAtLT4gMDA6MDA6MDgsMjUwClNlY29uZCBzdWJ0aXRsZQpUd28gbGluZXM=';

const SRT_TEXT = atob(SRT_B64);

const ORACLE = {
  cues: 2,
  lines: 4,
  duration: '00:00:08,250',
  firstStart: '00:00:01,000',
  lastEnd: '00:00:08,250',
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('srt-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/SRT|subtitle/i);
  });

  it('reads the summary', () => {
    const t = rowsOf(tool.run({ text: SRT_TEXT, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('SubRip (SRT)');
    expect(m.get('Cues')).toBe(String(ORACLE.cues));
    expect(m.get('Subtitle lines')).toBe(String(ORACLE.lines));
    expect(m.get('Duration')).toBe(ORACLE.duration);
    expect(m.get('Issues')).toBe('0');
  });

  it('lists the cues', () => {
    const t = rowsOf(tool.run({ text: SRT_TEXT, options: { format: 'cues' } }));
    expect(t.rows).toHaveLength(ORACLE.cues);
    expect(t.rows[0]?.[0]).toBe('1');
    expect(t.rows[0]?.[1]).toBe(ORACLE.firstStart);
    expect(t.rows[1]?.[1]).toBe('00:00:05,500');
  });

  it('flags an out-of-order index and bad timing', () => {
    const bad = '5\n00:00:01,000 --> bad\nNo text\n\n99\n00:00:00,500 --> 00:00:00,100\nx\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    expect(t.rows.length).toBeGreaterThanOrEqual(3);
    const flat = t.rows.map((r) => r[1] ?? '').join('\n');
    expect(flat).toMatch(/expected 1/i);
    expect(flat).toMatch(/Timing line/i);
    expect(flat).toMatch(/before start/i);
  });
});
