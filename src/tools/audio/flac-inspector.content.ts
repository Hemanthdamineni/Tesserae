/**
 * Editorial content for the flac-inspector tool page.
 *
 * Kept out of `flac-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it reads',
      body: 'Drop in a .flac file and the tool verifies the fLaC magic, then walks the metadata blocks in file order — STREAMINFO, PADDING, APPLICATION, SEEKTABLE, VORBIS_COMMENT, CUESHEET and PICTURE — reporting each block type, byte offset, size and whether it is the last one. Nothing is uploaded; the whole parse happens on-device and works offline.',
    },
    {
      heading: 'The stream details it extracts',
      body: 'The STREAMINFO block is decoded into sample rate, channel count, bits per sample, total samples and the 16-byte MD5 signature FLAC stores, and the tool computes the playback duration from total samples divided by sample rate. The VORBIS_COMMENT block is unpacked into the encoder vendor string and comment count, and a SEEKTABLE reports how many seek points it holds.',
    },
    {
      heading: 'Problems it flags',
      body: 'The inspector reports a bad fLaC magic, a truncated block that overruns the end of the file, a missing STREAMINFO block, a non-STREAMINFO block appearing before STREAMINFO (which FLAC requires first), and the absence of the last-block flag. Use the findings view to jump straight to anything that needs a second look.',
    },
    {
      heading: 'How to read the output',
      body: 'The blocks view lists each metadata block with its offset and size, the summary view condenses the stream facts into one table, and the findings view surfaces only warnings and errors. Because FLAC is lossless, none of the audio is altered or re-encoded — the file is only read.',
    },
  ],
  faq: [
    {
      q: 'Does the tool decode or play the audio?',
      a: 'No. It only parses the fLaC magic and the metadata blocks, and decodes STREAMINFO, VORBIS_COMMENT and SEEKTABLE. It never decodes the audio frames themselves, so your file is only read, never rewritten or uploaded.',
    },
    {
      q: 'What does the STREAMINFO MD5 signature mean?',
      a: 'FLAC stores an MD5 of the unencoded audio data inside STREAMINFO. The inspector reads and displays that stored signature so you can compare it against an independent MD5 if you want to confirm the file is unaltered.',
    },
    {
      q: 'Why must STREAMINFO come first?',
      a: 'The FLAC format requires STREAMINFO to be the first metadata block, because decoders need its sample rate, channels and bit depth before they can play the audio. The tool warns when a different block type appears ahead of it.',
    },
    {
      q: 'Can a large FLAC file be inspected?',
      a: 'Yes, up to 128 MB. Metadata sits at the start of the file, and the inspector only walks the block headers, so even a full-length track is handled entirely in this tab.',
    },
  ],
} as const;
