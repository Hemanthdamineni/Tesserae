/**
 * Editorial content for the bson-decoder tool page.
 *
 * Kept out of `bson-decoder.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What BSON is',
      body: 'BSON is the binary document format MongoDB uses on the wire and on disk. A document starts with a little-endian byte length, then repeats a type byte, a null-terminated element name and a value, and closes with a zero byte. The decoder reads that layout directly, so a .bson dump or a copied hex or base64 payload becomes a readable JSON document without a database or a driver.',
    },
    {
      heading: 'The types it understands',
      body: 'The decoder covers the full common type set: doubles, strings, embedded documents and arrays, binary data with its subtype, ObjectIds, booleans, UTC datetimes, nulls, regular expressions, JavaScript code and code-with-scope, int32, timestamps, int64, decimal128, and the min and max key sentinels. Documents and arrays are decoded recursively with a depth cap, and ObjectIds and datetimes are printed in readable hexadecimal and ISO forms.',
    },
    {
      heading: 'A type breakdown alongside the JSON',
      body: 'The second view counts the elements by type. That is useful when a document looks wrong: a count of zero int64 values tells you a field was written as an int32, and a missing binary entry explains why an attachment is absent. Because BSON is length-prefixed throughout, the decoder can validate each element and continue instead of failing at the first odd byte.',
    },
    {
      heading: 'Warnings worth reading',
      body: 'The decoder flags a document length that does not match its bytes, a truncated value, an element name that is not null-terminated, an unsupported type byte and trailing bytes after the top-level document. Those warnings usually distinguish a genuinely corrupt export from a file that was decoded with the wrong byte order. Input is capped at 16 MB, with depth and element limits to keep a hostile file from hanging the tab.',
    },
  ],
  faq: [
    {
      q: 'Can I paste a BSON dump instead of uploading a file?',
      a: 'Yes. The tool accepts a file or pasted text in hexadecimal or base64, and detects which encoding you used. Base64 output from mongodump and hex copied from a debugger both work.',
    },
    {
      q: 'Does it need a MongoDB connection?',
      a: 'No. The decode is entirely local. There is no server, no driver and no network request; the bytes you supply are the only input.',
    },
    {
      q: 'How are ObjectIds and dates shown?',
      a: 'ObjectIds are printed as 24-character hex strings and datetimes as ISO 8601 timestamps, which is easier to compare than the raw 12-byte and 8-byte values stored in the document.',
    },
    {
      q: 'What is the largest document it will decode?',
      a: '16 MB, which matches the BSON document limit MongoDB itself enforces. Very deeply nested documents are stopped by a recursion cap rather than crashing the page.',
    },
  ],
} as const;
