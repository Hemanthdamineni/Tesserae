import { describe, it, expect } from 'vitest';
import tool from './crc32.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; stats?: Record<string, unknown> };

describe('crc32', async () => {
  it('CRC-32 of "123456789" is the default', async () => {
    expect((await run('123456789')).output).toBe('cbf43926');
  });

  it('CRC-32 of the standard fox phrase', async () => {
    expect((await run('The quick brown fox jumps over the lazy dog')).output).toBe('414fa339');
  });

  it('CRC-32C (Castagnoli) of "123456789"', async () => {
    expect((await run('123456789', { variant: 'crc32c' })).output).toBe('e3069283');
  });

  it('Adler-32 of "abc"', async () => {
    expect((await run('abc', { variant: 'adler32' })).output).toBe('024d0127');
  });

  it('Adler-32 of "Wikipedia"', async () => {
    expect((await run('Wikipedia', { variant: 'adler32' })).output).toBe('11e60398');
  });

  it('decimal output for CRC-32 and Adler-32', async () => {
    expect((await run('123456789', { output: 'decimal' })).output).toBe('3421780262');
    expect((await run('abc', { variant: 'adler32', output: 'decimal' })).output).toBe('38600999');
  });

  it('uppercases hex output when asked', async () => {
    expect((await run('123456789', { uppercase: true })).output).toBe('CBF43926');
  });

  it('stats carry the decimal, hex and label', async () => {
    const { stats } = await run('123456789');
    expect(stats!.decimal).toBe(3421780262);
    expect(stats!.hex).toBe('0xcbf43926');
    expect(stats!.variant).toBe('CRC-32');
    expect(stats!.bytes).toBe(9);
  });

  it('empty input produces empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('throws ToolError on an unknown variant', async () => {
    await expect(run('abc', { variant: 'crc64' })).rejects.toThrow(ToolError);
  });
});
