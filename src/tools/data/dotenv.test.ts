import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './dotenv.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; render?: string; language?: string };

describe('dotenv', async () => {
  it('parses KEY=VALUE lines, skipping comments and blanks and stripping "export"', async () => {
    const src = '# database\n\nexport DB_HOST=localhost\nDB_PORT=5432\nGREETING="hello world"\n';
    const out = await run(src, { mode: 'parse' });
    expect(JSON.parse(out.output)).toEqual({
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      GREETING: 'hello world',
    });
    expect(out.render).toBe('code');
    expect(out.language).toBe('json');
  });

  it('strips inline comments from unquoted values and processes double-quote escapes', async () => {
    expect(JSON.parse((await run('PORT=5432 # the port', { mode: 'parse' })).output)).toEqual({
      PORT: '5432',
    });
    expect(JSON.parse((await run('MSG="a\\nb"', { mode: 'parse' })).output)).toEqual({
      MSG: 'a\nb',
    });
  });

  it('does not expand ${VAR} by default', async () => {
    const src = 'HOST=localhost\nPORT=5432\nURL=proto://${HOST}:${PORT}/app';
    expect(JSON.parse((await run(src, { mode: 'parse' })).output).URL).toBe(
      'proto://${HOST}:${PORT}/app',
    );
  });

  it('expands ${VAR} from earlier keys when expand is on, but not in single quotes', async () => {
    const src = "HOST=localhost\nPORT=5432\nURL=proto://${HOST}:${PORT}/app\nRAW='${HOST}'";
    const parsed = JSON.parse((await run(src, { mode: 'parse', expand: true })).output);
    expect(parsed.URL).toBe('proto://localhost:5432/app');
    expect(parsed.RAW).toBe('${HOST}');
  });

  it('builds .env text, quoting values with spaces or specials by default', async () => {
    const out = await run('{ "DB_HOST": "localhost", "GREETING": "hello world" }', {
      mode: 'build',
    });
    expect(out.output).toBe('DB_HOST=localhost\nGREETING="hello world"');
    expect(out.language).toBe('bash');
  });

  it('escapes quotes when quoting and handles numbers and null', async () => {
    expect((await run('{ "A": "he said \\"hi\\"" }', { mode: 'build' })).output).toBe(
      'A="he said \\"hi\\""',
    );
    expect((await run('{ "N": 42, "Z": null }', { mode: 'build' })).output).toBe('N=42\nZ=');
  });

  it('leaves values unquoted when quoteValues is off', async () => {
    expect(
      (await run('{ "GREETING": "hello world" }', { mode: 'build', quoteValues: false })).output,
    ).toBe('GREETING=hello world');
  });

  it('returns empty output for empty input', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   \n  ', { mode: 'build' })).output).toBe('');
  });

  it('throws ToolError on a non-comment line without =', async () => {
    await expect(run('DB_HOST=localhost\nJUST_A_LINE', { mode: 'parse' })).rejects.toThrow(
      ToolError,
    );
  });

  it('throws ToolError when building from a non-object or invalid JSON', async () => {
    await expect(run('[1, 2]', { mode: 'build' })).rejects.toThrow(ToolError);
    await expect(run('nope', { mode: 'build' })).rejects.toThrow(ToolError);
  });
});
