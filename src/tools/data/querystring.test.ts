import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './querystring.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; render?: string; language?: string };

describe('querystring', async () => {
  it('parses a query string with a leading ? and brackets arrays', async () => {
    const out = await run('?q=hello+world&page=2&tag[]=a&tag[]=b', { mode: 'parse' });
    expect(JSON.parse(out.output)).toEqual({ q: 'hello world', page: '2', tag: ['a', 'b'] });
    expect(out.render).toBe('code');
    expect(out.language).toBe('json');
  });

  it('collapses repeated keys into an array (repeat format)', async () => {
    const out = await run('id=1&id=2&id=3', { mode: 'parse', arrayFormat: 'repeat' });
    expect(JSON.parse(out.output)).toEqual({ id: ['1', '2', '3'] });
  });

  it('splits comma values (comma format) but keeps single values as strings', async () => {
    expect(
      JSON.parse((await run('a=1,2,3&b=x', { mode: 'parse', arrayFormat: 'comma' })).output),
    ).toEqual({
      a: ['1', '2', '3'],
      b: 'x',
    });
    expect(JSON.parse((await run('a=1', { mode: 'parse', arrayFormat: 'comma' })).output)).toEqual({
      a: '1',
    });
  });

  it('sorts keys when sortKeys is on (parse)', async () => {
    expect((await run('b=2&a=1', { mode: 'parse', sortKeys: true })).output).toBe(
      '{\n  "a": "1",\n  "b": "2"\n}',
    );
  });

  it('builds a query string from JSON, URL-encoding keys and values', async () => {
    expect((await run('{ "q": "hello world", "tag": ["a", "b"] }', { mode: 'build' })).output).toBe(
      'q=hello%20world&tag%5B%5D=a&tag%5B%5D=b',
    );
  });

  it('builds with the repeat and comma array formats', async () => {
    expect((await run('{ "id": [1, 2] }', { mode: 'build', arrayFormat: 'repeat' })).output).toBe(
      'id=1&id=2',
    );
    expect((await run('{ "id": [1, 2, 3] }', { mode: 'build', arrayFormat: 'comma' })).output).toBe(
      'id=1,2,3',
    );
  });

  it('sorts keys when sortKeys is on (build)', async () => {
    expect((await run('{ "b": 2, "a": 1 }', { mode: 'build', sortKeys: true })).output).toBe(
      'a=1&b=2',
    );
  });

  it('returns empty output for empty input', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   ', { mode: 'build' })).output).toBe('');
  });

  it('throws ToolError on malformed percent-encoding when parsing', async () => {
    await expect(run('q=%ZZ', { mode: 'parse' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError when building from a non-object or invalid JSON', async () => {
    await expect(run('[1, 2, 3]', { mode: 'build' })).rejects.toThrow(ToolError);
    await expect(run('not json', { mode: 'build' })).rejects.toThrow(ToolError);
  });
});
