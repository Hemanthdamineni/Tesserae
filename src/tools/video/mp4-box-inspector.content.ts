/**
 * Editorial content for the mp4-box-inspector tool page.
 *
 * Kept out of `mp4-box-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'The inspector walks the atom (box) hierarchy of an MP4, MOV, M4A or any ISO Base Media file. Every box is reported with its byte offset, declared size, four-character type (ftyp, moov, trak, mdia, minf, stbl, stsd, mdat, moof, mfhd and more), its nesting depth, and whether it is a container or a leaf. A maximum depth setting keeps very deeply nested trees readable.',
    },
    {
      heading: 'How the boxes are arranged',
      body: 'ISO Base Media files are built from nested boxes, each a size field followed by a type and then either payload or child boxes. The moov box holds the movie metadata — tracks, media information and sample tables — while mdat carries the raw media samples and moof/mfhd appear in fragmented files. The inspector decodes a few common boxes into readable summaries: ftyp major brand and version, mvhd timescale and duration, tkhd track id, and hdlr handler type.',
    },
    {
      heading: 'Extended sizes and uuid boxes',
      body: 'It correctly handles the extended 64-bit size field, used when a box exceeds what a 32-bit size can express — typically a large mdat — and the uuid box with its 16-byte user type. Getting these right matters because a parser that mishandles them loses track of every following box.',
    },
    {
      heading: 'Structural problems it flags',
      body: 'The inspector reports the classic structural problems: a box that overruns its parent, a size smaller than the header, a missing mdat or moov, a top-level box that is not ftyp first, an illegal ftyp placement, boxes with a non-letter type code, and a truncated file. Together these catch the usual ways a download is cut short or a file is re-muxed incorrectly.',
    },
    {
      heading: 'On-device and offline',
      body: 'Everything runs on-device: the file is parsed entirely in your browser with no upload and no network access, so private or large media can be inspected offline. The box tree, summary and findings views let you move between the full hierarchy and a condensed verdict on the file’s health.',
    },
  ],
  faq: [
    {
      q: 'Which file types does this cover?',
      a: 'Anything built on the ISO Base Media File Format: MP4, MOV, M4A and M4V, and 3GP among others. They share the same box structure, so the inspector reads them all. A format like WebM or Matroska uses a different container and needs a different tool.',
    },
    {
      q: 'Why does an MP4 need both a moov and an mdat box?',
      a: 'The mdat box holds the actual media samples, while the moov box holds everything needed to interpret them: track definitions, timing tables and sample locations. The tool flags a file missing either one, since a file with payload but no metadata — or the reverse — is not playable.',
    },
    {
      q: 'What is a fragmented MP4?',
      a: 'Instead of one large moov at the start, a fragmented file splits movie data into a series of fragments, each introduced by a moof box with its own mfhd header. Streaming formats use this so a player can start before the whole file arrives, and the inspector shows those boxes in the tree like any other.',
    },
    {
      q: 'Can the file be very large?',
      a: 'Yes. The inspector reads box headers and offsets rather than loading the whole file, and its extended-size support means a multi-gigabyte mdat box is reported correctly rather than breaking the walk. Everything still runs on-device with no network access.',
    },
  ],
} as const;
