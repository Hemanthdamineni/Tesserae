/**
 * Editorial content for the png-chunk-inspector tool page.
 *
 * Kept out of ``png-chunk-inspector.meta.ts`` so the eager client registry
 * never ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a PNG file and the tool parses it into its chunk stream: every chunk in file order, its byte offset, four-letter type, declared length, and whether the CRC-32 over the type and data matches. Each chunk is classified as critical or ancillary and, for ancillary chunks, whether it is safe to copy. Everything is decoded and checked entirely in this tab — no file is uploaded.',
    },
    {
      heading: 'The structural walk',
      body: 'A PNG is a series of length-prefixed chunks: an 8-byte signature, then chunks from IHDR through IEND. The tool decodes the IHDR into a readable summary — width, height, bit depth, color type proportional, and interlace — and reports how many IDAT chunks the scanline stream is split across. It then decompresses the IDAT data on-device and compares the expected and actual scanline sizes, so a dimension mismatch is visible before you ever open the image.',
    },
    {
      heading: 'The problems it flags',
      body: 'The classic PNG structural faults are called out: a wrong signature, a bad or missing CRC, a missing IHDR (which must be first) or IEND (which must be last), IDAT chunks that are not back to back, and zero-length critical chunks. Ancillary chunk names that violate the case conventions that control safe-to-copy and criticality are reported too, which helps when a file was hand-edited or produced by a non-conforming writer.',
    },
  ],
  faq: [
    {
      q: 'Is my image uploaded anywhere?',
      a: 'No. The PNG is parsed and its IDAT stream decompressed entirely on-device in this tab. The privacy setting for the tool is offline with no network calls.',
    },
    {
      q: 'What does "safe to copy" mean for a chunk?',
      a: "It is a property encoded in an ancillary chunk's four-letter type: whether an editor that does not understand the chunk is allowed to keep it when it modifies the image. Critical chunks are never safe to copy, and the tool reports the classification for every chunk it reads.",
    },
    {
      q: 'Why does the tool care about IDAT ordering?',
      a: 'By the spec all IDAT chunks must be consecutive, because together they form a single compressed scanline stream. The inspector checks that they are back to back and reports how many chunks the stream is split across.',
    },
    {
      q: 'What does a CRC mismatch tell me?',
      a: 'Each chunk carries a CRC-32 over its type and data. A mismatch means the bytes were altered or truncated since the file was written, so the chunk may not decode as expected.',
    },
  ],
} as const;
