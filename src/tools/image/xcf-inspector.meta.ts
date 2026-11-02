import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'xcf-inspector',
  name: 'XCF Inspector',
  category: 'image',
  summary:
    'Read a GIMP XCF image file on-device: the header, dimensions, base type, and top-level property list.',
  description:
    'Drop in a GIMP XCF image file (.xcf) and inspect its native binary header without loading the image. The tool verifies the "gimp xcf " magic and the file version, then reports the canvas width, height and the base type (RGB, grayscale or indexed). It walks the top-level property list, decoding known properties such as the compression scheme (RLE or fractal) and the horizontal and vertical resolution, and counts the layers, channels and masks declared in the file. The tool flags a missing magic, an unsupported version, and a property block that runs past the end of the file. The views show the header summary or the full property list. Everything runs on-device.',
  keywords: [
    'xcf',
    'gimp',
    'image',
    'header',
    'layer',
    'channel',
    'mask',
    'rgb',
    'grayscale',
    'indexed',
    'compression',
    'rle',
    'property',
    'resolution',
    'inspector',
    'parser',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.xcf,image/x-xcf,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'properties', label: 'Properties' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect a GIMP XCF image', options: {} },
    { title: 'Read the dimensions and base type of an XCF' },
    { title: 'List the properties of an XCF' },
  ],
  related: ['psd-inspector', 'png-chunk-inspector', 'tiff-inspector', 'data-uri', 'file-hash'],
  status: 'stable',
};
