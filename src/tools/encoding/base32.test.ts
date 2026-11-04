import { describe, it, expect } from 'vitest';
import tool from './base32.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('base32', async () => {
  it('encodes RFC 4648 vectors', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('f')).output).toBe('MY======');
    expect((await run('fo')).output).toBe('MZXQ====');
    expect((await run('foo')).output).toBe('MZXW6===');
    expect((await run('foobar')).output).toBe('MZXW6YTBOI======');
  });
  it('omits padding when disabled', async () => {
    expect((await run('foo', { padding: false })).output).toBe('MZXW6');
  });
  it('decodes RFC 4648', async () => {
    expect((await run('MZXW6YTBOI======', { mode: 'decode' })).output).toBe('foobar');
    expect((await run('nbswy3dp', { mode: 'decode' })).output).toBe('hello');
  });
  it('round-trips UTF-8', async () => {
    const s = 'héllo 世界';
    const encoded = (await run(s)).output;
    expect((await run(encoded, { mode: 'decode' })).output).toBe(s);
  });
  it('Crockford variant round-trips and rejects U', async () => {
    const enc = (await run('test', { variant: 'crockford' })).output;
    expect((await run(enc, { mode: 'decode', variant: 'crockford' })).output).toBe('test');
  });
  it('throws on an invalid character', async () => {
    await expect(run('MZXW6YTB01', { mode: 'decode' })).rejects.toThrow(/not valid Base32/i);
  });
});
