import { describe, it, expect } from 'vitest';
import tool from './url-encode.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('url-encode', async () => {
  it('encodes a component', async () => {
    expect((await run('a b&c=d')).output).toBe('a%20b%26c%3Dd');
  });
  it('whole-URL scope keeps structure', async () => {
    expect((await run('https://x.io/a b?q=1&r=2', { scope: 'full' })).output).toBe(
      'https://x.io/a%20b?q=1&r=2',
    );
  });
  it('decodes a component', async () => {
    expect((await run('caf%C3%A9%20%26%20cr%C3%A8me', { mode: 'decode' })).output).toBe(
      'café & crème',
    );
  });
  it('round-trips', async () => {
    const s = 'Ω≈ç√∫˜µ ?&=#';
    const encoded = (await run(s)).output;
    expect((await run(encoded, { mode: 'decode' })).output).toBe(s);
  });
  it('optionally treats + as space when decoding', async () => {
    expect((await run('a+b', { mode: 'decode', plusSpace: true })).output).toBe('a b');
    expect((await run('a+b', { mode: 'decode', plusSpace: false })).output).toBe('a+b');
  });
  it('throws on malformed input', async () => {
    await expect(run('%', { mode: 'decode' })).rejects.toThrow(/percent-encoding/i);
  });
  it('empty input', async () => {
    expect((await run('')).output).toBe('');
  });
});
