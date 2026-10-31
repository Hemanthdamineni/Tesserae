import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'wav-inspector',
  name: 'WAV Audio Inspector',
  category: 'audio',
  summary:
    'Inspect a WAV audio file: RIFF chunk tree, PCM format, sample rate, channels, bit depth, and duration.',
  description:
    'Drop in a WAV audio file (.wav) and inspect its container structure. The tool verifies the RIFF header and WAVE form, then walks every chunk in file order reporting its fourcc tag, byte offset, and size. It decodes the fmt  chunk into the audio format name (PCM, IEEE float, A-law, mu-law, extensible), channel count, sample rate, byte rate, block align, and bits per sample, and it computes the playback duration from the data chunk size and byte rate. It recognizes the data chunk and metadata chunks (LIST/INFO, fact, cue, etc.). It flags common problems: a bad RIFF/WAVE signature, a truncated file, a chunk that overruns the end of the file, an odd-size chunk missing its pad byte, an inconsistent byte rate, and trailing garbage after the last chunk. Everything runs on-device.',
  keywords: [
    'wav',
    'wave',
    'audio',
    'riff',
    'chunk',
    'pcm',
    'sample rate',
    'channels',
    'bit depth',
    'bitrate',
    'duration',
    'fmt',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.wav,audio/wav,audio/wave,audio/x-wav',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'chunks',
      choices: [
        { value: 'chunks', label: 'Chunk list' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a WAV audio file', options: {} }],
  related: ['audio-info', 'id3-tag-reader', 'webp-inspector', 'file-signature'],
  status: 'stable',
};
