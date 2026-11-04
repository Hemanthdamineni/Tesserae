import { describe, it, expect } from 'vitest';
import tool from './ascii85.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('ascii85', async () => {
  it('encodes the Adobe variant with delimiters', async () => {
    expect((await run('Man is', { mode: 'encode', variant: 'adobe' })).output).toBe('<~9jqo^Bla~>');
    expect((await run('Hello', { mode: 'encode', variant: 'adobe' })).output).toBe('<~87cURDZ~>');
  });

  it('encodes the btoa variant without delimiters', async () => {
    expect((await run('Hello', { mode: 'encode', variant: 'btoa' })).output).toBe('87cURDZ');
  });

  it('uses z for a zero group and y for four spaces (btoa)', async () => {
    expect((await run('\x00\x00\x00\x00', { mode: 'encode', variant: 'adobe' })).output).toBe(
      '<~z~>',
    );
    expect((await run('    ', { mode: 'encode', variant: 'btoa' })).output).toBe('y');
  });

  it('decodes the Adobe and btoa variants', async () => {
    expect((await run('<~9jqo^Bla~>', { mode: 'decode', variant: 'adobe' })).output).toBe('Man is');
    expect((await run('87cURDZ', { mode: 'decode', variant: 'btoa' })).output).toBe('Hello');
    expect((await run('<~z~>', { mode: 'decode', variant: 'adobe' })).output).toBe(
      '\x00\x00\x00\x00',
    );
    expect((await run('y', { mode: 'decode', variant: 'btoa' })).output).toBe('    ');
  });

  it('decodes Adobe input even without the <~ ~> delimiters', async () => {
    expect((await run('87cURDZ', { mode: 'decode', variant: 'adobe' })).output).toBe('Hello');
  });

  it('handles the Z85 variant (multiple of 4 bytes)', async () => {
    expect((await run('test', { mode: 'encode', variant: 'z85' })).output).toBe('By/Jn');
    expect((await run('By/Jn', { mode: 'decode', variant: 'z85' })).output).toBe('test');
  });

  it('round-trips UTF-8 text (adobe and btoa)', async () => {
    const s = 'héllo — 世界 🚀';
    for (const variant of ['adobe', 'btoa'] as const) {
      const enc = (await run(s, { mode: 'encode', variant })).output;
      expect((await run(enc, { mode: 'decode', variant })).output).toBe(s);
    }
  });

  it('empty input → empty output', async () => {
    expect((await run('', { mode: 'encode', variant: 'adobe' })).output).toBe('');
    expect((await run('', { mode: 'decode', variant: 'z85' })).output).toBe('');
  });

  it('throws when Z85 input is not a multiple of 4 bytes on encode', async () => {
    await await expect(run('abc', { mode: 'encode', variant: 'z85' })).rejects.toThrow(ToolError);
    await await expect(run('abc', { mode: 'encode', variant: 'z85' })).rejects.toThrow(
      /multiple of 4/i,
    );
  });

  it('throws when Z85 input is not a multiple of 5 chars on decode', async () => {
    await await expect(run('abcd', { mode: 'decode', variant: 'z85' })).rejects.toThrow(
      /multiple of 5/i,
    );
  });

  it('throws on a dangling character when decoding Adobe', async () => {
    await await expect(run('<~a~>', { mode: 'decode', variant: 'adobe' })).rejects.toThrow(
      /dangling/i,
    );
  });

  it('throws on an out-of-range character when decoding', async () => {
    await await expect(run('ab~cd', { mode: 'decode', variant: 'btoa' })).rejects.toThrow(
      /not a valid Ascii85 character/i,
    );
  });

  it('throws when an Ascii85 group overflows 32 bits', async () => {
    // "uuuuu" is 84*(85^4+85^3+85^2+85+1) = 4437053124 > 2^32-1
    await expect(run('<~uuuuu~>', { mode: 'decode', variant: 'adobe' })).rejects.toThrow(ToolError);
    await await expect(run('<~uuuuu~>', { mode: 'decode', variant: 'adobe' })).rejects.toThrow(
      /out of range/i,
    );
  });

  it('throws when a Z85 group overflows 32 bits', async () => {
    // "#####" maps to 84,84,84,84,84 -> same overflow value
    await expect(run('#####', { mode: 'decode', variant: 'z85' })).rejects.toThrow(/out of range/i);
  });
});
