import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-to-yaml.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; language?: string };

describe('json-to-yaml', async () => {
  it('converts an object to YAML with a 2-space indent by default', async () => {
    expect((await run('{ "name": "Tesserae", "tags": ["a", "b"] }')).output).toBe(
      'name: Tesserae\ntags:\n  - a\n  - b\n',
    );
  });

  it('honours the 4-space indent branch', async () => {
    expect((await run('{ "server": { "host": "localhost" } }', { indent: '4' })).output).toBe(
      'server:\n    host: localhost\n',
    );
  });

  it('falls back to 2 spaces for the explicit "2" branch', async () => {
    expect((await run('{ "a": { "b": 1 } }', { indent: '2' })).output).toBe('a:\n  b: 1\n');
  });

  it('sets a yaml code language', async () => {
    expect((await run('{ "a": 1 }')).language).toBe('yaml');
  });

  it('handles scalars and null', async () => {
    expect((await run('42')).output).toBe('42\n');
    expect((await run('null')).output).toBe('null\n');
  });

  it('returns empty output for empty input', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   ')).output).toBe('');
  });

  it('throws ToolError on invalid JSON', async () => {
    await expect(run('{ not: json }')).rejects.toThrow(ToolError);
  });
});
