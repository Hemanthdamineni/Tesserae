/**
 * Editorial content for the loudness-meter tool page.
 *
 * Kept out of `loudness-meter.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it measures',
      body: 'Upload an audio file and the meter measures loudness the way broadcasters and streaming platforms do, on-device with the ITU-R BS.1770 / EBU R128 method. Each channel passes through a K-weighting filter and is split into gated blocks to give the integrated loudness in LUFS — the number streaming targets are measured against, typically -14 to -23. You also get the momentary and short-term loudness, the loudness range (LRA), and the true peak in dBTP.',
    },
    {
      heading: 'Integrated LUFS and why it matters',
      body: 'The integrated loudness is the single value platforms and loudness-normalization services target. Pick a target from the dropdown — -14 LUFS for streaming, -16, or -23 LUFS for broadcast — and the meter reports whether the file sits near it. Streaming services typically normalize to around -14 LUFS, while broadcast standards use -23, so knowing where a master lands tells you how much headroom a platform will add or remove.',
    },
    {
      heading: 'True peak vs. sample peak',
      body: 'A normal peak meter reads the sample values, but a sample can be loud enough to clip after it is reconstructed and played — an inter-sample peak a sample-level meter misses. The true peak, reported in dBTP, is measured after oversampling, so it catches that clipping, and a value above 0 dBTP means inter-sample clipping is likely even if the waveform looks clean.',
    },
    {
      heading: 'Per-channel view and loudness range',
      body: "The per-channel view shows each channel's contribution to the integrated result, so you can spot an imbalance between left and right. The loudness range (LRA) describes how much the loudness varies over time, which is useful when checking whether dynamic material holds up under normalization. Nothing is uploaded; the measurement runs entirely in this tab.",
    },
  ],
  faq: [
    {
      q: 'What is the difference between LUFS and dB?',
      a: 'dB is a plain signal level, while LUFS is a perceptual measure of loudness, K-weighted and time-gated the way broadcast standards define. Two files with the same peak level can have very different LUFS, which is why platforms normalize loudness, not peak.',
    },
    {
      q: 'What is true peak in dBTP?',
      a: 'dBTP, or decibels true peak, is the peak level measured after oversampling, which reconstructs the inter-sample peaks a sample-level meter misses. Values above 0 dBTP signal likely inter-sample clipping. Streaming platforms commonly target a true peak cap below 0 dBTP.',
    },
    {
      q: 'Which target should I use?',
      a: 'It depends on where the audio goes: around -14 LUFS is a common streaming reference, -23 LUFS is the broadcast standard, and -16 is a middle ground. Pick the target in the dropdown and the meter tells you how close the file lands.',
    },
    {
      q: 'Does it upload my audio?',
      a: 'No, the measurement runs entirely on-device in this tab and the file never leaves your browser.',
    },
  ],
} as const;
