import { describe, it, expect } from 'vitest';
import tool from './nth-child-evaluator.tool';

const META = tool.meta;

async function runTable(text: string, format: string, children = 10, index = 0) {
  const r = await tool.run({ files: [], options: { format, children, index }, text });
  const parsed = JSON.parse(r.report?.output ?? '{"headers":[],"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

async function rowMap(text: string, format = 'matches', children = 10, index = 0) {
  const rows = await runTable(text, format, children, index);
  return new Map<string, string>(rows.map((x) => [String(x[0]), String(x[1])]));
}

describe('nth-child-evaluator', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('matches 3n+1 within twelve children', async () => {
    const m = await rowMap(':nth-child(3n+1)', 'matches', 12);
    expect(m.get('Matches')).toBe('1, 4, 7, 10');
    expect(m.get('Coefficients')).toBe('A = 3, B = 1');
  });

  it('matches -n+3 to the first three children', async () => {
    const m = await rowMap(':nth-of-type(-n+3)', 'matches', 8);
    expect(m.get('Matches')).toBe('1, 2, 3');
    expect(m.get('Selector')).toBe(':nth-of-type');
  });

  it('treats odd as 2n+1', async () => {
    const m = await rowMap(':nth-child(odd)', 'matches', 9);
    expect(m.get('Matches')).toBe('1, 3, 5, 7, 9');
    expect(m.get('Coefficients')).toBe('A = 2, B = 1');
  });

  it('treats even as 2n', async () => {
    const m = await rowMap(':nth-child(even)', 'matches', 8);
    expect(m.get('Matches')).toBe('2, 4, 6, 8');
    expect(m.get('Coefficients')).toBe('A = 2, B = 0');
  });

  it('handles a bare integer index', async () => {
    const m = await rowMap(':nth-child(3)', 'matches', 10);
    expect(m.get('Matches')).toBe('3');
    expect(m.get('Coefficients')).toBe('A = 0, B = 3');
  });

  it('matches n to every child', async () => {
    const m = await rowMap(':nth-child(n)', 'matches', 5);
    expect(m.get('Matches')).toBe('1, 2, 3, 4, 5');
    expect(m.get('Coefficients')).toBe('A = 1, B = 0');
  });

  it('accepts a bare An+B value without the pseudo wrapper', async () => {
    const m = await rowMap('2n+1', 'matches', 10);
    expect(m.get('Matches')).toBe('1, 3, 5, 7, 9');
  });

  it('handles a negative coefficient -2n+8', async () => {
    const m = await rowMap(':nth-child(-2n+8)', 'matches', 8);
    expect(m.get('Matches')).toBe('2, 4, 6, 8');
  });

  it('tests a specific index for membership', async () => {
    const yes = await rowMap(':nth-child(2n+1)', 'matches', 10, 7);
    expect(yes.get('Index 7')).toBe('matches');
    const no = await rowMap(':nth-child(2n+1)', 'matches', 10, 8);
    expect(no.get('Index 8')).toBe('does not match');
  });

  it('renders a readable formula', async () => {
    const m = await rowMap(':nth-child(2n-1)', 'matches', 8);
    expect(m.get('Formula')).toBe('2n - 1');
    const m2 = await rowMap(':nth-child(n+2)', 'matches', 6);
    expect(m2.get('Formula')).toBe('n + 2');
  });

  it('matches 2n-1 to odd starting at 1', async () => {
    const m = await rowMap(':nth-child(2n-1)', 'matches', 8);
    expect(m.get('Matches')).toBe('1, 3, 5, 7');
  });

  it('yields no matches when the coefficient never lands in range', async () => {
    const m = await rowMap(':nth-child(-n+1)', 'matches', 2);
    expect(m.get('Matches')).toBe('1');
  });

  it('rejects an invalid An+B grammar value', async () => {
    const rows = await runTable(':nth-child(2n1)', 'findings');
    expect(rows.some((r) => r[1] === 'grammar')).toBe(true);
  });

  it('rejects a trailing sign with no digits', async () => {
    const rows = await runTable(':nth-child(2n+)', 'findings');
    expect(rows.some((r) => r[1] === 'grammar')).toBe(true);
  });

  it('reports a non-nth selector', async () => {
    const rows = await runTable(':first-child', 'findings');
    expect(rows.some((r) => r[1] === 'grammar')).toBe(true);
  });

  it('exposes A and B in the parse view', async () => {
    const m = await rowMap(':nth-child(-2n+8)', 'parse');
    expect(m.get('A')).toBe('-2');
    expect(m.get('B')).toBe('8');
    expect(m.get('Kind')).toBe('formula');
  });

  it('reports success in findings view when the value is valid', async () => {
    const rows = await runTable(':nth-child(2n+1)', 'findings');
    expect(rows.some((r) => r[1] === 'ok')).toBe(true);
  });

  it('clamps a too-large children count', async () => {
    const m = await rowMap(':nth-child(n)', 'matches', 5000);
    expect(m.get('Children')).toBe('1000');
  });

  it('shows the first several matches with no upper bound', async () => {
    const m = await rowMap(':nth-child(3n+1)', 'matches', 500);
    const shown = m.get('First matches');
    expect(shown?.startsWith('1, 4, 7, 10, 13')).toBe(true);
  });

  it('accepts whitespace inside the An+B expression', async () => {
    const m = await rowMap(':nth-child(2n + 1)', 'matches', 9);
    expect(m.get('Matches')).toBe('1, 3, 5, 7, 9');
    const m2 = await rowMap(':nth-child(2n - 1)', 'matches', 7);
    expect(m2.get('Matches')).toBe('1, 3, 5, 7');
  });

  it('matches only the exact index for 0n+B', async () => {
    const m = await rowMap(':nth-child(0n+5)', 'matches', 10);
    expect(m.get('Matches')).toBe('5');
  });

  it('reports no matches when the constant index is out of range', async () => {
    const m = await rowMap(':nth-child(7)', 'matches', 3);
    expect(m.get('Matches')).toBe('(none)');
  });

  it('distinguishes -n (invalid range) from n', async () => {
    const m = await rowMap(':nth-child(-n)', 'matches', 5);
    expect(m.get('Matches')).toBe('(none)');
  });

  it('handles n-2 as an offset into negative indices first', async () => {
    const m = await rowMap(':nth-child(n-2)', 'matches', 6);
    expect(m.get('Matches')).toBe('1, 2, 3, 4, 5, 6');
  });
});
