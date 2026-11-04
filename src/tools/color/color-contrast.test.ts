import { describe, it, expect } from 'vitest';
import tool from './color-contrast.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options });
const rows = (r: Awaited<ReturnType<typeof run>>) =>
  (JSON.parse(r.output) as { rows: string[][] }).rows;
const result = (r: Awaited<ReturnType<typeof run>>, row: string) =>
  rows(r).find((x) => x[0] === row)![1];

describe('color-contrast', async () => {
  it('black on white is exactly 21:1 and all checks pass', async () => {
    const r = await run('#000000');
    expect(r.stats!.ratio).toBe('21.00:1');
    expect(result(r, 'AA normal text (>=4.5)')).toBe('Pass');
    expect(result(r, 'AAA normal (>=7)')).toBe('Pass');
  });

  it('#777 on #fff fails AA normal but passes AA large', async () => {
    const r = await run('#777777');
    expect(r.stats!.ratio).toBe('4.48:1');
    expect(result(r, 'AA normal text (>=4.5)')).toBe('Fail');
    expect(result(r, 'AA large text (>=3)')).toBe('Pass');
  });

  it('accepts named colours and rgb() syntax', async () => {
    const r = await run('white', { second: 'black' });
    expect(r.stats!.ratio).toBe('21.00:1');
  });

  it('reports the contrast ratio row in X.XX:1 form', async () => {
    expect(result(await run('#ffffff', { second: '#000000' }), 'Contrast ratio')).toBe('21.00:1');
  });

  it('throws ToolError on a bad colour', async () => {
    await expect(run('#zzzzzz')).rejects.toThrow(ToolError);
    await expect(run('#zzzzzz')).rejects.toThrow(/is not a colour/);
    await expect(run('#000000', { second: 'nope' })).rejects.toThrow(ToolError);
  });

  it('empty input gives empty output', async () => {
    expect((await run('')).output).toBe('');
  });
});
