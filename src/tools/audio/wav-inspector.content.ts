/**
 * Editorial content for the wav-inspector tool page.
 *
 * Kept out of `wav-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a WAV audio file (.wav) and the inspector verifies the RIFF header and WAVE form, then walks every chunk in file order reporting its fourcc tag, byte offset, and size. It decodes the fmt chunk into the audio format name (PCM, IEEE float, A-law, mu-law, extensible), channel count, sample rate, byte rate, block align, and bits per sample, and computes the playback duration from the data chunk size and byte rate. It also recognizes the data chunk and metadata chunks such as LIST/INFO, fact, and cue.',
    },
    {
      heading: 'The RIFF chunk model',
      body: 'A WAV file is a RIFF container: a series of chunks, each with a four-character tag, a size, and payload, starting with the RIFF header that declares the WAVE form, followed by a fmt chunk describing the format, a data chunk holding the samples, and optional metadata chunks like LIST/INFO, fact, and cue. Walking the chunk tree, as the inspector does, is how you read where each part lives and how big it is. An odd-size chunk gets a pad byte, which the tool accounts for.',
    },
    {
      heading: 'What the fmt chunk tells you',
      body: 'The fmt chunk is the heart of the file, stating the encoding, channels, sample rate, byte rate, block align, and bits per sample. Those parameters together define the bitrate, and dividing the data chunk size by the byte rate gives the duration, which the tool computes. Because byte rate, block align, and bits per sample must stay consistent, an inconsistency is a red flag and the inspector calls it out.',
    },
    {
      heading: 'What it flags',
      body: 'The tool reports files that other software may misread, decode, or refuse: a bad RIFF/WAVE signature, a truncated file, a chunk that overruns the end of the file, an odd-size chunk missing its pad byte, an inconsistent byte rate, and trailing garbage after the last chunk. Everything runs on-device, so no audio is uploaded.',
    },
  ],
  faq: [
    {
      q: 'What is the difference between PCM, float, and A-law/mu-law WAV?',
      a: 'PCM stores each sample as an integer, float stores it as a floating-point value, and A-law and mu-law are compressed logarithmic encodings, typically for telephony. The fmt chunk names the encoding, and the inspector shows it, along with the channel, sample rate, and bit depth that define how the bytes should be interpreted.',
    },
    {
      q: 'How is the duration computed?',
      a: 'The data chunk holds the samples, and dividing its size by the byte rate stated in the fmt chunk gives the playback duration in seconds. So a file with a bad byte rate, or an odd-size chunk, can report the wrong duration, which is one of the problems the tool flags.',
    },
    {
      q: 'What are LIST/INFO, fact, and cue chunks?',
      a: 'LIST/INFO carries metadata like artist, title, and comments, the fact chunk records sample statistics, and cue holds cue points such as CD track markers. The inspector recognizes these, so you can see the metadata chunks alongside the audio data.',
    },
    {
      q: 'Is my WAV file uploaded?',
      a: 'No, the file is parsed entirely in this tab and never leaves your browser.',
    },
  ],
} as const;
