import { describe, expect, it, vi } from 'vitest';
import { browseSql, optionValuesFor } from './sqlite-viewer-panel';
import {
  READ_ONLY_HINT,
  classifyStatement,
  collectViewerResult,
  displayCell,
  refusalMessage,
  schemaText,
  summaryStats,
  toCsv,
  toJson,
} from '@/tools/developer/sqlite-viewer.core';
import { createSampleDatabase } from '../../../test/sqlite-fixtures';

// The panel's pure half never talks to a worker; mocking it keeps the registry
// (and its glob of every tool) out of this test.
vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

/* -------------------------------------------------------------------------- */
/*  The read-only classifier                                                   */
/* -------------------------------------------------------------------------- */

describe('classifyStatement: reads', () => {
  it('allows the statements the viewer exists for', () => {
    for (const sql of [
      'SELECT * FROM users;',
      'select 1',
      '  SELECT id FROM users WHERE name = "SELECT"',
      'WITH recent AS (SELECT 1 AS n) SELECT n FROM recent;',
      'VALUES (1), (2);',
      'EXPLAIN QUERY PLAN SELECT * FROM users;',
      'PRAGMA table_info(users);',
      'PRAGMA index_list("users");',
    ]) {
      expect(classifyStatement(sql).kind, sql).toBe('read');
    }
  });

  it('keeps a quoted or commented keyword out of the way', () => {
    // The word inside a string literal is data, not a statement.
    expect(classifyStatement("SELECT 'drop table users' AS s").kind).toBe('read');
    expect(classifyStatement('-- DELETE FROM users\nSELECT 1;').kind).toBe('read');
    expect(classifyStatement('/* UPDATE users SET name = 1 */ SELECT 1;').kind).toBe('read');
  });

  it('sees through whitespace and comments when finding the verb', () => {
    const classified = classifyStatement('  \n\t-- explain first\n/* then */  select 2 ;');
    expect(classified.kind).toBe('read');
    if (classified.kind === 'read') expect(classified.verb).toBe('SELECT');
  });

  it('reports blank input, and input that is only a comment, as empty', () => {
    expect(classifyStatement('   \n\t ').kind).toBe('empty');
    expect(classifyStatement('-- nothing to run\n').kind).toBe('empty');
    expect(classifyStatement('/* nothing */').kind).toBe('empty');
  });

  it('maps .tables and .schema onto the viewer’s own views', () => {
    expect(classifyStatement('.tables')).toEqual({ kind: 'meta', command: 'tables', table: '' });
    expect(classifyStatement('.schema')).toEqual({ kind: 'meta', command: 'schema', table: '' });
    expect(classifyStatement('.schema "my table"')).toEqual({
      kind: 'meta',
      command: 'schema',
      table: 'my table',
    });
    expect(classifyStatement('.dump')).toEqual({ kind: 'unsupported', token: '.dump' });
  });
});

describe('classifyStatement: refusals', () => {
  const writes: [string, string][] = [
    ['INSERT INTO users (name) VALUES ("x");', 'INSERT'],
    ['  update users set name = 1;', 'UPDATE'],
    ['DELETE FROM users WHERE id = 1;', 'DELETE'],
    ['REPLACE INTO users VALUES (1);', 'REPLACE'],
    ['DROP TABLE users;', 'DROP'],
    ['CREATE TABLE t (a);', 'CREATE'],
    ['ALTER TABLE users ADD COLUMN x TEXT;', 'ALTER'],
    ["ATTACH DATABASE 'other.db' AS other;", 'ATTACH'],
    ['DETACH DATABASE other;', 'DETACH'],
    ['VACUUM;', 'VACUUM'],
    ['BEGIN TRANSACTION;', 'BEGIN'],
    ['PRAGMA journal_mode = WAL;', 'PRAGMA journal_mode'],
    ['PRAGMA optimize;', 'PRAGMA optimize'],
  ];

  it('refuses every writing statement, with its verb', () => {
    for (const [sql, verb] of writes) {
      const classified = classifyStatement(sql);
      expect(classified.kind, sql).toBe('forbidden');
      expect(classified.kind === 'forbidden' ? classified.verb : '', sql).toBe(verb);
    }
  });

  it('refuses a write hidden inside a read', () => {
    const classified = classifyStatement(
      'WITH x AS (SELECT 1) INSERT INTO users (id) SELECT 1 FROM x;',
    );
    expect(classified.kind).toBe('forbidden');
    expect(classified.kind === 'forbidden' ? classified.verb : '').toBe('INSERT');
  });

  it('runs one statement at a time', () => {
    const classified = classifyStatement('SELECT 1; DROP TABLE users;');
    expect(classified).toEqual({ kind: 'multiple', count: 2 });
  });

  it('words a refusal once, for the panel and the worker alike', () => {
    expect(refusalMessage(classifyStatement('INSERT INTO t VALUES (1);'))).toBe(
      '"INSERT" cannot run here because it changes the database.',
    );
    expect(refusalMessage(classifyStatement('SELECT 1; SELECT 2;'))).toBe(
      'Run one statement at a time: 2 were given.',
    );
    expect(refusalMessage(classifyStatement('SELECT 1;'))).toBeNull();
    expect(READ_ONLY_HINT).toContain('SELECT');
  });
});

/* -------------------------------------------------------------------------- */
/*  Serialisation                                                              */
/* -------------------------------------------------------------------------- */

describe('CSV and JSON serialisation', () => {
  it('quotes only the fields that need it', () => {
    expect(
      toCsv(
        ['name', 'note'],
        [
          ['plain', 'also plain'],
          ['comma, here', 'quote " here'],
          ['line\nbreak', 'tab\tis fine'],
          [' padded ', ''],
          ['', 'trailing  '],
        ],
      ),
    ).toBe(
      'name,note\r\n' +
        'plain,also plain\r\n' +
        '"comma, here","quote "" here"\r\n' +
        '"line\nbreak",tab\tis fine\r\n' +
        '" padded ",\r\n' +
        ',"trailing  "\r\n',
    );
  });

  it('writes NULL as an empty field and a BLOB as base64', () => {
    const csv = toCsv(['v'], [[null], [0], [new Uint8Array([104, 105])]]);
    expect(csv).toBe('v\r\n\r\n0\r\naGk=\r\n');
  });

  it('keys JSON rows by column, keeping NULL and BLOBs lossless', () => {
    expect(
      JSON.parse(
        toJson(
          ['id', 'name'],
          [
            [1, 'Ada'],
            [2, null],
          ],
        ),
      ),
    ).toEqual([
      { id: 1, name: 'Ada' },
      { id: 2, name: null },
    ]);
    expect(JSON.parse(toJson(['blob'], [[new Uint8Array([104, 105])]]))).toEqual([
      { blob: 'aGk=' },
    ]);
  });

  it('falls back to columns+rows when two columns share a name', () => {
    const json = toJson(['n', 'n'], [[1, 2]]);
    expect(JSON.parse(json)).toEqual({ columns: ['n', 'n'], rows: [[1, 2]] });
  });

  it('describes a value for the preview table', () => {
    expect(displayCell(null)).toBe('NULL');
    expect(displayCell(42)).toBe('42');
    expect(displayCell('text')).toBe('text');
    expect(displayCell(new Uint8Array([1, 2, 3]))).toBe('BLOB (3 bytes)');
  });
});

describe('schema text and the file summary', () => {
  it('joins CREATE statements into one script', () => {
    expect(
      schemaText([
        { sql: 'CREATE TABLE a (x)' },
        { sql: '   ' },
        { sql: 'CREATE INDEX b ON a (x);;;' },
        { sql: null },
      ]),
    ).toBe('CREATE TABLE a (x);\n\nCREATE INDEX b ON a (x);');
  });

  it('summarises the file, its tables and its rows', () => {
    expect(
      summaryStats({
        fileName: 'shop.db',
        fileSize: 2048,
        tableCount: 3,
        sqliteVersion: '3.45.0',
        rowCount: 1500,
      }),
    ).toEqual({ File: 'shop.db', Size: '2 KB', Tables: '3', SQLite: '3.45.0', Rows: '1,500' });
    expect(
      summaryStats({ fileName: 'x.db', fileSize: 0, tableCount: 0, sqliteVersion: '3.45.0' }),
    ).toEqual({ File: 'x.db', Size: '0 B', Tables: '0', SQLite: '3.45.0' });
  });
});

/* -------------------------------------------------------------------------- */
/*  The panel's side of the contract                                           */
/* -------------------------------------------------------------------------- */

describe('panel helpers', () => {
  it('builds a bounded browse query and escapes the table name', () => {
    expect(browseSql('users', 500)).toBe('SELECT * FROM "users" LIMIT 500;');
    // A name with a quote cannot break out of the identifier.
    expect(browseSql('we"ird', 10)).toBe('SELECT * FROM "we""ird" LIMIT 10;');
    expect(browseSql('users', 0)).toBe('SELECT * FROM "users" LIMIT 1;');
    expect(browseSql('users', 12.7)).toBe('SELECT * FROM "users" LIMIT 12;');
  });

  it('sends the tool every option it reads', () => {
    expect(optionValuesFor({ action: 'query' })).toEqual({
      action: 'query',
      query: '',
      table: '',
      export: 'none',
      maxRows: 500,
    });
    expect(
      optionValuesFor({ action: 'schema', table: 'users', exportFormat: 'csv', maxRows: 50 }),
    ).toEqual({ action: 'schema', query: '', table: 'users', export: 'csv', maxRows: 50 });
  });
});

/* -------------------------------------------------------------------------- */
/*  A real database                                                            */
/* -------------------------------------------------------------------------- */

describe('against a real sql.js database', () => {
  it('opens an in-memory database created in the test', async () => {
    const { db, bytes } = await createSampleDatabase();

    // Proof that the real engine ran: SQLite itself reports the schema.
    const [tables] = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;");
    expect(tables?.values.map((row) => row[0])).toEqual(['notes', 'users']);
    expect(bytes.length).toBeGreaterThan(0);

    db.close();
  });

  it('browses the table list with counts, then queries the rows', async () => {
    const { db, bytes } = await createSampleDatabase();
    const context = { fileName: 'sample.db', fileSize: bytes.length };
    const base = { sql: '', table: '', exportFormat: 'none', maxRows: 500 } as const;

    const browse = collectViewerResult(db, { ...base, action: 'browse' }, context);
    const list = JSON.parse(browse.report.output) as { headers: string[]; rows: string[][] };
    expect(list.headers).toEqual(['Table', 'Type', 'Columns', 'Rows']);
    expect(list.rows.map((row) => row[0])).toEqual(['contacts', 'notes', 'users']);
    expect(browse.stats).toMatchObject({ Tables: '3', Rows: '8' });

    const query = collectViewerResult(
      db,
      { ...base, action: 'query', sql: 'SELECT name, email FROM users ORDER BY name;' },
      context,
    );
    const rows = JSON.parse(query.report.output) as { headers: string[]; rows: string[][] };
    expect(rows.headers).toEqual(['name', 'email']);
    expect(rows.rows).toEqual([
      ['Ada Lovelace', 'ada@example.com'],
      ['Comma, "Quote"', 'NULL'],
      ['Grace Hopper', 'grace@example.com'],
    ]);

    db.close();
  });

  it('exports what the engine returned, escaped for CSV', async () => {
    const { db, bytes } = await createSampleDatabase();
    const result = collectViewerResult(
      db,
      {
        action: 'query',
        sql: 'SELECT name, email FROM users ORDER BY name;',
        table: '',
        exportFormat: 'csv',
        maxRows: 500,
      },
      { fileName: 'sample.db', fileSize: bytes.length },
    );

    expect(result.exportText?.format).toBe('csv');
    expect(result.exportText?.contents).toBe(
      'name,email\r\n' +
        'Ada Lovelace,ada@example.com\r\n' +
        '"Comma, ""Quote""",\r\n' +
        'Grace Hopper,grace@example.com\r\n',
    );
    expect(result.stats.Rows).toBe('3');

    db.close();
  });

  it('dumps the schema of the real database', async () => {
    const { db, bytes } = await createSampleDatabase();
    const result = collectViewerResult(
      db,
      { action: 'schema', sql: '', table: 'users', exportFormat: 'none', maxRows: 500 },
      { fileName: 'sample.db', fileSize: bytes.length },
    );

    expect(result.report.render).toBe('code');
    expect(result.report.output).toContain('CREATE TABLE users');
    expect(result.report.output).toContain('CREATE INDEX users_name');

    db.close();
  });

  it('refuses a write even when it is handed the open database', async () => {
    const { db, bytes } = await createSampleDatabase();
    expect(() =>
      collectViewerResult(
        db,
        {
          action: 'query',
          sql: 'DELETE FROM users;',
          table: '',
          exportFormat: 'none',
          maxRows: 500,
        },
        { fileName: 'sample.db', fileSize: bytes.length },
      ),
    ).toThrow(/"DELETE" cannot run here/);
    // The rows are still there: the statement never reached the engine.
    const [count] = db.exec('SELECT count(*) FROM users;');
    expect(count?.values[0]?.[0]).toBe(3);

    db.close();
  });
});
