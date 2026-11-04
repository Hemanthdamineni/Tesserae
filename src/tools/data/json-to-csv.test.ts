import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-to-csv.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; language?: string };

describe('json-to-csv', async () => {
  it('converts an array of objects with a header row by default', async () => {
    expect(
      (await run('[{ "name": "Ada", "role": "dev" }, { "name": "Linus", "role": "ops" }]')).output,
    ).toBe('name,role\nAda,dev\nLinus,ops');
  });

  it('unions keys across rows, leaving missing cells empty', async () => {
    expect((await run('[{ "a": 1 }, { "b": 2 }]')).output).toBe('a,b\n1,\n,2');
  });

  it('flattens nested objects to dotted keys when flatten is on', async () => {
    expect((await run('[{ "id": 1, "user": { "name": "Ada", "city": "London" } }]')).output).toBe(
      'id,user.name,user.city\n1,Ada,London',
    );
  });

  it('serialises nested objects as JSON when flatten is off', async () => {
    expect((await run('[{ "id": 1, "user": { "name": "Ada" } }]', { flatten: false })).output).toBe(
      'id,user\n1,"{""name"":""Ada""}"',
    );
  });

  it('omits the header row when header is false', async () => {
    expect((await run('[{ "a": 1, "b": 2 }]', { header: false })).output).toBe('1,2');
  });

  it('supports the semicolon, tab, and pipe delimiters', async () => {
    expect((await run('[{ "a": 1, "b": 2 }]', { delimiter: 'semicolon' })).output).toBe('a;b\n1;2');
    expect((await run('[{ "a": 1, "b": 2 }]', { delimiter: 'tab' })).output).toBe('a\tb\n1\t2');
    expect((await run('[{ "a": 1, "b": 2 }]', { delimiter: 'pipe' })).output).toBe('a|b\n1|2');
  });

  it('quotes fields containing the delimiter, quotes, or newlines', async () => {
    expect((await run('[{ "v": "a,b" }]')).output).toBe('v\n"a,b"');
    expect((await run('[{ "v": "say \\"hi\\"" }]')).output).toBe('v\n"say ""hi"""');
    expect((await run('[{ "v": "l1\\nl2" }]')).output).toBe('v\n"l1\nl2"');
  });

  it('accepts an array of arrays', async () => {
    expect((await run('[["a", "b"], [1, 2]]')).output).toBe('a,b\n1,2');
  });

  it('renders null as empty and keeps primitives', async () => {
    expect((await run('[{ "a": null, "b": true, "c": 0 }]')).output).toBe('a,b,c\n,true,0');
  });

  it('returns empty output for empty input or an empty array', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('[]')).output).toBe('');
  });

  it('sets a csv code language', async () => {
    expect((await run('[{ "a": 1 }]')).language).toBe('csv');
  });

  it('throws ToolError on invalid JSON, a non-array, or a non-object row', async () => {
    await expect(run('[{ bad json }]')).rejects.toThrow(ToolError);
    await expect(run('{ "a": 1 }')).rejects.toThrow(ToolError);
    await expect(run('[1, 2, 3]')).rejects.toThrow(ToolError);
  });
});
