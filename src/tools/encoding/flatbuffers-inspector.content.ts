/**
 * Editorial content for the flatbuffers-inspector tool page.
 *
 * Kept out of ``flatbuffers-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is a FlatBuffers message?',
      a: 'FlatBuffers is a zero-copy serialization format. A message begins with a 4-byte offset to the root table, then the table itself and its referenced vectors and strings, laid out so fields can be read without parsing.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reads the file identifier and the root-table offset, walks the known table fields it can locate, and flags an offset that falls outside the buffer or a file identifier that does not match the expected schema.',
    },
    {
      q: 'Does the inspector need the schema?',
      a: 'The tool inspects the binary layout generically and reports the structure it can read from the buffer itself; a shared schema file is not required and is never uploaded.',
    },
  ],
} as const;
