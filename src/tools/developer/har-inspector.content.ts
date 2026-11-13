/**
 * Editorial content for the har-inspector tool page.
 *
 * Kept out of ``har-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is a HAR file?',
      a: 'An HTTP Archive (HAR) is the JSON a browser DevTools Network panel exports: it holds the log version, the creator, and every request and response an open tab made, with headers, timings and body sizes.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the log version and creator, the entry count, the request methods and status classes, the total page timechers, and flags a malformed archive, a missing version, an entry without a URL or status, and every failed request.',
    },
    {
      q: 'Are request bodies uploaded?',
      a: 'No. The JSON is parsed entirely in the browser, so request headers, query strings and any bodies captured in the archive stay on your machine.',
    },
  ],
} as const;
