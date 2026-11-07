import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'exr-inspector',
  name: 'OpenEXR Inspector',
  category: 'image',
  summary:
    'Read an OpenEXR HDR image on-device: version, channels, compression, data window and dimensions.',
  description:
    'Open an OpenEXR image file (the HDR format used in VFX and film) and inspect its header without uploading it. The tool verifies the OpenEXR magic, reads the file version and flags (tiled, deep, multi-part), then walks the attribute list to report the channels and their types, the compression scheme, the data window and display window, the line order, and the pixel aspect ratio. The summary shows the version, the image dimensions, the number of channels, the compression name and whether the file uses a tiled layout. Everything is parsed on-device.',
  keywords: [
    'exr',
    'openexr',
    'hdr',
    'image',
    'vfx',
    'film',
    'channels',
    'compression',
    'data window',
    'scanline',
    'tiled',
    'header',
    'inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.exr,image/x-exr,image/x-openexr,application/octet-stream',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'channels', label: 'Channels' },
        { value: 'attributes', label: 'Attributes' },
      ],
    },
  ],
  examples: [{ title: 'Inspect an OpenEXR image header' }],
  related: ['image-metadata', 'icc-inspector', 'tiff-inspector', 'binary-file-signature'],
  status: 'stable',
};
