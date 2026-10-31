import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'flac-inspector',
  name: 'FLAC Audio Inspector',
  category: 'audio',
  summary:
    'Inspect a FLAC audio file: metadata blocks, sample rate, channels, bit depth, duration, and tags.',
  description:
    'Drop in a FLAC audio file (.flac) and inspect its structure. The tool verifies the fLaC magic, then walks the metadata blocks in order (STREAMINFO, PADDING, APPLICATION, SEEKTABLE, VORBIS_COMMENT, CUESHEET, PICTURE) reporting each block type, byte offset, size, and whether it is the last. It decodes the STREAMINFO block into sample rate, channel count, bits per sample, total samples, and MD5 signature, and computes the playback duration, and the VORBIS_COMMENT block into the vendor string and comment count. It flags common problems: a bad magic, a truncated block that overruns the end of the file, a missing STREAMINFO block, a block type that appears before STREAMINFO, and a missing last-block flag. Everything runs on-device.',
  keywords: [
    'flac',
    'audio',
    'lossless',
    'metadata',
    'streaminfo',
    'vorbis comment',
    'padding',
    'seektable',
    'picture',
    'sample rate',
    'bit depth',
    'channels',
    'duration',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.flac,audio/flac,audio/x-flac',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'blocks',
      choices: [
        { value: 'blocks', label: 'Metadata blocks' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a FLAC audio file', options: {} }],
  related: ['audio-info', 'id3-tag-reader', 'wav-inspector', 'file-signature'],
  status: 'stable',
};
