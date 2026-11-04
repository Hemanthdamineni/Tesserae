import { describe, it, expect } from 'vitest';
import tool from './punycode.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options });

describe('punycode', async () => {
  it('encodes münchen.de per RFC 3492', async () => {
    expect((await run('münchen.de')).output).toBe('xn--mnchen-3ya.de');
  });

  it('encodes bücher.example', async () => {
    expect((await run('bücher.example')).output).toBe('xn--bcher-kva.example');
  });

  it('encodes a CJK label', async () => {
    expect((await run('日本語.jp')).output).toBe('xn--wgv71a119e.jp');
  });

  it('leaves ASCII-only domains unchanged in both directions', async () => {
    expect((await run('example.com')).output).toBe('example.com');
    expect((await run('example.com', { mode: 'to-unicode' })).output).toBe('example.com');
  });

  it('round-trips Unicode → ASCII → Unicode', async () => {
    const ascii = (await run('münchen.de')).output;
    expect((await run(ascii, { mode: 'to-unicode' })).output).toBe('münchen.de');
  });

  it('handles mixed ASCII and non-ASCII labels', async () => {
    expect((await run('www.münchen.de')).output).toBe('www.xn--mnchen-3ya.de');
  });

  it('throws ToolError on an invalid xn-- label', async () => {
    await expect(run('xn--!!!.de', { mode: 'to-unicode' })).rejects.toThrow(ToolError);
    await expect(run('xn--!!!.de', { mode: 'to-unicode' })).rejects.toThrow(
      /Invalid Punycode label/,
    );
  });

  it('empty input gives empty output', async () => {
    expect((await run('')).output).toBe('');
  });
});
