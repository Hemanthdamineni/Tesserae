import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'icns-inspector',
  name: 'ICNS Icon Inspector',
  category: 'image',
  summary:
    'Inspect an Apple ICNS icon set: file magic and size, then every icon resource chunk and its type.',
  description:
    'Drop in an Apple Icon Image (.icns) file and inspect its structure. The tool validates the ICNS magic and total file length, then walks every icon resource chunk reporting its four-character type code, its byte offset, its declared length, and its data size. It decodes the resource type into its common meaning: icp4 and ic10 are PNG icons at 16 and 32 points, ic07 through ic13 are PNG icons at larger sizes, icp5 and icp6 are 512 and 1024 point PNG icons, ics4 and ics5 are 16 and 32 point JPEG 2000 icons, and ic04 through ic12 are 16 through 1024 point JPEG 2000 icons. It flags a missing magic, a length that disagrees with the real file size, a chunk that overruns the file, and a trailing partial chunk header. Everything runs on-device.',
  keywords: [
    'icns',
    'icon',
    'apple',
    'macos',
    'icon set',
    'png',
    'jpeg2000',
    'chunk',
    'resource',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.icns,image/icns,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'chunks',
      choices: [
        { value: 'chunks', label: 'Icon chunks' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect an ICNS icon set', options: {} }],
  related: ['file-signature', 'png-chunk-inspector', 'ico-inspector', 'bmp-inspector'],
  status: 'stable',
};
