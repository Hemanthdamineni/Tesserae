import { describe, it, expect } from 'vitest';
import tool from './gradient-css.tool';
import { ToolError } from '@/lib/types';

const run = async (text = '', options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })).output;

describe('gradient-css', async () => {
  it('defaults to a 90° linear gradient with the spec stops', async () => {
    const out = await run();
    expect(out).toContain('linear-gradient(90deg, #4f46e5 0%, #ec4899 100%)');
    expect(out).toContain('background-color: #4f46e5;');
  });

  it('radial gradients use the chosen shape', async () => {
    expect(await run('', { type: 'radial' })).toContain('radial-gradient(ellipse,');
    expect(await run('', { type: 'radial', shape: 'circle' })).toContain('radial-gradient(circle,');
  });

  it('conic gradients use from-angle syntax', async () => {
    expect(await run('', { type: 'conic', angle: 45 })).toContain('conic-gradient(from 45deg,');
  });

  it('accepts rgb/hsl/named colours and stops without positions', async () => {
    const out = await run('', { stops: 'red\nrgb(0,128,0)\n#00f 100%' });
    expect(out).toContain('linear-gradient(90deg, red, rgb(0,128,0), #00f 100%)');
  });

  it('throws ToolError on a bad colour token', async () => {
    await expect(run('', { stops: '#4f46e5\nnotacolor 50%' })).rejects.toThrow(ToolError);
    await expect(run('', { stops: '#4f46e5\nnotacolor 50%' })).rejects.toThrow(/is not a colour/);
  });

  it('throws ToolError with fewer than two valid stops', async () => {
    await expect(run('', { stops: '#4f46e5' })).rejects.toThrow(ToolError);
    await expect(run('', { stops: '#4f46e5' })).rejects.toThrow(/at least two colour stops/);
  });
});
