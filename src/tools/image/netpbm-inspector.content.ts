/**
 * Editorial content for the netpbm-inspector tool page.
 *
 * Kept out of ``netpbm-inspector.meta.ts`` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it reads',
      body: 'Drop in a Netpbm file and the tool reads its portable header: the two-byte magic number, the width and height, and — for every variant but a bitmap — the maximum sample value. The magic tells you the concrete format: P1 and P4 are bitmaps, P2 and P5 are graymaps, and P3 and P6 are pixmaps. The odd-numbered forms (P1–P3) store their pixels as ASCII decimal text; the even-numbered forms (P4–P6) store them as raw binary bytes. Parsing happens entirely in this tab.',
    },
    {
      heading: 'ASCII versus binary',
      body: 'An ASCII bitmap writes each pixel as a 0 or 1 token, an ASCII graymap as one number per pixel, and an ASCII pixmap as three numbers per pixel. The tool counts those tokens so you can confirm a text file matches its declared dimensions. A binary file stores the same data packed: a bitmap as one bit per pixel, a graymap as one byte (or two, when the max value exceeds 255) per pixel, and a pixmap as three such samples per pixel. For binary files the tool reports the exact byte length the header implies.',
    },
    {
      heading: 'The problems it flags',
      body: 'Netpbm headers are whitespace-separated and may carry # comments anywhere between tokens, which makes malformed files easy to produce. The inspector catches a bad or missing magic number, a width or height that is not a positive integer, and a max value outside the 1–65535 range (or missing entirely from a PGM or PPM), so a file written by hand or cut short is diagnosed with a concrete reason rather than a generic error.',
    },
    {
      heading: 'Privacy',
      body: 'Nothing leaves your device. The file is read with the File API and parsed locally; the page makes no network requests and works offline, so an image you would rather not upload never leaves the browser.',
    },
  ],
  faq: [
    {
      q: 'What do the P1–P6 magic numbers mean?',
      a: 'They name the variant and its encoding: P1 is an ASCII bitmap, P4 a binary bitmap, P2 an ASCII graymap, P5 a binary graymap, P3 an ASCII pixmap and P6 a binary pixmap. The tool translates the magic into that plain-language variant for you.',
    },
    {
      q: 'Why does a bitmap have no max value?',
      a: 'In a PBM the samples are single bits — a pixel is on or off — so there is no per-sample maximum to declare. Only the graymap and pixmap variants (P2, P5, P3, P6) carry a max value that says how the integer samples map to intensity.',
    },
    {
      q: 'How is the pixel data size computed?',
      a: 'For a binary file the tool multiplies width by height (and by three for a pixmap) and by the sample size — one byte, or two when the max value exceeds 255 — except that a P4 bitmap packs eight pixels into every byte. For an ASCII file it counts the pixel tokens instead, since the text length depends on the digits.',
    },
    {
      q: 'Are comments allowed inside the header?',
      a: 'Yes. A # marks the rest of the line as a comment, and it may appear anywhere whitespace is allowed between header tokens. The parser skips comments and treats every remaining whitespace-separated token in order as the magic, width, height and max value.',
    },
    {
      q: 'Is my image uploaded?',
      a: 'No. The header and pixel data are read and parsed on-device in this tab, with no network requests, so the file never leaves your browser.',
    },
  ],
} as const;
