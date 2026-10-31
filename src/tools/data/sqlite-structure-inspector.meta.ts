import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'sqlite-structure-inspector',
  name: 'SQLite Structure Inspector',
  category: 'data',
  summary:
    'Audit the physical layout of a .db/.sqlite file: header fields, page types, b-tree usage, freelist and integrity.',
  description:
    'Drop in a SQLite database file and inspect its on-disk structure without running a server. The tool reads the 100-byte SQLite file header and reports the format version, page size, database size in pages, freelist page count, schema cookie and format number, text encoding, user version and application id. It then walks every page and classifies its b-tree page type: leaf or interior table, leaf or interior index, or unused page, and reports per-page types plus totals for each class. It checks structural integrity and flags the common problems: a missing SQLite magic number, a page size that is not a power of two or exceeds 65536 bytes, a header that declares more pages than the file actually contains, a nonzero freelist count with no matching pages, an illegal b-tree page type byte, a nonzero reserved-space value, an unknown schema format, and a truncated file. Everything runs entirely on-device.',
  keywords: [
    'sqlite',
    'database',
    'db',
    'header',
    'page',
    'b-tree',
    'btree',
    'freelist',
    'schema',
    'integrity',
    'inspect',
    'audit',
    'structure',
    'format',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.db,.sqlite,.sqlite3,.db3,application/vnd.sqlite3',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'pages', label: 'Page inventory' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [
    { title: 'Audit a SQLite database file', options: {} },
    { title: 'Check a .db file for corruption' },
  ],
  related: ['sqlite-viewer', 'csv-to-sql', 'file-signature', 'file-metadata'],
  status: 'stable',
};
