import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-diff.tool';

type Res = {
  output: string;
  render?: string;
  notes?: string[];
  stats?: Record<string, string | number>;
};
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Res;

describe('json-diff', async () => {
  it('reports changed and added keys at the top level', async () => {
    const out = await run('{ "name": "a", "port": 80 }', {
      second: '{ "name": "a", "port": 443, "tls": true }',
    });
    expect(out.output).toBe('- $.port: 80\n+ $.port: 443\n+ $.tls: true');
    expect(out.render).toBe('diff');
    expect(out.stats).toEqual({ added: 1, removed: 0, changed: 1 });
  });

  it('reports removed keys', async () => {
    const out = await run('{ "a": 1, "b": 2 }', { second: '{ "a": 1 }' });
    expect(out.output).toBe('- $.b: 2');
    expect(out.stats).toEqual({ added: 0, removed: 1, changed: 0 });
  });

  it('recurses into nested objects with dotted paths', async () => {
    const out = await run('{ "db": { "host": "localhost", "port": 5432 } }', {
      second: '{ "db": { "host": "127.0.0.1", "port": 5432 } }',
    });
    expect(out.output).toBe('- $.db.host: "localhost"\n+ $.db.host: "127.0.0.1"');
    expect(out.stats?.changed).toBe(1);
  });

  it('diffs arrays index by index and reports appended elements', async () => {
    expect((await run('{ "x": [1, 2, 3] }', { second: '{ "x": [1, 9, 3] }' })).output).toBe(
      '- $.x[1]: 2\n+ $.x[1]: 9',
    );
    expect((await run('{ "x": [1, 2] }', { second: '{ "x": [1, 2, 3] }' })).output).toBe(
      '+ $.x[2]: 3',
    );
  });

  it('treats a type change as a single changed path', async () => {
    const out = await run('{ "v": 1 }', { second: '{ "v": [1] }' });
    expect(out.output).toBe('- $.v: 1\n+ $.v: [1]');
    expect(out.stats).toEqual({ added: 0, removed: 0, changed: 1 });
  });

  it('ignores array order when the option is on', async () => {
    const same = await run('{ "tags": ["a", "b", "c"] }', {
      second: '{ "tags": ["c", "b", "a"] }',
      ignoreArrayOrder: true,
    });
    expect(same.output).toBe('');
    expect(same.notes).toEqual(['No differences.']);
    expect(same.stats).toEqual({ added: 0, removed: 0, changed: 0 });

    const changed = await run('["a", "b"]', { second: '["b", "c"]', ignoreArrayOrder: true });
    expect(changed.output).toBe('- $[*]: "a"\n+ $[*]: "c"');
    expect(changed.stats).toEqual({ added: 1, removed: 1, changed: 0 });
  });

  it('defaults the second input to an empty object', async () => {
    const out = await run('{ "a": 1 }');
    expect(out.output).toBe('- $.a: 1');
  });

  it('returns empty output for empty input', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   ')).output).toBe('');
  });

  it('throws ToolError on invalid JSON in either side', async () => {
    await expect(run('not json', { second: '{}' })).rejects.toThrow(ToolError);
    await expect(run('{ "a": 1 }', { second: '{ bad' })).rejects.toThrow(ToolError);
  });
});
