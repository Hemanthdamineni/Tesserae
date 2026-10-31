import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'netpbm-inspector',
  name: 'Netpbm Inspector',
  category: 'image',
  summary:
    'Parse a Netpbm image (PBM, PGM, PPM) on-device: the P1-P6 magic, dimensions, maxval, and the raw or ASCII pixel data.',
  description:
    'Drop in a Netpbm image file (.pbm, .pgm, .ppm or .pnm) and inspect its portable structure. The tool reads the magic number and translates it into the concrete variant: P1 and P4 are bitmaps, P2 and P5 are graymaps, and P3 and P6 are pixmaps, with the P1-P3 forms stored as ASCII text and the P4-P6 forms stored as binary raw data. It skips any # comments, then reports the width, height, and the maximum color value, and computes the expected size of the pixel data. For ASCII variants it counts the pixel tokens; for binary variants it validates the pixel data length against the declared dimensions. The tool flags the classic problems: a bad or missing magic number, a zero width or height, a max value outside the range for the variant, a comment that runs past the end of the file, and a pixel data block whose size does not match the declared dimensions. Everything runs on-device.',
  keywords: [
    'netpbm',
    'pbm',
    'pgm',
    'ppm',
    'pnm',
    'portable',
    'bitmap',
    'graymap',
    'pixmap',
    'p1',
    'p2',
    'p3',
    'p4',
    'p5',
    'p6',
    'image',
    'raw',
    'ascii',
    'maxval',
    'pixel',
    'header',
    'parser',
    'inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept:
    '.pbm,.pgm,.ppm,.pnm,image/x-portable-bitmap,image/x-portable-graymap,image/x-portable-pixmap,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'header', label: 'Header' },
        { value: 'pixels', label: 'Pixels' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect a Netpbm image file', options: {} },
    { title: 'Read the dimensions and variant of a PPM' },
    { title: 'Preview the pixel data of a PGM' },
  ],
  related: [
    'image-metadata',
    'tga-inspector',
    'bmp-inspector',
    'png-chunk-inspector',
    'qoi-inspector',
  ],
  status: 'stable',
};
