import { describe, it, expect } from 'vitest';
import tool from './wrap-text.tool';

type Opts = Record<string, string | number | boolean>;
const run = async (text: string, options: Opts = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    stats?: Record<string, string | number>;
  };

describe('wrap-text', async () => {
  it('greedily wraps to the given width', async () => {
    expect((await run('the quick brown fox jumps', { mode: 'wrap', width: 10 })).output).toBe(
      'the quick\nbrown fox\njumps',
    );
  });

  it('preserves blank lines between paragraphs by default', async () => {
    expect((await run('aaa bbb\n\nccc ddd', { mode: 'wrap', width: 5 })).output).toBe(
      'aaa\nbbb\n\nccc\nddd',
    );
  });

  it('merges paragraphs when preserveParagraphs is off', async () => {
    expect(
      (await run('aaa\n\nbbb', { mode: 'wrap', width: 80, preserveParagraphs: false })).output,
    ).toBe('aaa bbb');
  });

  it('breaks over-long words when breakLongWords is on', async () => {
    expect(
      (await run('abcdefghij km', { mode: 'wrap', width: 4, breakLongWords: true })).output,
    ).toBe('abcd\nefgh\nij\nkm');
  });

  it('leaves over-long words intact when breakLongWords is off', async () => {
    expect((await run('abcdefghij km', { mode: 'wrap', width: 4 })).output).toBe('abcdefghij\nkm');
  });

  it('unwraps lines within a paragraph, keeping paragraph breaks', async () => {
    expect((await run('line one\nline two\n\npara two here', { mode: 'unwrap' })).output).toBe(
      'line one line two\n\npara two here',
    );
  });

  it('unwraps everything to one line when preserveParagraphs is off', async () => {
    expect((await run('a\nb\n\nc', { mode: 'unwrap', preserveParagraphs: false })).output).toBe(
      'a b c',
    );
  });

  it('empty input → empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('throws ToolError on a non-positive width', async () => {
    await expect(run('hello there', { mode: 'wrap', width: 0 })).rejects.toThrow(/width/i);
  });

  it('reports line count in stats', async () => {
    const r = await run('the quick brown fox jumps', { mode: 'wrap', width: 10 });
    expect(r.stats?.lines).toBe(3);
  });
});
