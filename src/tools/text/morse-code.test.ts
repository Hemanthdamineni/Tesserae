import { describe, it, expect } from 'vitest';
import tool from './morse-code.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; warnings?: string[] };

describe('morse-code', async () => {
  it('encodes text to Morse by default', async () => {
    expect((await run('SOS')).output).toBe('... --- ...');
    expect((await run('Hello World')).output).toBe('.... . .-.. .-.. --- / .-- --- .-. .-.. -..');
  });

  it('encodes digits and punctuation', async () => {
    expect((await run('E1?')).output).toBe('. .---- ..--..');
  });

  it('replaces unsupported characters with "?" and warns', async () => {
    const res = await run('A~B');
    expect(res.output).toBe('.- ? -...');
    expect(res.warnings?.[0]).toMatch(/~/);
  });

  it('decodes Morse to text', async () => {
    expect(
      (await run('.... . .-.. .-.. --- / .-- --- .-. .-.. -..', { mode: 'morse-to-text' })).output,
    ).toBe('HELLO WORLD');
  });

  it('decoding tolerates extra spaces and "|" word separators', async () => {
    expect((await run('...   ---   ...', { mode: 'morse-to-text' })).output).toBe('SOS');
    expect(
      (await run('.... . .-.. .-.. ---|.-- --- .-. .-.. -..', { mode: 'morse-to-text' })).output,
    ).toBe('HELLO WORLD');
  });

  it('round-trips a phrase', async () => {
    const morse = (await run('The quick brown fox 42')).output;
    expect((await run(morse, { mode: 'morse-to-text' })).output).toBe('THE QUICK BROWN FOX 42');
  });

  it('throws ToolError on an invalid Morse group', async () => {
    await expect(run('........', { mode: 'morse-to-text' })).rejects.toThrow(/not a valid Morse/i);
    await expect(run('hello', { mode: 'morse-to-text' })).rejects.toThrow(/not a valid Morse/i);
  });

  it('empty input → empty output in both modes', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('', { mode: 'morse-to-text' })).output).toBe('');
    expect((await run('   ', { mode: 'morse-to-text' })).output).toBe('');
  });
});
