/**
 * Editorial content for the avi-inspector tool page.
 *
 * Kept out of `avi-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'The inspector reads a Video for Windows AVI file (.avi) and reports its RIFF container structure. It verifies the RIFF header and the AVI form type, then walks every chunk and LIST in file order, reporting each one’s fourcc tag, byte offset and size. The result is a complete map of how the file is assembled, from the top-level header list down to individual stream lists.',
    },
    {
      heading: 'The header and its streams',
      body: 'The main header chunk (avih) decodes into the frame width and height, the frame rate, the total frame count, the number of streams and the file flags. Each stream list (strl) is then decoded too: the stream type (vids for video, auds for audio, mids for MIDI, txts for text), the fourcc codec or format, and the format details — for video the pixel bit depth and compression fourcc, for audio the sample rate and channel count.',
    },
    {
      heading: 'The movi and idx1 chunks',
      body: 'Actual media data lives in the movi list, and the optional idx1 block is an index of offsets into it. Recognizing both tells you whether the file carries an index, which players use to seek without scanning the whole movi payload. A file missing its index still plays but may seek poorly.',
    },
    {
      heading: 'Structural problems it flags',
      body: 'The inspector reports the classic problems: a bad RIFF or form signature, a chunk that overruns its parent list, an odd-size chunk missing its pad byte, an inconsistent list size, a stream header whose scale and rate are inconsistent with the declared frame rate, and trailing garbage after the last chunk. Each one points at a specific way the container has been damaged or miswritten.',
    },
    {
      heading: 'On-device and offline',
      body: 'Everything runs on-device: the file is parsed in your browser with no upload and no network access, so large or private videos can be inspected offline. The chunk tree, summary and streams views let you switch between the full structure and a condensed read of the codecs and dimensions.',
    },
  ],
  faq: [
    {
      q: 'What is a fourcc?',
      a: 'It is a four-character code used throughout RIFF files as a tag — every chunk and LIST is named by one. The tool reports each tag it walks and translates the important ones, such as the avih main header, strl stream lists, movi media data and idx1 index block.',
    },
    {
      q: 'What is the difference between the movi list and the idx1 block?',
      a: 'The movi list holds the actual video and audio data, while idx1 is an index recording the offset and size of each chunk inside it. The index makes seeking fast; the tool recognizes both and its absence is one of the things a well-formed AVI might simply lack rather than an error.',
    },
    {
      q: 'Does it decode or play the video?',
      a: 'No. The inspector reports the container structure — chunk tree, header fields, stream types and format details — rather than decoding frames. That is enough to learn the resolution, frame rate, codec fourcc and audio parameters without playing the file.',
    },
    {
      q: 'Why report the stream scale and rate separately from the frame rate?',
      a: 'In the stream header, scale and rate together define the stream’s time base. The tool checks whether that time base is consistent with the overall frame rate declared in the main header, and flags the pair when an encoder wrote them inconsistently.',
    },
  ],
} as const;
