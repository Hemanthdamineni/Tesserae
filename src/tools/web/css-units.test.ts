import { describe, it, expect } from 'vitest';
import tool from './css-units.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options });
const rows = (r: Awaited<ReturnType<typeof run>>) =>
  (JSON.parse(r.output) as { rows: string[][] }).rows;
const val = (r: Awaited<ReturnType<typeof run>>, unit: string) =>
  rows(r).find((row) => row[0] === unit)![1];

describe('css-units', async () => {
  it('24px → 1.5rem with the default 16px root', async () => {
    const r = await run('24px');
    expect(val(r, 'rem')).toBe('1.5');
  });

  it('1.5rem → 24px with root 16', async () => {
    expect(val(await run('1.5rem'), 'px')).toBe('24');
  });

  it('12pt → 16px (96 px per inch, 72 pt per inch)', async () => {
    expect(val(await run('12pt'), 'px')).toBe('16');
  });

  it('absolute units convert: 1in → 96px → 2.54cm', async () => {
    expect(val(await run('1in'), 'px')).toBe('96');
    expect(Number(val(await run('1in'), 'em'))).toBeCloseTo(6, 4);
  });

  it('input without a unit uses the fromUnit option', async () => {
    expect(val(await run('24', { fromUnit: 'px' }), 'rem')).toBe('1.5');
    expect(val(await run('24', { fromUnit: 'pt' }), 'px')).toBe('32');
  });

  it('percent base drives the % row', async () => {
    expect(val(await run('50%', { percentBase: 200 }), 'px')).toBe('100');
  });

  it('respects a custom root font size', async () => {
    expect(val(await run('2rem', { rootFontSize: 20 }), 'px')).toBe('40');
  });

  it('rounds to 4 dp and trims trailing zeros', async () => {
    expect(val(await run('1px'), 'rem')).toBe('0.0625');
  });

  it('throws ToolError on non-numeric input', async () => {
    await expect(run('big')).rejects.toThrow(ToolError);
    await expect(run('big')).rejects.toThrow(/number, optionally with a unit/);
  });

  it('empty input gives empty output', async () => {
    expect((await run('')).output).toBe('');
  });
});
