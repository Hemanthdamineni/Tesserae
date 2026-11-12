/**
 * Editorial content for the csv-dedupe tool page.
 *
 * Kept out of ``csv-dedupe.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'How are duplicate rows detected?',
      a: 'The tool compares whole rows after trimming, so two rows that differ in a single cell are not treated as duplicates. You can pick a key column so rows are considered duplicates when that column matches, ignoring the rest.',
    },
    {
      q: 'Which row is kept when a duplicate is found?',
      a: 'The first occurrence in the file is kept by default so your header row and the original ordering are preserved. Choose the keep-last option to reverse that when the newest value is the one you want.',
    },
    {
      q: 'Does it change my file formatting?',
      a: 'Only the de-duplicated rows change. Delimiters, quoting and the header row are left as they were in the input, so the output still opens cleanly in a spreadsheet.',
    },
  ],
} as const;
