import { describe, it, expect } from 'vitest';
import tool from './rot13.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('rot13', async () => {
  it('applies ROT13 to letters by default', async () => {
    expect((await run('Hello, World!')).output).toBe('Uryyb, Jbeyq!');
  });

  it('ROT13 is its own inverse', async () => {
    const s = 'The quick brown fox jumps over 13 lazy dogs.';
    const first = (await run(s)).output;
    expect((await run(first)).output).toBe(s);
  });

  it('ROT5 rotates digits only', async () => {
    expect((await run('abc 123 XYZ', { variant: 'rot5' })).output).toBe('abc 678 XYZ');
  });

  it('ROT18 rotates both letters and digits', async () => {
    expect((await run('Hello 123', { variant: 'rot18' })).output).toBe('Uryyb 678');
    const s = 'Mix3d C4se 99';
    const first = (await run(s, { variant: 'rot18' })).output;
    expect((await run(first, { variant: 'rot18' })).output).toBe(s);
  });

  it('ROT47 rotates printable ASCII and is self-inverse', async () => {
    expect((await run('Hello', { variant: 'rot47' })).output).toBe('w6==@');
    const s = 'Hello, World! 42 #$%';
    const first = (await run(s, { variant: 'rot47' })).output;
    expect((await run(first, { variant: 'rot47' })).output).toBe(s);
  });

  it('leaves spaces and non-ASCII letters untouched under ROT47', async () => {
    expect((await run('a é', { variant: 'rot47' })).output).toBe('2 é');
  });

  it('Caesar shifts letters by the given amount and wraps', async () => {
    expect((await run('abc XYZ', { variant: 'caesar', shift: 3 })).output).toBe('def ABC');
    expect((await run('def ABC', { variant: 'caesar', shift: 23 })).output).toBe('abc XYZ');
  });

  it('throws ToolError on an out-of-range Caesar shift', async () => {
    await expect(run('abc', { variant: 'caesar', shift: 30 })).rejects.toThrow(/1 to 25/i);
    await expect(run('abc', { variant: 'caesar', shift: 0 })).rejects.toThrow(/1 to 25/i);
  });

  it('empty input → empty output', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('', { variant: 'rot47' })).output).toBe('');
  });
});
