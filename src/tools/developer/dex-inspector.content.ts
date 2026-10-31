/**
 * Editorial content for the dex-inspector tool page.
 *
 * Kept out of `dex-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it reads',
      body: 'Drop an Android app executable (a classes.dex file) onto the inspector and it shows how the Dalvik bytecode is laid out. It validates the eight-byte "dex" magic and version tag, verifies the Adler-32 checksum and the SHA-1 signature over the file, reports the file and header sizes and the endian tag, and reads every one of the header table counters.',
    },
    {
      heading: 'String and type tables',
      body: 'The tool decodes the string ID table into the actual MUTF-8 strings the bytecode references, resolves the type ID table through the string descriptors (Lclass; and primitive names), and reports the proto, field, method and class definition counts. It also handles the MUTF-8 encoding itself, including the 0xC0 0x80 NUL form, so the strings you see match exactly what the Dalvik runtime reads.',
    },
    {
      heading: 'Integrity checks first',
      body: 'Before showing any tables, the inspector verifies the file is what it claims to be. It checks the Adler-32 checksum and the SHA-1 signature against the bytes on disk, so a corrupted or hand-edited classes.dex is caught up front rather than misread downstream. The summary view reports each check with an OK or MISMATCH marker.',
    },
    {
      heading: 'On-device parsing',
      body: 'Everything is decoded in this tab; nothing is uploaded and the tool runs fully offline. Files up to 256 MB are accepted, and the string and type views cap their listings so even a large app stays readable.',
    },
  ],
  faq: [
    {
      q: 'Is my classes.dex file uploaded anywhere?',
      a: 'No. The inspector parses the DEX file entirely on-device in your browser, runs fully offline, and transmits nothing. Files up to 256 MB are accepted.',
    },
    {
      q: 'What does the checksum and signature check tell me?',
      a: 'The tool verifies the Adler-32 checksum and the SHA-1 signature stored in the header against the rest of the file, reporting OK or MISMATCH for each. A mismatch means the file was corrupted or edited after it was compiled.',
    },
    {
      q: 'What is MUTF-8 and why does it matter?',
      a: 'MUTF-8 is the modified UTF-8 variant Dalvik bytecode uses for its strings. The inspector decodes it, including the 0xC0 0x80 NUL form, so the string and type tables display the exact text the bytecode references.',
    },
    {
      q: 'What structural problems does it flag?',
      a: 'It flags a bad magic or version, a checksum or signature mismatch, a header size that is not 0x70, an unknown endian tag, and a table that overruns the declared file size.',
    },
  ],
} as const;
