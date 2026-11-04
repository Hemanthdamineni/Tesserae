import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './yaml-to-json.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; language?: string };

describe('yaml-to-json', async () => {
  it('converts a mapping to pretty JSON with a 2-space indent by default', async () => {
    expect((await run('name: Toolbench\ntags:\n  - a\n  - b\n')).output).toBe(
      '{\n  "name": "Toolbench",\n  "tags": [\n    "a",\n    "b"\n  ]\n}',
    );
  });

  it('honours the 4-space indent branch', async () => {
    expect((await run('a: 1\n', { indent: '4' })).output).toBe('{\n    "a": 1\n}');
  });

  it('honours the tab indent branch', async () => {
    expect((await run('a: 1\n', { indent: 'tab' })).output).toBe('{\n\t"a": 1\n}');
  });

  it('sorts object keys recursively when asked', async () => {
    expect((await run('b: 2\na: 1\n', { sortKeys: true })).output).toBe(
      '{\n  "a": 1,\n  "b": 2\n}',
    );
    expect((await run('outer:\n  z: 1\n  a: 2\n', { sortKeys: true })).output).toBe(
      '{\n  "outer": {\n    "a": 2,\n    "z": 1\n  }\n}',
    );
  });

  it('leaves key order untouched when sorting is off', async () => {
    expect((await run('b: 2\na: 1\n')).output).toBe('{\n  "b": 2,\n  "a": 1\n}');
  });

  it('handles scalars', async () => {
    expect((await run('42')).output).toBe('42');
    expect((await run('hello')).output).toBe('"hello"');
  });

  it('returns empty output for empty input', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   ')).output).toBe('');
  });

  it('treats a comment-only document as the null value', async () => {
    expect((await run('# just a comment')).output).toBe('null');
  });

  it('sets a json code language', async () => {
    expect((await run('a: 1')).language).toBe('json');
  });

  it('throws ToolError on invalid YAML', async () => {
    await expect(run('key: {a: 1')).rejects.toThrow(ToolError);
  });
});
