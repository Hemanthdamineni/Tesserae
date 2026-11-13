/**
 * Editorial content for the srt-inspector tool page.
 *
 * Kept out of ``srt-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is an SRT file?',
      a: 'SubRip (SRT) is a subtitle format of numbered cue blocks, each with a time range in the form HH:MM:SS,mmm --> HH:MM:SS,mmm followed by one or more lines of subtitle text.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the cue count, flags a cue with a non-incremental index, a missing or malformed time range, or a time range where the end comes before the start, and a cue with no text after the time line.',
    },
    {
      q: 'Are the subtitles uploaded?',
      a: 'No. The file is parsed in your browser only, so an in-progress or unreleased subtitle file never leaves your machine and the tool works offline.',
    },
  ],
} as const;
