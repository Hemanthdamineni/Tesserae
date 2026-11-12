/**
 * Editorial content for the asar-inspector tool page.
 *
 * Kept out of ``asar-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is an ASAR file?',
      a: 'Electron packages an app as an ASAR archive: a header that holds a directory table of files and offsets, followed by the concatenated file contents. It is what ships inside an app.asar or a resources directory.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reads the archive header and reports the file count, the total unpacked size, and the top-level entries, and flags a header that is truncated or claims a size larger than the file.',
    },
    {
      q: 'Is the archive unpacked on my device?',
      a: 'The inspector reads only the header and index, without writing the contained files to disk, so an app package is never extracted onto your machine.',
    },
  ],
} as const;
