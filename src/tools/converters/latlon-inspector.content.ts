/**
 * Editorial content for the latlon-inspector tool page.
 *
 * Kept out of ``latlon-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What coordinate forms does the inspector accept?',
      a: 'It accepts decimal degrees such as 40.7128,-74.0060 and degrees-minutes-seconds forms such as 40 42 51.7 N, 74 0 21.5 W, normalising both to a decimal pair.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the parsed decimal latitude and longitude, checks that the latitude stays within +-90 and the longitude within +-180, and flags a pair where the values are out of range or the hemispheres disagree with the sign.',
    },
    {
      q: 'Is the location sent anywhere?',
      a: 'No. The parsing and validation happen in your browser, so a private or in-progress coordinate is never shared, and the tool works offline.',
    },
  ],
} as const;
