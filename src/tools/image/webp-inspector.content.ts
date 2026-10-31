/**
 * Editorial content for the webp-inspector tool page.
 *
 * Kept out of ``webp-inspector.meta.ts`` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a WebP image (.webp) and the tool verifies the RIFF header and WEBP form, then walks every chunk in file order, reporting its fourcc tag, byte offset, and size. It decodes the VP8X extended-feature header into the canvas dimensions and the feature flags — alpha, animation, ICC profile, EXIF, and XMP — plus the ANIM chunk into background color and loop count. Everything runs on-device with no upload.',
    },
    {
      heading: 'Frames and formats',
      body: 'The tool recognizes the lossy VP8, lossless VP8L, and animation-frame ANMF chunks. It reports the total frame count — VP8/VP8L lossy/lossless frames plus ANMF animation frames — so a simple photo, a static lossless image, and a looping animation are each described correctly.',
    },
    {
      heading: 'The problems it flags',
      body: 'The inspector catches common container faults: a bad RIFF or WEBP signature, a truncated file, a chunk that overruns the end of the file, a misaligned chunk, and a trailing pad byte after the last chunk. That is a quick check on a WebP that other tools reject or that was damaged in transfer.',
    },
  ],
  faq: [
    {
      q: 'Is my image uploaded?',
      a: 'No. The WebP RIFF chunk tree is parsed entirely on-device in this tab, with no network calls.',
    },
    {
      q: 'What is a VP8X chunk?',
      a: 'The VP8X extended-feature header carries the canvas dimensions and flags for alpha, animation, ICC profile, EXIF, and XMP. The tool decodes it so you can see those features at a glance.',
    },
    {
      q: 'How does it count animation frames?',
      a: 'The total frame count adds the lossy VP8 and lossless VP8L frames together with the ANMF animation-frame chunks, so a looping WebP is reported as the number of frames it holds.',
    },
    {
      q: 'What does a chunk misalignment mean?',
      a: 'WebP chunks are expected at four-byte boundaries. A misaligned chunk or a trailing pad byte suggests a hand-edited or non-conforming file, which the tool flags.',
    },
  ],
} as const;
