import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'png-chunk-inspector',
  name: 'PNG Chunk Inspector',
  category: 'image',
  summary:
    'Parse a PNG into its chunk stream: offsets, lengths, CRCs, critical/ancillary status and decompressed pixel data.',
  description:
    'Drop in a PNG file and see every chunk in order: its byte offset, four-letter type, declared length, whether the CRC-32 over the type and data matches, and the chunk classification (critical versus ancillary, and whether it is safe to copy). The tool decodes the IHDR (width, height, bit depth, color type, interlace) into a readable summary, reports how many IDAT chunks the scanline stream is split across, and decompresses the IDAT data on-device to compare the expected and actual scanline sizes. It also flags the classic structural problems: a wrong PNG signature, a bad or missing CRC, a missing IHDR (which must be first) or IEND (which must be last), IDAT chunks that are not back to back, zero-length critical chunks, ancillary chunk names without the required lowercase letter, and an interlace method that is neither 0 nor 1. Everything runs locally.',
  keywords: [
    'png',
    'chunk',
    'ihdr',
    'idat',
    'iend',
    'crc',
    'zlib',
    'deflate',
    'ancillary',
    'safe-to-copy',
    'image structure',
    'decoder',
    'parser',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.png,image/png',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'chunks',
      choices: [
        { value: 'chunks', label: 'Chunk table' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect a PNG file', options: {} },
    { title: 'Check which chunks a PNG carries' },
  ],
  related: ['image-metadata', 'image-compress', 'data-uri', 'image-convert'],
  status: 'stable',
};
