import { describe, it, expect } from 'vitest';
import tool from './color-convert.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; stats?: Record<string, string> };

describe('color-convert', async () => {
  it('parses #rrggbb and reports all formats', async () => {
    const { output } = await run('#3b82f6');
    expect(output).toContain('HEX    #3b82f6');
    expect(output).toContain('RGB    rgb(59 130 246)');
    expect(output).toMatch(/HSL {4}hsl\(217 91% 60%\)/);
    expect(output).toContain('OKLCH');
  });

  it('parses short hex', async () => {
    expect((await run('#f00')).output).toContain('rgb(255 0 0)');
  });

  it('parses rgb() with spaces and commas', async () => {
    expect((await run('rgb(239, 68, 68)')).output).toContain('HEX    #ef4444');
    expect((await run('rgb(239 68 68)')).output).toContain('HEX    #ef4444');
  });

  it('parses hsl()', async () => {
    // hsl(160 84% 39%) -> rgb(16 183 127)
    expect((await run('hsl(160 84% 39%)')).output).toContain('#10b77f');
  });

  it('parses named colours', async () => {
    expect((await run('teal')).output).toContain('#008080');
    expect((await run('white')).output).toContain('#ffffff');
  });

  it('keeps alpha through hex8', async () => {
    expect((await run('#00000080')).output).toMatch(/RGB {4}rgb\(0 0 0 \/ 0\.50/);
  });

  it('computes contrast ratios', async () => {
    const { stats } = await run('#ffffff');
    expect(stats!['vs black']).toMatch(/21\.00:1/);
  });

  it('throws on gibberish', async () => {
    await expect(run('not-a-color')).rejects.toThrow(ToolError);
  });

  it('empty input yields empty output', async () => {
    expect((await run('')).output).toBe('');
  });
});
