import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'dds-inspector',
  name: 'DDS Texture Inspector',
  category: 'image',
  summary:
    'Inspect a DirectDraw Surface texture: header flags, dimensions, mipmap count, and pixel format.',
  description:
    'Drop in a DirectDraw Surface (.dds) file and inspect its header. The tool validates the DDS magic and reads the DDS_HEADER fields: the size, the header flags, the height and width, the pitch or linear size, the volume depth, the mipmap count, and the caps flags. It decodes the DDS_PIXELFORMAT, translating the four-character code into its common meaning (DXT1, DXT3, DXT5, BC4U, BC5S, or a raw RGB or RGBA layout with its bit masks). It computes the expected payload length from the dimensions and format and flags a bad magic, a truncated header, a pixel format size mismatch, an unknown fourCC, and a payload that disagrees with the header. Everything runs on-device.',
  keywords: [
    'dds',
    'directdraw',
    'directx',
    'texture',
    'dxt',
    'bc1',
    's3tc',
    'mipmap',
    'pixel format',
    'gpu',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.dds,image/vnd.ms-dds,application/octet-stream',
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
  examples: [{ title: 'Inspect a DDS texture', options: {} }],
  related: ['file-signature', 'png-chunk-inspector', 'tiff-inspector', 'webp-inspector'],
  status: 'stable',
};
