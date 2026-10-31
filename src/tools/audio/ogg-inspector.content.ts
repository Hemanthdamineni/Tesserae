/**
 * Editorial content for the ogg-inspector tool page.
 *
 * Kept out of `ogg-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in an Ogg container (.ogg, .oga, or .opus) and the inspector validates the OggS capture pattern and stream version, then walks every page reporting its header type flags, granule position, stream serial number, page sequence number, header checksum, and segment table. It decodes the header flags into their meaning and lists each page so you can see the container structure at a glance.',
    },
    {
      heading: 'Pages, segments, and flags',
      body: 'An Ogg file is a series of pages, each beginning with the four-byte OggS capture pattern. A page carries a header type byte, a granule position, a stream serial number, a page sequence number, a header checksum, and a segment table that describes how the laced data breaks into segments. The header flags mark the beginning of a stream (BOS), the end of a stream (EOS), and continuation pages, which is how the reader knows where one logical stream starts, continues, and ends.',
    },
    {
      heading: 'The granule position',
      body: 'The granule position is a per-page timestamp, encoded in a form specific to the codec, that tells the decoder how far through the stream, in samples, the page takes you. For audio that is what lets a player seek, and the inspector reports it, along with the serial number that identifies which logical stream, among possibly several, a page belongs to.',
    },
    {
      heading: 'What it flags',
      body: 'The tool flags malformed containers, the kind that make players fail, skip, or error mid-stream: a bad capture pattern, an unsupported stream version, a page that overruns the end of the file, a checksum mismatch, and a trailing partial page header. Everything runs on-device.',
    },
  ],
  faq: [
    {
      q: 'What is the OggS capture pattern?',
      a: 'Every Ogg page starts with the four-byte pattern OggS, followed by the stream version byte, so a file that lacks it is not a valid Ogg container. The inspector checks this first, before walking the pages.',
    },
    {
      q: 'Why does a page need a serial number?',
      a: 'A single Ogg file can multiplex several logical streams, each with its own serial number, so pages from different streams — audio, video, or data — can be interleaved. The serial tells the demuxer which logical stream a page belongs to, and the sequence number puts its pages in order.',
    },
    {
      q: 'What is a checksum mismatch?',
      a: 'Each page ends with a checksum over the page, and a mismatch means the page, or the file, has been corrupted in storage or transfer. The inspector flags it, so you know the stream may not play correctly.',
    },
    {
      q: 'Is my Ogg file uploaded?',
      a: 'No, the file is parsed entirely in this tab and never leaves your browser.',
    },
  ],
} as const;
