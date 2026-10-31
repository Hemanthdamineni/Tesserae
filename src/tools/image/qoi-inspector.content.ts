/**
 * Editorial content for the qoi-inspector tool page.
 *
 * Kept out of ``qoi-inspector.meta.ts`` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a Quite OK Image format file (.qoi) and the tool inspects its compact lossless structure. It verifies the qoif magic, reads the image width and height (big-endian), the channel count (3 for RGB or 4 for RGBA) and the colorspace (sRGB or linear alpha), then walks the stream of pixel opcodes between the header and the eight-byte end marker. Parsing is entirely on-device; nothing is uploaded.',
    },
    {
      heading: 'The opcode families',
      body: 'QOI stores pixels as six opcode families: QOI_OP_RGB, QOI_OP_RGBA, QOI_OP_INDEX, QOI_OP_DIFF, QOI_OP_LUMA and QOI_OP_RUN. The tool decodes each one and reports how many pixels it emits, then tallies the opcode histogram and the total number of decoded pixels, so you can see whether a file is dominated by runs (smooth areas) or per-pixel RGB updates.',
    },
    {
      heading: 'The problems it flags',
      body: 'The inspector catches the classic structural faults: a bad magic, an unexpected width or height of zero, an unsupported channel count, and a run or index opcode that would decode past the declared dimensions. That makes it a quick sanity check on a .qoi that came from an unusual encoder or a partial download.',
    },
  ],
  faq: [
    {
      q: 'Is my file uploaded?',
      a: 'No. The QOI header and opcode stream are parsed entirely on-device in this tab, with no network calls.',
    },
    {
      q: 'What do the channel count and colorspace mean?',
      a: 'The channel count is 3 for RGB or 4 for RGBA, and the colorspace flag is sRGB or linear alpha. Together they describe how the stored pixels should be interpreted.',
    },
    {
      q: 'What is an opcode histogram?',
      a: 'Every pixel in the stream is encoded with one of the six QOI opcode families. The histogram counts how many pixels each family produced, showing at a glance whether the image compresses well and which encoding the encoder relied on.',
    },
    {
      q: 'Why would a run opcode be a problem?',
      a: 'A run opcode repeats the current pixel value and must not extend past the declared number of pixels. If it would decode beyond the width-by-height total, the file is malformed, and the tool flags it.',
    },
  ],
} as const;
