import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'icc-inspector',
  name: 'ICC Profile Inspector',
  category: 'image',
  summary:
    'Read an ICC color profile on-device: header, class, color spaces, rendering intent, tags and illuminant.',
  description:
    'Open an ICC color profile (.icc or .icm) and inspect its binary structure directly. The tool parses the 128-byte header: the profile size and version, the device class (monitor, printer, scanner, camera, link, color space and more), the data color space and connection space (PCS), the rendering intent, the creation date, the platform, the manufacturer and device model signatures, and the PCS illuminant. It then reads the tag table and lists every tag with its signature, offset and size. The summary also shows how many tags are present, how large the profile is, and whether it looks well formed. Everything is decoded on-device.',
  keywords: [
    'icc',
    'icm',
    'color profile',
    'profile',
    'color management',
    'colormanagement',
    'device class',
    'rendering intent',
    'pcs',
    'color space',
    'tag',
    'illuminant',
    'd50',
    'image',
    'inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.icc,.icm,application/vnd.iccprofile,application/octet-stream',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'header', label: 'Header' },
        { value: 'tags', label: 'Tag table' },
      ],
    },
  ],
  examples: [{ title: 'Inspect an ICC color profile' }],
  related: ['binary-file-signature', 'file-metadata', 'tiff-inspector', 'color-contrast'],
  status: 'stable',
};
