import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-trim',
  name: 'Trim / Clip Audio',
  category: 'audio',
  summary: 'Cut an audio file to a range and apply click-free fade in/out edges.',
  description:
    'Trim audio to a start and end time (accepting "SS", "M:SS" or "H:MM:SS") and optionally add a short fade in and fade out so the clip starts and ends cleanly.',
  keywords: ['audio', 'trim', 'clip', 'cut', 'fade', 'wav', 'slice'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  options: [
    {
      key: 'start',
      label: 'Start time',
      type: 'text',
      default: '0:00',
      placeholder: '0:00, 1:30, 00:00:05 …',
    },
    {
      key: 'end',
      label: 'End time (empty = end)',
      type: 'text',
      default: '',
      placeholder: 'e.g. 0:45',
    },
    { key: 'fadeIn', label: 'Fade in (ms)', type: 'number', default: 0, min: 0 },
    { key: 'fadeOut', label: 'Fade out (ms)', type: 'number', default: 0, min: 0 },
  ],
  examples: [
    { title: 'First 30 seconds', options: { start: '0:00', end: '0:30' } },
    {
      title: 'Trim with fades',
      options: { start: '0:10', end: '1:00', fadeIn: 300, fadeOut: 500 },
    },
    { title: 'Long ringtone tail', options: { start: '2:05', end: '2:35', fadeOut: 1500 } },
  ],
  related: ['audio-fade', 'audio-convert', 'audio-compress'],
  status: 'stable',
};
