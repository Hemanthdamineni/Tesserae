import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'qoi-inspector',
  name: 'QOI Inspector',
  category: 'image',
  summary:
    'Parse a Quite OK Image (.qoi) on-device: the 14-byte header, channels and colorspace, and the pixel opcode stream.',
  description:
    'Drop in a Quite OK Image format file (.qoi) and inspect its compact lossless structure. The tool verifies the qoif magic, reads the image width and height (big-endian), the channel count (3 for RGB or 4 for RGBA) and the colorspace (sRGB or linear alpha), then walks the stream of pixel opcodes between the header and the eight-byte end marker. It decodes each of the six opcode families: QOI_OP_RGB, QOI_OP_RGBA, QOI_OP_INDEX, QOI_OP_DIFF, QOI_OP_LUMA and QOI_OP_RUN, reporting how many pixels each opcode emits, and it tallies the opcode histogram and the total number of decoded pixels. The tool flags the classic problems: a bad magic, an unexpected width or height of zero, an unsupported channel count, a run or index opcode that would decode past the declared pixel count, trailing bytes after the end marker, a missing end marker, and a truncated file. Everything runs on-device.',
  keywords: [
    'qoi',
    'quite ok image',
    'lossless',
    'image',
    'format',
    'header',
    'opcode',
    'rgb',
    'rgba',
    'srgba',
    'colorspace',
    'run-length',
    'diff',
    'luma',
    'index',
    'pixel',
    'encoder',
    'parser',
    'decoder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.qoi,image/x-qoi,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'header', label: 'Header' },
        { value: 'opcodes', label: 'Opcodes' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect a QOI image file', options: {} },
    { title: 'Read the dimensions and colorspace of a QOI' },
    { title: 'Decode the pixel opcodes of a QOI image' },
  ],
  related: ['png-chunk-inspector', 'bmp-inspector', 'tga-inspector', 'image-metadata', 'data-uri'],
  status: 'stable',
};
