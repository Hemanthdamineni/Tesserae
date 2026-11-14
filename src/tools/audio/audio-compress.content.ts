/**
 * Editorial content for the audio-compress tool page.
 *
 * Kept out of ``audio-compress.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How on-device audio compression works',
      body: 'Audio compression reduces file size by re-encoding audio samples into high-efficiency lossy formats such as MP3 or Opus. The audio file is decoded in-memory via the Web Audio API without streaming data over the network. The samples are then processed through client-side encoders directly within your web browser.',
    },
    {
      heading: 'Choosing between MP3 and Opus formats',
      body: 'MP3 delivers universal playback compatibility across virtually every device, vehicle media system, and legacy media player. Opus provides superior compression efficiency at equivalent or lower bitrates, making it the optimal choice for speech recordings, voice memos, and mobile-friendly media distribution.',
    },
    {
      heading: 'Target size versus bitrate presets',
      body: 'You can target a specific reduction percentage, specify an exact megabyte target size, or configure explicit bitrate tiers. Preset percentage profiles calculate an appropriate bitrate based on track duration, preserving intelligible dynamics while shedding redundant high-frequency content.',
    },
    {
      heading: 'Privacy and offline reliability',
      body: 'Because all processing happens on your local device, sensitive voice notes and proprietary audio recordings never traverse third-party servers. The application continues functioning entirely offline once loaded into the browser application cache.',
    },
  ],
  faq: [
    {
      q: 'Are audio files uploaded to a remote server for compression?',
      a: 'No. All audio decoding, resampling, and re-encoding take place entirely on your device using client-side Web Audio and WebCodecs technologies. No audio payload is ever sent to any remote server.',
    },
    {
      q: 'Which output format yields the smallest file size?',
      a: 'Opus typically produces significantly smaller files than MP3 at equivalent perceived audio quality, especially for voice recordings and spoken-word podcasts.',
    },
    {
      q: 'Can I compress files without an active internet connection?',
      a: 'Yes. Once the web application assets are cached by your browser, the compression engine works completely offline without requiring internet access.',
    },
    {
      q: 'What happens when I choose a specific target size in MB?',
      a: 'The tool calculates the duration of the audio clip and automatically determines the maximum bitrate that allows the compressed file to fit within your designated target size.',
    },
  ],
} as const;
