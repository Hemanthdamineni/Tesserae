import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-speed',
  name: 'Change Audio Speed',
  category: 'audio',
  summary: 'Speed up or slow down audio, optionally preserving pitch approximately.',
  description:
    'Change playback speed from 25% to 400%. The default resampling changes both speed and pitch; optional overlap-add time stretching aims to preserve pitch, but is approximate and can introduce artifacts.',
  keywords: [
    'audio',
    'speed',
    'slow motion',
    'faster',
    'slower',
    'pitch',
    'time stretch',
    'resample',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  options: [
    { key: 'rate', label: 'Speed (%)', type: 'number', default: 100, min: 25 },
    {
      key: 'preservePitch',
      label: 'Preserve pitch (approximate)',
      type: 'boolean',
      default: false,
    },
  ],
  related: ['audio-trim', 'audio-reverse', 'audio-compress'],
  examples: [
    { title: 'Double speed, pitch shifts', options: { rate: 200 } },
    {
      title: 'Slow down to 75% keeping pitch',
      options: { rate: 75, preservePitch: true },
    },
    {
      title: 'Half speed for transcribing',
      options: { rate: 50, preservePitch: true },
    },
  ],
  status: 'stable',
};
