/**
 * Editorial content for the vtt-inspector tool page.
 *
 * Kept out of `vtt-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What a WebVTT file contains',
      body: 'WebVTT is the caption format used by HTML5 video. The file begins with a WEBVTT signature line, optionally followed by metadata header lines and blank-line-separated cues. Each cue has an optional identifier, a timing line of the form start --> end with optional positioning settings, and one or more text lines. The inspector checks the signature and byte-order mark, reads the header metadata, and parses every cue into a table of timings and text.',
    },
    {
      heading: 'Timings and totals',
      body: 'Timestamps are parsed as hours, minutes, seconds and milliseconds, so the inspector can compute the total runtime from the last cue end and show how many cues carry an identifier or positioning settings. The summary view gives those totals in one table. WebVTT also allows a short MM:SS.mmm form when the hour is zero, and the parser accepts it rather than rejecting a file that players accept.',
    },
    {
      heading: 'The issues a player would hit',
      body: 'The inspector flags cues with a missing or malformed timing line, timestamps that cannot be parsed, cues that start before the previous cue so the order is broken, cues whose times overlap the previous cue, and cues with no text at all. A timestamp that runs past the file duration is only meaningful in the context of the video, so the checks focus on the subtitle document itself: order, overlap and structure.',
    },
    {
      heading: 'Why validate before publishing',
      body: 'Browsers are forgiving in inconsistent ways, which is exactly why a caption file can look fine in one player and break in another. Checking order and overlap up front catches the mistakes that turn into missing or stuck captions on a smart TV. The tool works on pasted text up to 2 MB, never uploads the document, and the issues view can be copied straight into a bug report.',
    },
  ],
  faq: [
    {
      q: 'Does it convert VTT to SRT or the other way round?',
      a: 'No. This tool validates and analyses an existing WebVTT document. Conversion is a separate job for a subtitle converter, which changes the timing syntax as well as the wrapper.',
    },
    {
      q: 'Why are overlapping cues flagged?',
      a: 'WebVTT permits overlapping cues in principle, but players and caption authors rarely intend them, and overlaps are a common cause of text that flickers or disappears. The inspector reports them so you can decide whether they are deliberate.',
    },
    {
      q: 'Can it check a file that is still being edited?',
      a: 'Yes. Paste the current text and re-inspect after each change. The parse is local and fast, so it works as a quick lint step while you write captions.',
    },
    {
      q: 'Is the subtitle text uploaded anywhere?',
      a: 'No. The document is parsed in the tab, and nothing is sent over the network. That matters when captions contain names or unpublished dialogue.',
    },
  ],
} as const;
