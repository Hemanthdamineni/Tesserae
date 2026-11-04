import { describe, it, expect } from 'vitest';
import tool from './base58.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('base58', async () => {
  it('encodes known values (Bitcoin alphabet)', async () => {
    expect((await run('Hello World!')).output).toBe('2NEpo7TZRRrLZSi2U');
    expect((await run('hello')).output).toBe('Cn8eVZg');
  });

  it('decodes known values', async () => {
    expect((await run('2NEpo7TZRRrLZSi2U', { mode: 'decode' })).output).toBe('Hello World!');
    expect((await run('Cn8eVZg', { mode: 'decode' })).output).toBe('hello');
  });

  it('preserves leading zero bytes as leading "1"s', async () => {
    expect((await run('\x00', { mode: 'encode' })).output).toBe('1');
    expect((await run('\x00\x00a', { mode: 'encode' })).output).toBe('112g');
    expect((await run('112g', { mode: 'decode' })).output).toBe('\x00\x00a');
  });

  it('round-trips UTF-8 text', async () => {
    const s = 'héllo — 世界 🚀';
    const encoded = (await run(s, { mode: 'encode' })).output;
    expect((await run(encoded, { mode: 'decode' })).output).toBe(s);
  });

  it('empty input → empty output for both modes', async () => {
    expect((await run('', { mode: 'encode' })).output).toBe('');
    expect((await run('', { mode: 'decode' })).output).toBe('');
  });

  it('throws on an invalid character when decoding', async () => {
    await expect(run('0OIl', { mode: 'decode' })).rejects.toThrow(ToolError);
    await expect(run('abc def', { mode: 'decode' })).rejects.toThrow(
      /not a valid Base58 character/i,
    );
  });
});
