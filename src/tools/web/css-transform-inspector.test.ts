import { describe, it, expect } from 'vitest';
import tool from './css-transform-inspector.tool';

const META = tool.meta;
const opts = { format: 'matrix', round: 4 };

async function runTable(text: string, format = 'matrix') {
  const r = await tool.run({ files: [], options: { ...opts, format }, text });
  const parsed = JSON.parse(r.report?.output ?? '{"headers":[],"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

async function rowMap(text: string, format = 'matrix') {
  const rows = await runTable(text, format);
  return new Map<string, string>(rows.map((x) => [String(x[0]), String(x[1])]));
}
describe('css-transform-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('composes a simple translation', async () => {
    const m = await rowMap('translate(10px, 20px)');
    expect(m.get('matrix()')).toBe('matrix(1, 0, 0, 1, 10, 20)');
    expect(m.get('Determinant')).toBe('1');
    expect(m.get('Invertible')).toBe('yes');
  });

  it('composes scale with default y', async () => {
    const m = await rowMap('scale(2)');
    expect(m.get('matrix()')).toBe('matrix(2, 0, 0, 2, 0, 0)');
  });

  it('composes scale(2, 3)', async () => {
    const m = await rowMap('scale(2, 3)');
    expect(m.get('matrix()')).toBe('matrix(2, 0, 0, 3, 0, 0)');
  });

  it('composes rotate(90deg)', async () => {
    const m = await rowMap('rotate(90deg)');
    expect(m.get('matrix()')).toBe('matrix(0, 1, -1, 0, 0, 0)');
  });

  it('composes skewX(45deg)', async () => {
    const m = await rowMap('skewX(45deg)');
    expect(m.get('matrix()')).toBe('matrix(1, 0, 1, 1, 0, 0)');
  });

  it('applies functions left-to-right in matrix form', async () => {
    const first = await rowMap('translate(10px) scale(2)');
    expect(first.get('matrix()')).toBe('matrix(2, 0, 0, 2, 10, 0)');
    const second = await rowMap('scale(2) translate(10px)');
    expect(second.get('matrix()')).toBe('matrix(2, 0, 0, 2, 20, 0)');
  });

  it('passes matrix() values through', async () => {
    const m = await rowMap('matrix(1, 0.5, -0.5, 1, 2, 3)');
    expect(m.get('matrix()')).toBe('matrix(1, 0.5, -0.5, 1, 2, 3)');
  });
  it('decomposes rotate(90) scale(2, 3)', async () => {
    const m = await rowMap('rotate(90deg) scale(2, 3)');
    expect(m.get('Rotate')).toBe('90deg');
    expect(m.get('Scale')).toBe('2, 3');
    expect(m.get('SkewX')).toBe('0deg');
  });

  it('decomposes a plain translation', async () => {
    const m = await rowMap('translate(10px, 20px)');
    expect(m.get('Translate')).toBe('10, 20');
    expect(m.get('Rotate')).toBe('0deg');
    expect(m.get('Scale')).toBe('1, 1');
  });

  it('decomposes skewX(45deg)', async () => {
    const m = await rowMap('skewX(45deg)');
    expect(m.get('SkewX')).toBe('45deg');
  });

  it('reports a mirror when the determinant is negative', async () => {
    const m = await rowMap('scale(-1, 1)');
    expect(m.get('Mirrored')).toBe('yes');
    expect(m.get('Invertible')).toBe('yes');
  });

  it('reports non-invertible for scale(0)', async () => {
    const m = await rowMap('scale(0)');
    expect(m.get('Invertible')).toBe('no');
    expect(m.get('Determinant')).toBe('0');
  });

  it('accepts angles written in turns', async () => {
    const m = await rowMap('rotate(0.25turn)');
    expect(m.get('matrix()')).toBe('matrix(0, 1, -1, 0, 0, 0)');
  });

  it('accepts a bare zero angle', async () => {
    const m = await rowMap('rotate(0)');
    expect(m.get('matrix()')).toBe('matrix(1, 0, 0, 1, 0, 0)');
  });
  it('rejects unknown functions', async () => {
    const rows = await runTable('frobnicate(3)', 'findings');
    expect(rows.some((r) => r[0] === 'error' && r[1] === 'unknown-function')).toBe(true);
  });

  it('rejects 3D functions as unsupported', async () => {
    const rows = await runTable('rotateX(30deg)', 'findings');
    expect(rows.some((r) => r[0] === 'error' && r[1] === 'unsupported-3d')).toBe(true);
    const rows2 = await runTable('matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', 'findings');
    expect(rows2.some((r) => r[0] === 'error' && r[1] === 'unsupported-3d')).toBe(true);
  });

  it('rejects wrong arity', async () => {
    const rows = await runTable('translate(1px, 2px, 3px)', 'findings');
    expect(rows.some((r) => r[0] === 'error' && r[1] === 'arity')).toBe(true);
  });

  it('rejects matrix with the wrong count', async () => {
    const rows = await runTable('matrix(1, 2, 3, 4, 5)', 'findings');
    expect(rows.some((r) => r[0] === 'error' && r[1] === 'arity')).toBe(true);
  });

  it('reports unbalanced parentheses', async () => {
    const rows = await runTable('translate(10px', 'findings');
    expect(rows.some((r) => r[1] === 'syntax')).toBe(true);
  });

  it('reports empty input', async () => {
    const rows = await runTable('   ', 'findings');
    expect(rows.some((r) => r[1] === 'empty')).toBe(true);
  });

  it('rounds to the requested number of decimals', async () => {
    const r = await tool.run({ files: [], options: { ...opts, round: 2 }, text: 'rotate(30deg)' });
    const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
    const rows = (parsed.rows ?? []) as string[][];
    const m = new Map(rows.map((x) => [String(x[0]), String(x[1])]));
    expect(m.get('matrix()')).toBe('matrix(0.87, 0.5, -0.5, 0.87, 0, 0)');
  });

  it('tolerates newlines and extra whitespace between functions', async () => {
    const m = await rowMap('  translate(10px)\n   scale(2)  ');
    expect(m.get('matrix()')).toBe('matrix(2, 0, 0, 2, 10, 0)');
  });

  it('handles three chained functions in order', async () => {
    const m = await rowMap('translate(100px, 0) scale(2) rotate(90deg)');
    expect(m.get('matrix()')).toBe('matrix(0, 2, -2, 0, 100, 0)');
  });

  it('exposes the functions view with one row per function', async () => {
    const t = await tool.run({
      files: [],
      options: { ...opts, format: 'functions' },
      text: 'translate(10px) scale(2)',
    });
    const parsed = JSON.parse(t.report?.output ?? '{"rows":[]}');
    const rows = (parsed.rows ?? []) as string[][];
    expect(rows.length).toBe(2);
    expect(rows[0]?.[0]).toBe('translate');
    expect(rows[1]?.[0]).toBe('scale');
  });

  it('reports success in the findings view when there are no problems', async () => {
    const rows = await runTable('translate(1px)', 'findings');
    expect(rows.some((r) => r[1] === 'ok')).toBe(true);
  });

  it('returns a text summary by default', async () => {
    const r = await tool.run({ files: [], options: {}, text: 'rotate(90deg)' });
    expect(r.report?.output).toContain('Functions: 1');
    expect(r.report?.output).toContain('Invertible: yes');
  });

  it('clamps an out-of-range decimal count', async () => {
    const r = await tool.run({ files: [], options: { ...opts, round: 99 }, text: 'rotate(30deg)' });
    const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
    const rows = (parsed.rows ?? []) as string[][];
    const m = new Map(rows.map((x) => [String(x[0]), String(x[1])]));
    expect(m.get('matrix()')).toBe('matrix(0.8660254038, 0.5, -0.5, 0.8660254038, 0, 0)');
  });
  it('warns that a percentage length is read as px', async () => {
    const rows = await runTable('translate(50%, -50%)', 'findings');
    expect(rows.some((r) => r[0] === 'warn' && r[1] === 'percentage')).toBe(true);
    const m = await rowMap('translate(50%, -50%)');
    expect(m.get('matrix()')).toBe('matrix(1, 0, 0, 1, 50, -50)');
  });

  it('does not warn for plain px lengths', async () => {
    const rows = await runTable('translate(50px)', 'findings');
    expect(rows.some((r) => r[1] === 'percentage')).toBe(false);
  });
});
