import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'tiff-inspector',
  name: 'TIFF Image Inspector',
  category: 'image',
  summary:
    'Inspect a TIFF image: byte order, IFD entry tree, dimensions, compression, photometric, and tags.',
  description:
    'Drop in a TIFF image (.tiff or .tif) and inspect its structure. The tool detects the byte order (little-endian II or big-endian MM), verifies the 42 magic, and walks every entry in the Image File Directory (IFD) reporting its tag number and name, type (BYTE, ASCII, SHORT, LONG, RATIONAL), count, and decoded value. It translates the high-value tags into their meaning: width and height, bits per sample, compression method (none, LZW, PackBits, Deflate, JPEG), photometric interpretation (WhiteIsZero, BlackIsZero, RGB, Palette, CMYK), samples per pixel, strip offsets and byte counts, resolution and its unit, and the software tag. It follows inline values versus out-of-line offsets, flags a bad byte order or magic, an IFD offset outside the file, a truncated entry table, and an unknown tag type. Everything runs on-device.',
  keywords: [
    'tiff',
    'tif',
    'image',
    'ifd',
    'tag',
    'byte order',
    'endian',
    'lzw',
    'packbits',
    'compression',
    'photometric',
    'resolution',
    'metadata',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.tiff,.tif,image/tiff',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'ifd', label: 'IFD entries' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a TIFF image', options: {} }],
  related: ['png-chunk-inspector', 'image-metadata', 'bmp-inspector', 'file-signature'],
  status: 'stable',
};
