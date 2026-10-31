import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'bmp-inspector',
  name: 'BMP Image Inspector',
  category: 'image',
  summary:
    'Inspect a Windows BMP: file header, DIB info, dimensions, bit depth, compression, and color table.',
  description:
    'Drop in a Windows bitmap (.bmp) and inspect its structure. The tool verifies the BM signature bytes, then parses the BITMAPFILEHEADER for the file size, reserved fields, and the pixel-data offset, and the BITMAPINFOHEADER (DIB header) for dimensions, planes, bits per pixel, compression method, image size, horizontal and vertical resolution, and the color count. It decodes the compression field into its human name (none, RLE8, RLE4, bitfields, JPEG, PNG, alpha bitfields) and, for indexed images up to 8 bits per pixel, reports the color palette size and entry count. It flags common problems: a bad signature, a truncated or overrunning file, a pixel-data offset outside the file, an inconsistent declared image size, and a palette larger than the file allows. Everything runs on-device.',
  keywords: [
    'bmp',
    'bitmap',
    'dib',
    'image',
    'windows',
    'pixel',
    'palette',
    'color table',
    'compression',
    'rle',
    'bit depth',
    'header',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.bmp,image/bmp,image/x-bmp',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'headers', label: 'Header fields' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a BMP image', options: {} }],
  related: ['png-chunk-inspector', 'image-metadata', 'webp-inspector', 'file-signature'],
  status: 'stable',
};
