import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './regex-tester.tool';

type Res = { output: string; render?: string };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Res;

const table = (r: Awaited<ReturnType<typeof run>>) =>
  JSON.parse(r.output) as { headers: string[]; rows: string[][] };

describe('regex-tester', async () => {
  it('lists matches with headers, index and empty groups', async () => {
    const r = await run('order a1, item b22, code c333', { pattern: '\\d+', mode: 'matches' });
    expect(r.render).toBe('table');
    const t = table(r);
    expect(t.headers).toEqual(['#', 'Match', 'Groups', 'Index']);
    expect(t.rows.map((row) => row[1])).toEqual(['1', '22', '333']);
    expect(t.rows[0]![2]).toBe('{}');
    expect(t.rows[0]![3]).toBe('7');
  });

  it('reports numbered and named capture groups as JSON', async () => {
    const r = await run('2024-09', { pattern: '(?<y>\\d{4})-(\\d{2})', mode: 'matches' });
    const t = table(r);
    expect(t.rows[0]![1]).toBe('2024-09');
    expect(JSON.parse(t.rows[0]![2]!)).toEqual({ '1': '2024', '2': '09', y: '2024' });
  });

  it('replace: applies a literal replacement', async () => {
    expect(
      (
        await run('hello world', {
          pattern: '[aeiou]',
          flags: 'g',
          mode: 'replace',
          replacement: '*',
        })
      ).output,
    ).toBe('h*ll* w*rld');
  });

  it('replace: supports $1 / $2 back-references', async () => {
    expect(
      (await run('user@host', { pattern: '(\\w+)@(\\w+)', mode: 'replace', replacement: '$2.$1' }))
        .output,
    ).toBe('host.user');
  });

  it('split: one piece per line', async () => {
    expect((await run('red, green, blue', { pattern: ',\\s*', mode: 'split' })).output).toBe(
      'red\ngreen\nblue',
    );
  });

  it('highlight: wraps every match in << >>', async () => {
    expect((await run('a1 b2', { pattern: '\\d', mode: 'highlight' })).output).toBe(
      'a<<1>> b<<2>>',
    );
  });

  it('highlight: skips zero-length matches without looping', async () => {
    expect((await run('abc', { pattern: 'x*', mode: 'highlight' })).output).toBe('abc');
  });

  it('empty input → empty output', async () => {
    expect((await run('', { pattern: '.' })).output).toBe('');
  });

  it('empty input → empty output even with no pattern supplied', async () => {
    expect((await run('', {})).output).toBe('');
  });

  it('throws ToolError when the pattern is missing', async () => {
    await expect(run('abc', {})).rejects.toThrow(ToolError);
  });

  it('throws ToolError on invalid flags', async () => {
    await expect(run('abc', { pattern: '.', flags: 'gz' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError on an invalid regex, surfacing the JS message', async () => {
    await expect(run('abc', { pattern: '(', flags: 'g' })).rejects.toThrow(ToolError);
  });
});
