import { describe, it, expect } from 'vitest';
import tool from './nato-phonetic.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('nato-phonetic', async () => {
  it('spells letters with NATO words by default', async () => {
    expect((await run('SOS')).output).toBe('Sierra Oscar Sierra');
    expect((await run('abc')).output).toBe('Alfa Bravo Charlie');
  });

  it('spells digits, using Niner for 9', async () => {
    expect((await run('AB12')).output).toBe('Alfa Bravo One Two');
    expect((await run('90')).output).toBe('Niner Zero');
  });

  it('drops spaces and passes other characters through as their own token', async () => {
    expect((await run('Hi!')).output).toBe('Hotel India !');
    expect((await run('A-B')).output).toBe('Alfa - Bravo');
  });

  it('reads phonetic words back to text, case-insensitively', async () => {
    expect((await run('Sierra Oscar Sierra', { mode: 'phonetic-to-text' })).output).toBe('SOS');
    expect((await run('alfa BRAVO oNe two', { mode: 'phonetic-to-text' })).output).toBe('AB12');
  });

  it('round-trips through both directions', async () => {
    const phonetic = (await run('Zulu9!')).output;
    expect(phonetic).toBe('Zulu Uniform Lima Uniform Niner !');
    expect((await run(phonetic, { mode: 'phonetic-to-text' })).output).toBe('ZULU9!');
  });

  it('keeps unknown tokens verbatim on the reverse pass', async () => {
    expect((await run('Hotel India !', { mode: 'phonetic-to-text' })).output).toBe('HI!');
  });

  it('throws ToolError when reverse input has no phonetic words', async () => {
    await expect(run('hello world', { mode: 'phonetic-to-text' })).rejects.toThrow(
      /no nato phonetic/i,
    );
  });

  it('empty input → empty output in both modes', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   ')).output).toBe('');
    expect((await run('', { mode: 'phonetic-to-text' })).output).toBe('');
  });
});
