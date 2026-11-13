/**
 * Editorial content for the m3u-playlist-inspector tool page.
 *
 * Kept out of ``m3u-playlist-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is an M3U playlist?',
      a: 'It is a plain-text playlist that lists media file paths or URLs, one per line. Extended M3U adds #EXTINF metadata lines with the track duration and title before each entry.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the number of entries, separates extended metadata from plain entries, and flags an #EXTINF line that is missing its following media line or has a malformed duration.',
    },
    {
      q: 'Do I need an internet connection?',
      a: 'No. The playlist is parsed locally, and the entries are reported without being fetched, so a list with private or local file paths never leaves your device.',
    },
  ],
} as const;
