import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'voice-recorder',
  name: 'Voice Recorder',
  category: 'audio',
  summary:
    'Record your microphone as WAV or WebM with a live level meter, pause/resume and a take you can play back.',
  description:
    'Open your microphone and record your voice in this tab. Watch a live level meter, pause and resume the take, see the elapsed time, then play the clip back, download it as WAV or WebM, or hand it straight to the audio trim tool. The whole take stays on your device — nothing is uploaded.',
  keywords: [
    'voice',
    'record',
    'recorder',
    'microphone',
    'mic',
    'audio',
    'wav',
    'webm',
    'pause',
    'level meter',
    'voicenote',
    'memo',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  // The capture flow (mic → level meter → record/pause/stop) cannot be expressed
  // by the generic file workbench, so the tool opts into the voice-recorder panel.
  panel: 'voice-recorder',
  options: [
    {
      key: 'format',
      label: 'Recording format',
      type: 'select',
      default: 'wav',
      choices: [
        { value: 'wav', label: 'WAV (PCM)' },
        { value: 'webm', label: 'WebM (Opus)' },
      ],
    },
  ],
  examples: [
    { title: 'Record a voice memo as WAV' },
    { title: 'Record a clip to share as WebM (Opus)' },
    { title: 'Record a long take, then trim it' },
  ],
  related: ['audio-trim', 'audio-convert', 'audio-compress', 'mic-test'],
  status: 'stable',
};
