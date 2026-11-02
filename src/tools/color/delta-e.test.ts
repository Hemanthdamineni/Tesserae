import { describe, it, expect } from 'vitest';
import tool from './delta-e.tool';

const META = tool.meta;

async function runTable(text: string, view = 'summary', extra: Record<string, unknown> = {}) {
  const r = await tool.run({ text, options: { view, ...extra } });
  const parsed = JSON.parse(r.output);
  return (parsed.rows ?? []) as string[][];
}

async function summary(text: string) {
  const rows = await runTable(text, 'summary');
  return new Map<string, string>(rows.map((x) => [String(x[0]), String(x[1])]));
}

describe('delta-e', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('computes CIEDE2000 for red vs blue', async () => {
    const m = await summary('#ff0000\n#0000ff');
    const d = Number(m.get('CIEDE2000'));
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(70);
  });

  it('returns ~0 for identical colors', async () => {
    const m = await summary('#123456\n#123456');
    expect(Math.abs(Number(m.get('CIEDE2000')))).toBeLessThan(1e-9);
  });

  it('gives two near-identical grays a tiny difference', async () => {
    const m = await summary('#fefefe\n#fcfcfc');
    expect(Number(m.get('CIEDE2000'))).toBeLessThan(0.5);
  });

  it('reads the perceptual band', async () => {
    const m = await summary('#ff0000\n#0000ff');
    expect(m.get('Reading')).toMatch(/unrelated|different/i);
  });

  it('parses named CSS colors', async () => {
    const m = await summary('tomato\nforestgreen');
    expect(m.get('CIEDE2000')).toBeDefined();
  });

  it('parses rgb() and hsl() forms', async () => {
    const m = await summary('rgb(255 0 0)\nhsl(240 100% 50%)');
    const d = Number(m.get('CIEDE2000'));
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(70);
  });

  it('reproduces the published CIEDE2000 test vectors (Sharma et al.)', async () => {
    const vectors: [number[], number[], number][] = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
      [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
      [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
      [[50, -0.9009, -85.5211], [50, 0, -82.7485], 1.0],
      [[50, 0, 0], [50, -1, 2], 2.3669],
      [[50, -1, 2], [50, 0, 0], 2.3669],
      [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
      [[50, -0.001, 2.49], [50, 0.0011, -2.49], 4.7461],
      [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[50, 2.5, 0], [61, -5, 29], 22.8977],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
      [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
      [[61.2901, 3.7196, -5.3901], [61.4292, 2.248, -4.962], 1.8731],
      [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
      [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
      [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
      [[6.7747, -0.2908, -2.4247], [5.8714, -0.0985, -2.2286], 0.6377],
      [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
    ];
    const bad: string[] = [];
    for (const [p, q, want] of vectors) {
      const m = await summary(`lab(${p.join(' ')})\nlab(${q.join(' ')})`);
      const got = Number(m.get('CIEDE2000'));
      if (Math.abs(got - want) >= 0.0001) {
        bad.push(`${p.join(',')} vs ${q.join(',')}: got ${got} want ${want}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('computes CIE76 as exact Euclidean distance in Lab', async () => {
    const m = await summary('lab(50 0 0)\nlab(50 3 4)');
    expect(Number(m.get('CIE76'))).toBeCloseTo(5, 10);
  });

  it('computes CIE94 for a pure chroma step', async () => {
    const m = await summary('lab(50 0 0)\nlab(50 3 4)');
    expect(Number(m.get('CIE94'))).toBeCloseTo(5, 10);
  });

  it('is symmetric under argument order', async () => {
    const a = await summary('lab(50 2.6772 -79.7751)\nlab(50 0 -82.7485)');
    const b = await summary('lab(50 0 -82.7485)\nlab(50 2.6772 -79.7751)');
    expect(Number(a.get('CIEDE2000'))).toBeCloseTo(Number(b.get('CIEDE2000')), 10);
  });

  it('accepts a Lab triplet with a percent lightness', async () => {
    const m = await summary('lab(50% 2.6772 -79.7751)\nlab(50 0 -82.7485)');
    expect(Number(m.get('CIEDE2000'))).toBeCloseTo(2.0425, 4);
  });

  it('converts sRGB to Lab with reference values for red', async () => {
    const rows = await runTable('#ff0000\n#0000ff', 'colors');
    const red = rows.find((r) => r[0] === 'Color 1') ?? [];
    expect(red[3]).toMatch(/L 53\.2/);
    expect(red[3]).toMatch(/a 80\.0/);
    expect(red[3]).toMatch(/b 67\.2/);
  });

  it('converts white and black to the Lab endpoints', async () => {
    const rows = await runTable('#ffffff\n#000000', 'colors');
    const white = rows.find((r) => r[0] === 'Color 1') ?? [];
    const black = rows.find((r) => r[0] === 'Color 2') ?? [];
    expect(white[3]).toMatch(/L 100\.0/);
    expect(black[3]).toMatch(/L 0\.0/);
  });

  it('marks a Lab input as having no RGB equivalent', async () => {
    const rows = await runTable('lab(50 2.6772 -79.7751)\nlab(50 0 -82.7485)', 'colors');
    const first = rows.find((r) => r[0] === 'Color 1') ?? [];
    expect(first[2]).toBe('(lab input)');
  });

  it('handles three-digit hex shorthand', async () => {
    const m = await summary('#f00\n#00f');
    expect(Number(m.get('CIEDE2000'))).toBeGreaterThan(50);
  });

  it('reports an unparseable color in the findings view', async () => {
    const rows = await runTable('not-a-color\n#000000', 'findings');
    expect(rows.some((r) => r[1] === 'color')).toBe(true);
  });

  it('reports success when both colors parse', async () => {
    const rows = await runTable('#ff0000\n#0000ff', 'findings');
    expect(rows.some((r) => r[1] === 'ok')).toBe(true);
  });

  it('falls back to the color options when the text is empty', async () => {
    const r = await tool.run({
      options: { view: 'summary', color1: '#ff0000', color2: '#0000ff' },
      text: '',
    });
    const rows = JSON.parse(r.output).rows as string[][];
    const m = new Map(rows.map((x) => [String(x[0]), String(x[1])]));
    expect(Number(m.get('CIEDE2000'))).toBeGreaterThan(50);
  });

  it('exposes a single formula when one metric is selected', async () => {
    const rows = await runTable('lab(50 0 0)\nlab(50 3 4)', 'differences', { metric: 'de76' });
    expect(rows.length).toBe(1);
    expect(rows[0]?.[0]).toBe('CIE76');
  });

  it('returns every formula in the all view', async () => {
    const rows = await runTable('lab(50 0 0)\nlab(50 3 4)', 'differences', { metric: 'all' });
    expect(rows.map((r) => r[0])).toEqual(['CIEDE2000', 'CIE76', 'CIE94']);
  });
});
