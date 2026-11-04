import { describe, expect, it } from 'vitest';
import type { ViewerResult } from './sqlite-viewer.core';
import tool, { planRequest, runWithDb, toFileResult } from './sqlite-viewer.tool';
import { createSampleDatabase, databaseFile } from '../../../test/sqlite-fixtures';

const MAX_DB_BYTES = 200 * 1024 * 1024;

/** Parse a `render: 'table'` report back into its headers + rows. */
function parseTable(result: { report?: { output: string } }): {
  headers: string[];
  rows: string[][];
} {
  return JSON.parse(String(result.report?.output)) as { headers: string[]; rows: string[][] };
}

describe('sqlite-viewer metadata', () => {
  it('is a file tool that opts into its own panel', () => {
    expect(tool.meta.id).toBe('sqlite-viewer');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.panel).toBe('sqlite-viewer');
    expect(tool.meta.accept).toContain('.sqlite');
  });
});

describe('sqlite-viewer request planning', () => {
  it('defaults to browsing the tables', () => {
    expect(planRequest({})).toEqual({
      action: 'browse',
      sql: '',
      table: '',
      exportFormat: 'none',
      maxRows: 500,
    });
  });

  it('turns a typed statement into a query, whatever the select says', () => {
    const request = planRequest({ action: 'browse', query: '  SELECT id FROM users ;  ' });
    expect(request.action).toBe('query');
    expect(request.sql).toBe('SELECT id FROM users');
  });

  it('reads .tables and .schema as the shell shortcuts they are', () => {
    expect(planRequest({ action: 'query', query: '.tables' }).action).toBe('browse');
    const schema = planRequest({ action: 'browse', query: '.schema users' });
    expect(schema.action).toBe('schema');
    expect(schema.table).toBe('users');
    expect(planRequest({ query: '.schema' }).table).toBe('');
  });

  it('keeps the selected action and scopes an explicit schema request', () => {
    const request = planRequest({ action: 'schema', table: 'users', export: 'csv', maxRows: 25 });
    expect(request).toEqual({
      action: 'schema',
      sql: '',
      table: 'users',
      exportFormat: 'csv',
      maxRows: 25,
    });
  });

  it('normalises the row limit and the export selection', () => {
    expect(planRequest({ maxRows: 0 }).maxRows).toBe(1);
    expect(planRequest({ maxRows: 12.7 }).maxRows).toBe(12);
    expect(planRequest({ maxRows: 'not a number' }).maxRows).toBe(500);
    expect(planRequest({ export: 'csv' }).exportFormat).toBe('csv');
    expect(planRequest({ export: 'json' }).exportFormat).toBe('json');
    expect(planRequest({ export: 'xlsx' }).exportFormat).toBe('none');
    expect(planRequest({ action: 'nonsense' }).action).toBe('browse');
  });

  it('refuses a write before the engine is loaded', () => {
    expect(() => planRequest({ query: "INSERT INTO users (name) VALUES ('x');" })).toThrow(
      /"INSERT" cannot run here/,
    );
    expect(() => planRequest({ query: 'DROP TABLE users;' })).toThrow(/cannot run here/);
    expect(() => planRequest({ query: 'SELECT 1; DELETE FROM users;' })).toThrow(
      /one statement at a time/,
    );
    expect(() => planRequest({ query: 'PRAGMA journal_mode = WAL;' })).toThrow(/assigns/);
    expect(() => planRequest({ query: '.dump' })).toThrow(/not something the viewer can run/);
  });
});

describe('sqlite-viewer input validation', () => {
  it('asks for a file', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(
      /Choose a SQLite database file/,
    );
  });

  it('rejects an empty file', async () => {
    await expect(tool.run({ files: [new File([], 'empty.db')], options: {} })).rejects.toThrow(
      /That file is empty/,
    );
  });

  it('rejects a file past the size guard', async () => {
    const huge = new File(['x'], 'huge.db');
    Object.defineProperty(huge, 'size', { value: MAX_DB_BYTES + 1 });
    await expect(tool.run({ files: [huge], options: {} })).rejects.toThrow(/too large/);
  });

  it('rejects a write without opening the database', async () => {
    const file = new File(['not read at all'], 'small.db');
    const options = { action: 'query', query: 'UPDATE users SET name = 1;' };
    await expect(tool.run({ files: [file], options })).rejects.toThrow(/"UPDATE" cannot run here/);
  });
});

describe('sqlite-viewer against a real database', () => {
  it('lists every table and view with its counts and the file summary', async () => {
    const { db, bytes } = await createSampleDatabase();
    const result = runWithDb(db, { files: [databaseFile(bytes)], options: {} });
    const table = parseTable(result);

    expect(table.headers).toEqual(['Table', 'Type', 'Columns', 'Rows']);
    expect(table.rows).toEqual([
      ['contacts', 'view', '3', '3'],
      ['notes', 'table', '3', '2'],
      ['users', 'table', '4', '3'],
    ]);
    expect(result.stats.File).toBe('sample.db');
    expect(result.stats.Size).toBe('16 KB');
    expect(result.stats.Tables).toBe('3');
    expect(result.stats.Rows).toBe('8');
    expect(String(result.stats.SQLite)).toMatch(/^3\./);
    db.close();
  });

  it('previews a bounded number of rows and exports every row as CSV', async () => {
    const { db, bytes } = await createSampleDatabase();
    const result = runWithDb(db, {
      files: [databaseFile(bytes)],
      options: {
        action: 'query',
        query: 'SELECT id, name, email FROM users ORDER BY id;',
        maxRows: 2,
        export: 'csv',
      },
    });
    const preview = parseTable(result);

    expect(preview.headers).toEqual(['id', 'name', 'email']);
    expect(preview.rows).toEqual([
      ['1', 'Ada Lovelace', 'ada@example.com'],
      ['2', 'Grace Hopper', 'grace@example.com'],
    ]);
    expect(result.notes[0]).toMatch(/first 2 of 3 rows/);
    expect(result.stats.Rows).toBe('3');
    expect(result.exportText?.format).toBe('csv');
    expect(result.exportText?.contents).toBe(
      'id,name,email\r\n' +
        '1,Ada Lovelace,ada@example.com\r\n' +
        '2,Grace Hopper,grace@example.com\r\n' +
        '3,"Comma, ""Quote""",\r\n',
    );
    db.close();
  });

  it('exports a BLOB as base64 and keeps NULL as null in JSON', async () => {
    const { db, bytes } = await createSampleDatabase();
    const result = runWithDb(db, {
      files: [databaseFile(bytes)],
      options: {
        action: 'query',
        query: 'SELECT body, tag FROM notes ORDER BY id;',
        export: 'json',
      },
    });

    expect(result.exportText?.format).toBe('json');
    expect(JSON.parse(result.exportText!.contents)).toEqual([
      { body: 'aGk=', tag: 'two-line\nnote' },
      { body: null, tag: null },
    ]);
    expect(parseTable(result).rows).toEqual([
      ['BLOB (2 bytes)', 'two-line\nnote'],
      ['NULL', 'NULL'],
    ]);
    db.close();
  });

  it('dumps the whole schema, or one table with its own indexes', async () => {
    const { db, bytes } = await createSampleDatabase();
    const files = [databaseFile(bytes)];

    const all = runWithDb(db, { files, options: { action: 'schema' } });
    expect(all.report.render).toBe('code');
    expect(all.report.language).toBe('sql');
    expect(all.report.output).toContain('CREATE TABLE users');
    expect(all.report.output).toContain('CREATE VIEW contacts');
    expect(all.report.output).toContain('CREATE INDEX users_name');

    const one = runWithDb(db, { files, options: { action: 'schema', table: 'users' } });
    expect(one.report.output).toContain('CREATE TABLE users');
    expect(one.report.output).toContain('CREATE INDEX users_name');
    expect(one.report.output).not.toContain('CREATE VIEW contacts');

    const missing = runWithDb(db, { files, options: { action: 'schema', table: 'nope' } });
    expect(missing.warnings[0]).toMatch(/No table or view named "nope"/);
    db.close();
  });

  it('falls back to the table list when no statement is given', async () => {
    const { db, bytes } = await createSampleDatabase();
    const result = runWithDb(db, {
      files: [databaseFile(bytes)],
      options: { action: 'query', query: '' },
    });
    expect(result.notes[0]).toMatch(/No statement was given/);
    expect(parseTable(result).headers).toEqual(['Table', 'Type', 'Columns', 'Rows']);
    db.close();
  });

  it('still refuses a write when the caller hands over an open database', async () => {
    const { db, bytes } = await createSampleDatabase();
    expect(() =>
      runWithDb(db, {
        files: [databaseFile(bytes)],
        options: { action: 'query', query: 'DELETE FROM users;' },
      }),
    ).toThrow(/"DELETE" cannot run here/);
    db.close();
  });

  it('surfaces SQLite errors for a statement that cannot run', async () => {
    const { db, bytes } = await createSampleDatabase();
    expect(() =>
      runWithDb(db, {
        files: [databaseFile(bytes)],
        options: { action: 'query', query: 'SELECT * FROM missing_table;' },
      }),
    ).toThrow(/no such table: missing_table/);
    db.close();
  });
});

describe('sqlite-viewer result shape', () => {
  const base: ViewerResult = {
    report: { output: '{"headers":[],"rows":[]}', render: 'table' },
    notes: [],
    warnings: [],
    stats: {},
  };

  it('names an export after the database', async () => {
    const result = toFileResult(
      { ...base, exportText: { contents: 'a,b\r\n', format: 'csv' } },
      'shop.sqlite3',
    );
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]?.filename).toBe('shop.csv');
    expect(result.outputs[0]?.blob.type).toBe('text/csv;charset=utf-8');
    expect(await result.outputs[0]?.blob.text()).toBe('a,b\r\n');
  });

  it('marks a JSON export as JSON and emits no file when nothing was asked for', async () => {
    const json = toFileResult(
      { ...base, exportText: { contents: '[]', format: 'json' } },
      'shop.db',
    );
    expect(json.outputs[0]?.filename).toBe('shop.json');
    expect(json.outputs[0]?.blob.type).toBe('application/json');

    expect(toFileResult(base, 'shop.db').outputs).toEqual([]);
  });
});
