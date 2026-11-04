import { describe, it, expect } from 'vitest';
import tool from './hex.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('hex', async () => {
  it('encodes with a space separator by default', async () => {
    expect((await run('Hi')).output).toBe('48 69');
  });
  it('encodes with no separator', async () => {
    expect((await run('Hi', { separator: 'none' })).output).toBe('4869');
  });
  it('encodes uppercase', async () => {
    expect((await run('Hi', { separator: 'none', uppercase: true })).output).toBe('4869');
    expect((await run('\xff', { separator: 'none', uppercase: true })).output).toBe('C3BF');
  });
  it('encodes 0x and \\x forms', async () => {
    expect((await run('Hi', { separator: '0x' })).output).toBe('0x48 0x69');
    expect((await run('Hi', { separator: 'backslash-x' })).output).toBe('\\x48\\x69');
  });
  it('round-trips UTF-8', async () => {
    const s = 'héllo — 世界';
    const hex = (await run(s, { separator: 'none' })).output;
    expect((await run(hex, { mode: 'decode' })).output).toBe(s);
  });
  it('decodes ignoring separators and prefixes', async () => {
    expect((await run('68:65:6c:6c:6f', { mode: 'decode' })).output).toBe('hello');
    expect((await run('0x680x65', { mode: 'decode' })).output).toBe('he');
  });
  it('throws on odd-length hex', async () => {
    await expect(run('abc', { mode: 'decode' })).rejects.toThrow(/odd number/i);
  });
  it('empty input → empty output', async () => {
    expect((await run('')).output).toBe('');
  });
});
