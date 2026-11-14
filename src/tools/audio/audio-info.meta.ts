import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-info',
  name: 'Audio File Info',
  category: 'audio',
  summary: 'Inspect an audio file: duration, sample rate, channels, bitrate, peak and clipping.',
  description:
    'Decode an audio file on your device and show its technical details — duration, sample rate, channel count, bitrate, peak and RMS level — along with whether it clips. Nothing is uploaded.',
  keywords: [
    'audio',
    'info',
    'metadata',
    'inspector',
    'wav',
    'mp3',
    'duration',
    'sample rate',
    'bitrate',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  examples: [
    { title: 'Inspect an audio file', options: {} },
    { title: 'Compare a WAV and an MP3 export' },
    { title: 'Check a mix for clipping' },
  ],
  related: ['audio-convert', 'audio-normalize', 'audio-compress'],
  status: 'stable',
};
