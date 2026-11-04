import { describe, it, expect } from 'vitest';
import tool from './sql-format.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('sql-format', async () => {
  it('breaks major clauses onto their own lines and uppercases keywords', async () => {
    const out = (await run('select id, name from users where age > 18 order by name')).output;
    expect(out).toContain('SELECT');
    expect(out).toContain('\nFROM users');
    expect(out).toContain('\nWHERE age > 18');
    expect(out).toContain('\nORDER BY name');
  });

  it('expands a multi-column SELECT list, one column per line', async () => {
    const out = (await run('SELECT a, b, c FROM t')).output;
    const lines = out.split('\n');
    expect(lines[0]).toBe('SELECT');
    expect(lines[1]).toBe('  a,');
    expect(lines[2]).toBe('  b,');
    expect(lines[3]).toBe('  c');
  });

  it('indents ON / AND / OR under their clause', async () => {
    const out = (await run('select * from a join b on a.id = b.id and b.x = 1')).output;
    expect(out).toContain('\n  ON a.id = b.id');
    expect(out).toContain('\n  AND b.x = 1');
  });

  it('respects the indent option', async () => {
    expect((await run('SELECT a, b FROM t', { indent: '4' })).output).toContain('\n    a,');
  });

  it('can leave keyword casing unchanged', async () => {
    expect((await run('select a from t', { uppercaseKeywords: false })).output).toContain(
      'select a',
    );
  });

  it('never reformats inside string literals or comments', async () => {
    const out = (await run("SELECT 'from where select' AS s -- from here\nFROM t")).output;
    expect(out).toContain("'from where select'");
    expect(out).toContain('-- from here');
  });

  it('does not corrupt numeric literals', async () => {
    expect((await run('SELECT a FROM t LIMIT 10')).output).toContain('LIMIT 10');
  });

  it('throws on an unterminated string literal', async () => {
    await expect(run("SELECT 'oops FROM t")).rejects.toThrow(/[Uu]nterminated/);
  });

  it('empty input returns empty output', async () => {
    expect((await run('')).output).toBe('');
  });
});
