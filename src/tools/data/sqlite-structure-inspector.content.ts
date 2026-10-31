/**
 * Editorial content for the sqlite-structure-inspector tool page.
 *
 * Kept out of `sqlite-structure-inspector.meta.ts` so the eager client registry
 * never ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it reads',
      body: 'Drop in a SQLite database file and the tool inspects its on-disk structure without running a server. It reads the 100-byte SQLite file header and reports the format version, page size, database size in pages, freelist page count, schema cookie and format number, text encoding, user version and application id. It then walks every page and classifies its b-tree page type: leaf or interior table, leaf or interior index, or unused page, and reports per-page types plus totals for each class.',
    },
    {
      heading: 'The findings that matter',
      body: 'The audit checks structural integrity and flags the common problems: a missing SQLite magic number, a page size that is not a power of two or exceeds 65536 bytes, a header that declares more pages than the file actually contains, a nonzero freelist count with no matching pages, an illegal b-tree page type byte, a nonzero reserved-space value, an unknown schema format, and a truncated file. Each is the kind of anomaly that can corrupt reads or explain why a database will not open cleanly.',
    },
    {
      heading: 'How the header maps to layout',
      body: 'The first 100 bytes encode how the rest of the file is organised: the page size fixes the unit that every b-tree walk divides the file into, the database-size-in-pages says how many such pages should exist, and the freelist count tells how many are free for reuse. Cross-checking those numbers against the actual pages is exactly what the page inventory and findings views do.',
    },
    {
      heading: 'Privacy and limits',
      body: 'Everything runs entirely on-device — the file bytes are parsed in this tab and nothing is transmitted, so the tool works fully offline. It is read-only: it never writes to or modifies the database you drop in.',
    },
  ],
  faq: [
    {
      q: 'Is the database file uploaded anywhere?',
      a: 'No. The file is parsed entirely on-device, the tool makes no network requests, and it works fully offline. It is also read-only, so it never alters the file.',
    },
    {
      q: 'Which files can it open?',
      a: 'SQLite databases with the .db, .sqlite, .sqlite3 or .db3 extension (and the application/vnd.sqlite3 MIME type) are accepted. The tool reads the on-disk structure rather than running SQL, so no server is involved.',
    },
    {
      q: 'What is the SQLite magic number?',
      a: 'Every SQLite database file starts with the 16-byte ASCII string "SQLite format 3\\000". A missing magic number is one of the first integrity problems the tool flags, since it means the file is either not a SQLite database or its header has been damaged.',
    },
    {
      q: 'What do the page-type classes mean?',
      a: 'Each page is classified as a leaf or interior table page, a leaf or interior index page, or an unused page. The inventory view lists them per page and the summary reports totals per class, so you can see how the b-tree is structured and whether any pages sit outside an expected layout.',
    },
  ],
} as const;
