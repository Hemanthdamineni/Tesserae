import { describe, it, expect } from 'vitest';
import tool from './color-palette.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options });
const palette = (r: Awaited<ReturnType<typeof run>>) => JSON.parse(r.output) as string[];

function rgbOf(hex: string): number[] {
  return Array.from({ length: 3 }, (_, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16));
}
function near(a: string, b: string): boolean {
  const pa = rgbOf(a);
  const pb = rgbOf(b);
  return pa.every((v, i) => Math.abs(v - pb[i]!) <= 1);
}
function hueOf(hex: string): number {
  const c = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(c[0]!, c[1]!, c[2]!);
  const min = Math.min(c[0]!, c[1]!, c[2]!);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === c[0]!) h = ((c[1]! - c[2]!) / d + (c[1]! < c[2]! ? 6 : 0)) * 60;
  else if (max === c[1]!) h = ((c[2]! - c[0]!) / d + 2) * 60;
  else h = ((c[0]! - c[2]!) / d + 4) * 60;
  return ((h % 360) + 360) % 360;
}
const distHue = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

describe('color-palette', async () => {
  it('tints-shades produces count steps at the base hue', async () => {
    const r = await run('#3b82f6', { count: 5 });
    const p = palette(r);
    expect(p).toHaveLength(5);
    // All steps should share the base hue (within rounding)
    const baseHue = hueOf('#3b82f6');
    for (const c of p) {
      expect(distHue(hueOf(c), baseHue)).toBeLessThan(5);
    }
  });

  it('complementary yields two colours, base plus hue+180', async () => {
    const r = await run('#3b82f6', { scheme: 'complementary' });
    const p = palette(r);
    expect(p).toHaveLength(2);
    expect(near(p[0]!, '#3b82f6')).toBe(true);
    expect(distHue(hueOf(p[0]!), hueOf(p[1]!))).toBeGreaterThan(140);
  });

  it('triadic yields three hues spaced ~120 degrees', async () => {
    const r = await run('#3b82f6', { scheme: 'triadic' });
    const p = palette(r);
    expect(p).toHaveLength(3);
    expect(distHue(hueOf(p[0]!), hueOf(p[1]!))).toBeGreaterThan(110);
    expect(distHue(hueOf(p[1]!), hueOf(p[2]!))).toBeGreaterThan(110);
  });

  it('tetradic yields 4', async () => {
    const r = await run('#3b82f6', { scheme: 'tetradic' });
    expect(palette(r)).toHaveLength(4);
  });

  it('split-complementary yields 3', async () => {
    const r = await run('#3b82f6', { scheme: 'split-complementary' });
    expect(palette(r)).toHaveLength(3);
  });

  it('analogous honours count', async () => {
    const r = await run('#3b82f6', { scheme: 'analogous', count: 5 });
    expect(palette(r)).toHaveLength(5);
  });

  it('monochromatic honours count and keeps the hue', async () => {
    const r = await run('#3b82f6', { scheme: 'monochromatic', count: 4 });
    const p = palette(r);
    expect(p).toHaveLength(4);
    expect(distHue(hueOf(p[0]!), hueOf('#3b82f6'))).toBeLessThan(5);
  });

  it('throws ToolError on a bad colour', async () => {
    await expect(run('#nope')).rejects.toThrow(ToolError);
  });

  it('empty input gives empty output', async () => {
    expect((await run('')).output).toBe('');
  });
});
