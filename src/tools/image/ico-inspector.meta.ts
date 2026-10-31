import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'ico-inspector',
  name: 'ICO Icon Inspector',
  category: 'image',
  summary:
    'Inspect a Windows icon (.ico): header, directory entries, dimensions, bit depth, and embedded image format.',
  description:
    'Drop in a Windows icon file (.ico) and inspect its structure. The tool verifies the 6-byte header (reserved field, the 1 type marker, and the image count), then walks every 16-byte directory entry reporting the image width and height, the palette color count, the colour planes, the bit depth, the embedded data size and file offset, and the embedded image format. It detects whether each image is a PNG (8-byte signature) or a classic BMP/DIB bitmap (BM signature plus AND and XOR masks), flags a reserved header field that is not zero, a type that is not 1, a truncated header or directory, an entry whose data overruns the file, and a directory offset past the end of the data. Everything runs on-device.',
  keywords: [
    'ico',
    'icon',
    'windows',
    'image',
    'favicon',
    'bitmap',
    'png',
    'directory',
    'entry',
    'bit depth',
    'bitmap info',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.ico,image/vnd.microsoft.icon,image/x-icon',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'entries',
      choices: [
        { value: 'entries', label: 'Icon entries' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a Windows icon file', options: {} }],
  related: ['bmp-inspector', 'png-chunk-inspector', 'image-metadata', 'file-signature'],
  status: 'stable',
};
