import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './csv-to-json.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; language?: string };
const parsed = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  JSON.parse((await run(text, options)).output);

describe('csv-to-json', async () => {
  it('parses a header row into objects and infers types by default', async () => {
    expect((await run('name,age\nAda,36\nLinus,54\n')).output).toBe(
      '[\n  {\n    "name": "Ada",\n    "age": 36\n  },\n  {\n    "name": "Linus",\n    "age": 54\n  }\n]',
    );
  });

  it('keeps everything as strings when inferTypes is off', async () => {
    expect(await parsed('a;b\n1;2\n', { delimiter: 'semicolon', inferTypes: false })).toEqual([
      { a: '1', b: '2' },
    ]);
  });

  it('infers booleans and null', async () => {
    expect(await parsed('a,b,c\ntrue,false,null\n')).toEqual([{ a: true, b: false, c: null }]);
  });

  it('does not turn leading-zero strings into numbers', async () => {
    expect(await parsed('code\n007\n')).toEqual([{ code: '007' }]);
  });

  it('uses positional keys when there is no header', async () => {
    expect(await parsed('1,2,3\n4,5,6\n', { header: false })).toEqual([
      { col1: 1, col2: 2, col3: 3 },
      { col1: 4, col2: 5, col3: 6 },
    ]);
  });

  it('trims fields and header names when trim is on', async () => {
    expect(await parsed(' a , b \n x , y \n', { trim: true })).toEqual([{ a: 'x', b: 'y' }]);
    expect(await parsed(' a , b \n x , y \n')).toEqual([{ ' a ': ' x ', ' b ': ' y ' }]);
  });

  it('handles quoted fields, escaped quotes, and CRLF endings', async () => {
    expect(await parsed('name,note\r\n"Ada","a,b"\r\n')).toEqual([{ name: 'Ada', note: 'a,b' }]);
    expect(await parsed('v\n"say ""hi"""\n')).toEqual([{ v: 'say "hi"' }]);
  });

  it('auto-detects the delimiter from the first line', async () => {
    expect(await parsed('a;b;c\n1;2;3')).toEqual([{ a: 1, b: 2, c: 3 }]);
    expect(await parsed('a\tb\n1\t2')).toEqual([{ a: 1, b: 2 }]);
    expect(await parsed('a|b\n1|2')).toEqual([{ a: 1, b: 2 }]);
  });

  it('respects an explicit comma, pipe, or tab delimiter', async () => {
    expect(await parsed('a,b\n1,2', { delimiter: 'comma' })).toEqual([{ a: 1, b: 2 }]);
    expect(await parsed('a|b\n1|2', { delimiter: 'pipe' })).toEqual([{ a: 1, b: 2 }]);
    expect(await parsed('a\tb\n1\t2', { delimiter: 'tab' })).toEqual([{ a: 1, b: 2 }]);
    // a semicolon-containing value is not split when the delimiter is forced to comma
    expect(await parsed('a,b\n"x;y",2', { delimiter: 'comma' })).toEqual([{ a: 'x;y', b: 2 }]);
  });

  it('returns empty output for empty input', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   ')).output).toBe('');
  });

  it('sets a json code language', async () => {
    expect((await run('a,b\n1,2')).language).toBe('json');
  });

  it('throws ToolError on an unterminated quoted field', async () => {
    await expect(run('name\n"Ada')).rejects.toThrow(ToolError);
  });
});
