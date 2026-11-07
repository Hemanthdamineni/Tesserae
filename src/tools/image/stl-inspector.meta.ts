import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'stl-inspector',
  name: 'STL 3D Model Inspector',
  category: 'image',
  summary:
    'Read a binary STL 3D model on-device: triangles, bounding box, vertex counts and per-axis size.',
  description:
    'Drop a binary STL file (the standard format for 3D printing) and read its mesh without uploading it. The tool reads the 80-byte header, the 32-bit triangle count, and walks every triangle record to report the total number of triangles, the number of unique vertices, the bounding box (minimum and maximum X, Y and Z), and the overall size on each axis. A malformed file is flagged when the byte length does not match the declared triangle count, when a file is too small to hold even one triangle, or when a triangle record has out-of-range coordinates. The summary view gives the headline mesh statistics and the triangles view lists the first triangles with their three vertices so a preview of the geometry is possible.',
  keywords: [
    'stl',
    'stereolithography',
    '3d',
    'model',
    'mesh',
    'triangle',
    'vertex',
    'print',
    'bounding box',
    'inspector',
    'cad',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.stl,model/stl,application/octet-stream',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'triangles', label: 'Triangles' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a binary STL 3D model' }],
  related: ['tiff-inspector', 'bmp-inspector', 'binary-file-signature', 'file-metadata'],
  status: 'stable',
};
