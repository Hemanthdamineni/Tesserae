import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'webp-inspector',
  name: 'WebP Image Inspector',
  category: 'image',
  summary:
    'Inspect a WebP image: RIFF chunk tree, VP8X features, animation frames, alpha, and dimensions.',
  description:
    'Drop in a WebP image (.webp) and inspect its container structure. The tool verifies the RIFF header and WEBP form, then walks every chunk in file order reporting its fourcc tag, byte offset, and size. It decodes the VP8X extended-feature header into the canvas dimensions and the feature flags (alpha, animation, ICC profile, EXIF, XMP), the ANIM chunk into background color and loop count, and recognizes the lossy VP8, lossless VP8L, and animation-frame ANMF chunks. It reports the total frame count (VP8/VP8L lossy/lossless frames plus ANMF animation frames) and flags common problems: a bad RIFF/WEBP signature, a truncated file, a chunk that overruns the end of the file, a misaligned chunk, and a trailing pad byte after the last chunk. Everything runs on-device.',
  keywords: [
    'webp',
    'image',
    'riff',
    'chunk',
    'vp8',
    'vp8l',
    'vp8x',
    'anim',
    'anmf',
    'alpha',
    'animation',
    'lossless',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.webp,image/webp',
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
  examples: [{ title: 'Inspect a WebP image', options: {} }],
  related: ['png-chunk-inspector', 'gif-inspector', 'image-metadata', 'file-signature'],
  status: 'stable',
};
