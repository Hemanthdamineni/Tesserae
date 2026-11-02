/**
 * A real sql.js database for the SQLite viewer's tests.
 *
 * sql.js's shipped browser build resolves its `.wasm` through `fetch`, which a
 * jsdom test has no server for. The engine's supported escape hatch is
 * `wasmBinary`: hand it the bytes and it never fetches anything. The binary
 * read here is the same `sql-wasm-browser.wasm` the browser build requests from
 * this origin, so the tests drive the real SQLite, not a stand-in.
 *
 * Kept in `test/` because it is a test-only loader: nothing under `src/` reads
 * the filesystem.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { SqlJsDatabase, SqlJsInitOptions, SqlJsModule } from 'sql.js/dist/sql-wasm-browser.js';

const require = createRequire(import.meta.url);

/**
 * The package's browser entry is CommonJS (`module.exports = initSqlJs`) and
 * ships no types, so `require` hands back an untyped value. The cast names the
 * one shape `sqlite-viewer.d.ts` declares.
 */
const sqlJsFactory = require('sql.js/dist/sql-wasm-browser.js') as (
  options?: SqlJsInitOptions,
) => Promise<SqlJsModule>;

const wasmPath = join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm-browser.wasm');

let modulePromise: Promise<SqlJsModule> | null = null;

/** The real sql.js module, loaded with the wasm passed in as a buffer. */
export function loadSqlJsForTests(): Promise<SqlJsModule> {
  modulePromise ??= sqlJsFactory({ wasmBinary: readFileSync(wasmPath) });
  return modulePromise;
}

/** Two tables, a view, an index, and values that stress CSV and JSON escaping. */
const SAMPLE_SQL = [
  'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT, joined TEXT);',
  'CREATE TABLE notes (id INTEGER PRIMARY KEY, body BLOB, tag TEXT);',
  'CREATE INDEX users_name ON users (name);',
  'CREATE VIEW contacts AS SELECT id, name, email FROM users;',
  `INSERT INTO users (name, email, joined) VALUES
     ('Ada Lovelace', 'ada@example.com', '1843-07-01'),
     ('Grace Hopper', 'grace@example.com', '1952-01-01'),
     ('Comma, "Quote"', NULL, '2001-01-01');`,
  "INSERT INTO notes (body, tag) VALUES (x'6869', 'two-line\nnote'), (NULL, NULL);",
].join('\n');

export interface SampleDatabase {
  db: SqlJsDatabase;
  /** The database file's bytes, exactly as `File` would hand them to a tool. */
  bytes: Uint8Array;
}

/** Open the sample database in memory and export it as a file. */
export async function createSampleDatabase(): Promise<SampleDatabase> {
  const SQL = await loadSqlJsForTests();
  const db = new SQL.Database();
  db.run(SAMPLE_SQL);
  return { db, bytes: db.export() };
}

/** A `File` carrying a database's bytes, the way the workbench passes one in. */
export function databaseFile(bytes: Uint8Array, name = 'sample.db'): File {
  // `BlobPart` wants an `ArrayBuffer`-backed view; sql.js hands back a plain
  // `Uint8Array`, which `File` copies byte for byte either way.
  const part = bytes as unknown as BlobPart;
  return new File([part], name, { type: 'application/vnd.sqlite3' });
}
