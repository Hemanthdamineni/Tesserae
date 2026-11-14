/**
 * Editorial content for the audio-compress tool page.
 *
 * Kept out of ``audio-compress.meta.ts`` so the eager client registry never ships
 * this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How compression works',
      body: 'Each file is decoded to raw samples with the Web Audio API, then re-encoded to MP3 or Opus/OGG by a lossy codec. Because decoding uses an OfflineAudioContext, no speaker or microphone is involved and the whole pipeline stays on your device. You pick a size target or a quality tier and the tool works out the bitrate that fits.',
    },
    {
      heading: 'Size presets aim at a file size',
      body: 'The "50% smaller" and "25% smaller" presets halve or quarter the original byte count by choosing a bitrate that fits the clip length. The "specific target size" preset does the same for a size you type in megabytes. When a clip is too short to reach a target at the lowest allowed bitrate, the result comes out a little larger and the tool says so.',
    },
    {
      heading: 'Quality presets aim at a bitrate',
      body: 'The high, medium and low presets pick a fixed, codec-appropriate bitrate and let the size fall where it may. High is near-CD quality (320 kbps MP3, 192 kbps Opus); medium is a good everyday balance (192/128); low is for speech and slow links (96/64). Use a size preset when the final size matters more than the exact quality.',
    },
    {
      heading: 'MP3 vs Opus',
      body: 'MP3 is produced by lamejs, a JavaScript port of LAME, and plays on virtually everything. Opus uses the browser’s built-in WebCodecs AudioEncoder and is smaller than MP3 at the same quality — pick it when the destination can play Opus/OGG. Both run entirely in your browser.',
    },
  ],
  faq: [
    {
      q: 'Can I compress audio without uploading it?',
      a: 'Yes. The file is decoded and re-encoded entirely in your browser. There are no uploads, accounts or network requests, and the tool works with no connection once it has been cached.',
    },
    {
      q: 'Is this free?',
      a: 'Yes, completely. Compression runs on your own device, so there is no server to pay for and no quota. The MP3 encoder (lamejs) is an open-source library shipped with the tool.',
    },
    {
      q: 'How small will the file get?',
      a: 'The size presets aim to cut the file to 50% or 25% of the original. With a quality preset, the result depends on the clip — a speech recording can drop far below half at the low preset, while an already-compressed music file may barely shrink. The tool shows an estimate before it starts and reports the real before/after sizes when it finishes.',
    },
    {
      q: 'Does compression keep the sound?',
      a: 'It keeps the music and speech, but lossy coding discards some detail — that is what makes the file smaller. High quality is nearly indistinguishable from the original; low quality is fine for speech but audibly softer on complex music. Keep the original file if you need it at full quality later.',
    },
    {
      q: 'Why is Opus unavailable in my browser?',
      a: 'Opus export uses the browser’s built-in WebCodecs AudioEncoder, which needs Chrome 94 or newer (or an equivalent browser). On older browsers choose MP3 instead — it is more compatible and still shrinks the file a lot.',
    },
  ],
} as const;