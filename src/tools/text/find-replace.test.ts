import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './find-replace.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    stats?: Record<string, string | number>;
  };

describe('find-replace', async () => {
  it('plain mode replaces every occurrence', async () => {
    const r = await run('the cat sat on the mat', { find: 'the', replace: 'a' });
    expect(r.output).toBe('a cat sat on a mat');
    expect(r.stats?.['replacements made']).toBe(2);
  });

  it('plain mode treats $ in the replacement literally', async () => {
    expect((await run('price x', { find: 'x', replace: '$1' })).output).toBe('price $1');
  });

  it('whole-word mode only matches full words', async () => {
    const r = await run('cat category catalog cat', {
      find: 'cat',
      replace: 'dog',
      mode: 'whole-word',
    });
    expect(r.output).toBe('dog category catalog dog');
    expect(r.stats?.['replacements made']).toBe(2);
  });

  it('regex mode supports $1 backreferences', async () => {
    const r = await run('Jane Doe', {
      find: '(\\w+) (\\w+)',
      replace: '$2, $1',
      mode: 'regex',
      flags: 'g',
    });
    expect(r.output).toBe('Doe, Jane');
    expect(r.stats?.['replacements made']).toBe(1);
  });

  it('regex mode without the g flag replaces only the first match', async () => {
    const r = await run('aaa', { find: 'a', replace: 'b', mode: 'regex', flags: '' });
    expect(r.output).toBe('baa');
    expect(r.stats?.['replacements made']).toBe(1);
  });

  it('caseInsensitive folds case in plain mode', async () => {
    const r = await run('The THE the', { find: 'the', replace: 'x', caseInsensitive: true });
    expect(r.output).toBe('x x x');
    expect(r.stats?.['replacements made']).toBe(3);
  });

  it('caseInsensitive adds the i flag in regex mode', async () => {
    expect(
      (await run('Foo foo', { find: 'foo', replace: 'bar', mode: 'regex', caseInsensitive: true }))
        .output,
    ).toBe('bar bar');
  });

  it('empty find throws ToolError', async () => {
    await expect(run('hello', { find: '' })).rejects.toThrow(ToolError);
  });

  it('invalid regex pattern throws ToolError', async () => {
    await expect(run('hello', { find: '(', mode: 'regex' })).rejects.toThrow(ToolError);
  });

  it('invalid regex flags throw ToolError', async () => {
    await expect(run('hello', { find: 'h', mode: 'regex', flags: 'zz' })).rejects.toThrow(
      ToolError,
    );
  });

  it('empty input returns empty output', async () => {
    expect((await run('', { find: 'a', replace: 'b' })).output).toBe('');
  });
});
