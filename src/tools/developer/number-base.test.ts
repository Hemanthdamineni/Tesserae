import { describe, it, expect } from 'vitest';
import tool from './number-base.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    stats?: Record<string, string | number>;
  };

describe('number-base', async () => {
  it('converts decimal to hex by default', async () => {
    expect((await run('255')).output).toBe('ff');
  });

  it('honours fromBase and toBase', async () => {
    expect((await run('255', { fromBase: 10, toBase: 2 })).output).toBe('11111111');
    expect((await run('11111111', { fromBase: 2, toBase: 10 })).output).toBe('255');
    expect((await run('z', { fromBase: 36, toBase: 10 })).output).toBe('35');
  });

  it('accepts 0x / 0o / 0b prefixes overriding fromBase', async () => {
    expect((await run('0xFF', { fromBase: 10, toBase: 10 })).output).toBe('255');
    expect((await run('0o17', { fromBase: 10, toBase: 10 })).output).toBe('15');
    expect((await run('0b1010', { fromBase: 10, toBase: 10 })).output).toBe('10');
  });

  it('strips underscores, spaces and commas', async () => {
    expect((await run('1_000', { fromBase: 10, toBase: 16 })).output).toBe('3e8');
    expect((await run('1 000 000', { fromBase: 10, toBase: 10 })).output).toBe('1000000');
  });

  it('handles a leading minus sign', async () => {
    expect((await run('-10', { fromBase: 10, toBase: 2 })).output).toBe('-1010');
  });

  it('adds a prefix when addPrefix is on', async () => {
    expect((await run('255', { fromBase: 10, toBase: 16, addPrefix: true })).output).toBe('0xff');
    expect((await run('10', { fromBase: 10, toBase: 8, addPrefix: true })).output).toBe('0o12');
    expect((await run('5', { fromBase: 10, toBase: 2, addPrefix: true })).output).toBe('0b101');
    expect((await run('35', { fromBase: 10, toBase: 36, addPrefix: true })).output).toBe('z');
  });

  it('groups output digits by 4 when groupDigits is on', async () => {
    expect((await run('1048575', { fromBase: 10, toBase: 16, groupDigits: true })).output).toBe(
      'f ffff',
    );
    expect((await run('255', { fromBase: 10, toBase: 2, groupDigits: true })).output).toBe(
      '1111 1111',
    );
  });

  it('keeps arbitrary precision with BigInt', async () => {
    const big = '123456789012345678901234567890';
    expect((await run(big, { fromBase: 10, toBase: 16 })).output).toBe(BigInt(big).toString(16));
  });

  it('exposes bin/oct/dec/hex in stats', async () => {
    const { stats } = await run('255', { fromBase: 10, toBase: 10 });
    expect(stats!.binary).toBe('11111111');
    expect(stats!.octal).toBe('377');
    expect(stats!.decimal).toBe('255');
    expect(stats!.hex).toBe('ff');
  });

  it('throws ToolError on a digit invalid for the base', async () => {
    await expect(run('2', { fromBase: 2, toBase: 10 })).rejects.toThrow(/not a valid digit/i);
    await expect(run('g', { fromBase: 16, toBase: 10 })).rejects.toThrow(/not a valid digit/i);
  });

  it('empty input gives empty output', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   ')).output).toBe('');
  });
});
