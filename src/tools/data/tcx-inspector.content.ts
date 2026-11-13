/**
 * Editorial content for the tcx-inspector tool page.
 *
 * Kept out of ``tcx-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is a TCX file?',
      a: 'Training Center XML is the Garmin activity format that wraps a workout: the sport, the start time, and a series of Trackpoints each carrying time, position, distance, altitude and often heart rate.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the activity count, the number of trackpoints, the total distance and duration, and flags trackpoints with a missing time, an invalid latitude or longitude, or a duplicate timestamp.',
    },
    {
      q: 'Can I inspect a file exported from another brand?',
      a: 'Any .tcx that follows the Training Center XML schema is accepted, regardless of which app produced it, and is parsed entirely on-device.',
    },
  ],
} as const;
