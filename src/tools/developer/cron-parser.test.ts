import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './cron-parser.tool';

interface Res {
  output: string;
  stats?: Record<string, string | number>;
}
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Res;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/;

function parts(r: Awaited<ReturnType<typeof run>>) {
  const lines = r.output.split('\n');
  return { sentence: lines[0]!, blank: lines[1]!, isos: lines.slice(2) };
}

describe('cron-parser', async () => {
  it('describes "*/5 * * * *" and lists 5 future runs on 5-minute boundaries', async () => {
    const r = await run('*/5 * * * *');
    const { sentence, blank, isos } = parts(r);
    expect(sentence).toBe('Every 5 minutes');
    expect(blank).toBe('');
    expect(isos).toHaveLength(5);
    let prev = Date.now();
    for (const iso of isos) {
      expect(iso).toMatch(ISO);
      const t = new Date(iso).getTime();
      expect(t).toBeGreaterThan(Date.now());
      expect(t).toBeGreaterThan(prev - 60_000);
      expect(new Date(iso).getUTCMinutes() % 5).toBe(0);
      prev = t;
    }
    expect(r.stats).toMatchObject({ fields: 5, seconds: 'no', 'next runs': 5 });
  });

  it('honors ranges and day-of-week names (weekdays at 09:30)', async () => {
    const { isos } = parts(await run('30 9 * * MON-FRI', { count: 3 }));
    expect(isos).toHaveLength(3);
    for (const iso of isos) {
      const d = new Date(iso);
      expect(d.getUTCHours()).toBe(9);
      expect(d.getUTCMinutes()).toBe(30);
      expect(d.getUTCDay()).toBeGreaterThanOrEqual(1);
      expect(d.getUTCDay()).toBeLessThanOrEqual(5);
    }
  });

  it('withSeconds: parses a 6-field expression', async () => {
    const r = await run('0 0 12 * * *', { withSeconds: true });
    const { sentence, isos } = parts(r);
    expect(sentence).toBe('At 12:00 PM');
    expect(r.stats).toMatchObject({ fields: 6, seconds: 'yes' });
    for (const iso of isos) {
      const d = new Date(iso);
      expect(d.getUTCHours()).toBe(12);
      expect(d.getUTCMinutes()).toBe(0);
    }
  });

  it('withSeconds: lists sub-minute run times from a stepped seconds field', async () => {
    const { isos } = parts(await run('*/30 * * * * *', { withSeconds: true, count: 4 }));
    expect(isos).toHaveLength(4);
    expect(isos.map((iso) => new Date(iso).getUTCSeconds())).toEqual([0, 30, 0, 30]);
    const t = isos.map((iso) => new Date(iso).getTime());
    expect(t[1]! - t[0]!).toBe(30_000);
    expect(t[2]! - t[1]!).toBe(30_000);
  });

  it('withSeconds: errors when only 5 fields are given', async () => {
    await expect(run('0 12 * * *', { withSeconds: true })).rejects.toThrow(ToolError);
  });

  it('verbose: produces a wordier sentence', async () => {
    const plain = parts(await run('0 12 * * *')).sentence;
    const wordy = parts(await run('0 12 * * *', { verbose: true })).sentence;
    expect(plain).toBe('At 12:00 PM');
    expect(wordy).not.toBe(plain);
    expect(wordy).toContain('every day');
  });

  it('count: clamps to 1..20', async () => {
    expect(parts(await run('* * * * *', { count: 100 })).isos).toHaveLength(20);
    expect(parts(await run('* * * * *', { count: 0 })).isos).toHaveLength(1);
  });

  it('every-minute runs are consecutive', async () => {
    const isos = parts(await run('* * * * *', { count: 3 })).isos;
    const t0 = new Date(isos[0]!).getTime();
    const t1 = new Date(isos[1]!).getTime();
    const t2 = new Date(isos[2]!).getTime();
    expect(t1 - t0).toBe(60_000);
    expect(t2 - t1).toBe(60_000);
  });

  it('comma lists and month names', async () => {
    const { isos } = parts(await run('0 0 1 JAN,JUL *', { count: 2 }));
    for (const iso of isos) {
      const d = new Date(iso);
      expect(d.getUTCDate()).toBe(1);
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
      expect([1, 7]).toContain(d.getUTCMonth() + 1);
    }
  });

  it('day-of-month OR day-of-week when both are restricted', async () => {
    const { isos } = parts(await run('0 0 13 * FRI', { count: 6 }));
    for (const iso of isos) {
      const d = new Date(iso);
      expect(d.getUTCDate() === 13 || d.getUTCDay() === 5).toBe(true);
    }
  });

  it('empty input → empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('throws ToolError on the wrong field count', async () => {
    await expect(run('* * * *')).rejects.toThrow(ToolError);
    await expect(run('not a real cron expression here')).rejects.toThrow(ToolError);
  });

  it('throws ToolError on an out-of-range value', async () => {
    await expect(run('60 * * * *')).rejects.toThrow(ToolError);
  });
});
