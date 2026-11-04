import { describe, it, expect } from 'vitest';
import tool from './cubic-bezier.tool';
import { ToolError } from '@/lib/types';

type Result = { output: string; stats?: Record<string, string | number>; render?: string };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const rows = (r: Result) => (JSON.parse(r.output) as { rows: string[][] }).rows;

describe('cubic-bezier', async () => {
  it('0.25,0.1,0.25,1 is nearest to the "ease" keyword', async () => {
    const r = await run('0.25, 0.1, 0.25, 1');
    expect(r.stats!['nearest keyword']).toBe('ease');
  });

  it('samples 11 evenly spaced t values by default', async () => {
    const r = await run('0.25, 0.1, 0.25, 1');
    expect(rows(r)).toHaveLength(11);
    expect(rows(r)[0]).toEqual(['0', '0']);
    expect(rows(r)[10]).toEqual(['1', '1']);
  });

  it('linear produces progress ≈ t', async () => {
    const r = await run('0, 0, 1, 1');
    expect(r.stats!['nearest keyword']).toBe('linear');
    for (const [t, p] of rows(r)) {
      expect(Math.abs(Number(p) - Number(t))).toBeLessThan(0.001);
    }
  });

  it('exposes the canonical cubic-bezier() string', async () => {
    const r1 = await run('0.42, 0, 1, 1');
    expect(r1.stats!['cubic-bezier()']).toBe('cubic-bezier(0.42, 0, 1, 1)');
    const r2 = await run('0.42, 0, 1, 1');
    expect(r2.stats!['nearest keyword']).toBe('ease-in');
  });

  it('ease-out and ease-in-out are recognised', async () => {
    const r1 = await run('0, 0, 0.58, 1');
    expect(r1.stats!['nearest keyword']).toBe('ease-out');
    const r2 = await run('0.42, 0, 0.58, 1');
    expect(r2.stats!['nearest keyword']).toBe('ease-in-out');
  });

  it('honours the samples option', async () => {
    expect(rows(await run('0,0,1,1', { samples: 5 }))).toHaveLength(5);
  });

  it('throws ToolError when x values leave [0,1]', async () => {
    await expect(run('-0.1, 0, 0.5, 1')).rejects.toThrow(ToolError);
    await expect(run('0.5, 0, 1.5, 1')).rejects.toThrow(/between 0 and 1/);
  });

  it('throws ToolError when not four numbers', async () => {
    await expect(run('1, 2, 3')).rejects.toThrow(ToolError);
    await expect(run('a, b, c, d')).rejects.toThrow(/four numbers/);
  });

  it('empty input gives empty output', async () => {
    expect((await run('')).output).toBe('');
  });
});
