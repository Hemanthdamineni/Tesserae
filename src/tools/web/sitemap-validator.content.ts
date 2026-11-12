/**
 * Editorial content for the sitemap-validator tool page.
 *
 * Kept out of ``sitemap-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does the validator check in a sitemap?',
      a: 'It checks that the XML is well-formed, that the document is a valid urlset, and that every url element has a loc child with a real URL. It reports the entry count and flags entries without a loc or with an invalid URL.',
    },
    {
      q: 'Which sitemap features are supported?',
      a: 'The validator reads the core urlset structure and the common optional children lastmod, changefreq and priority, and reports the counts of each so a sitemap can be reviewed at a glance.',
    },
    {
      q: 'Is the sitemap crawled or fetched?',
      a: 'No. Only the pasted XML is parsed, on your device. The URLs inside are not fetched, so a sitemap for a private or in-progress site can be checked without any external request.',
    },
  ],
} as const;
