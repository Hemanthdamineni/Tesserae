import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'tga-inspector',
  name: 'TGA Image Inspector',
  category: 'image',
  summary:
    'Inspect a TGA/Targa image: header fields, image type, color map, dimensions, origin, and footer.',
  description:
    'Drop in a Truevision Targa (TGA) image and inspect its structure. The tool reads the 18-byte header and reports the image ID length, color map type, and image type (uncompressed or RLE, colormapped, truecolor, or grayscale), the color map spec (first entry, length, bits per entry), the X/Y origin and width and height, the pixel depth, and the image descriptor (alpha channel bits and the pixel origin, top-left or bottom-left). It reports the data offset and detects whether a TRUEVISION-XFILE footer signature is present, and flags a truncated header, an unsupported image type, a color map spec that overruns the file, and a data offset past the end of the file. Everything runs on-device.',
  keywords: [
    'tga',
    'targa',
    'image',
    'rle',
    'color map',
    'truecolor',
    'grayscale',
    'origin',
    'alpha',
    'footer',
    'bit depth',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.tga,image/tga,image/x-tga',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'header', label: 'Header fields' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a TGA image', options: {} }],
  related: ['bmp-inspector', 'png-chunk-inspector', 'image-metadata', 'file-signature'],
  status: 'stable',
};
