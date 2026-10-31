import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'gif-inspector',
  name: 'GIF Inspector',
  category: 'image',
  summary:
    'Decode the structure of a GIF: logical screen, color tables, frames, graphic-control/comment/application blocks.',
  description:
    'Drop in a GIF and inspect its internal block structure. The tool reads the GIF header (GIF87a or GIF89a) and the Logical Screen Descriptor and reports the canvas width and height, background color, pixel aspect ratio, and whether a Global Color Table is present plus its size and bit resolution. It then walks every block: image descriptors with their left/top offsets, width, height, local color table and interlacing flags; Graphic Control Extensions with their disposal method, delay time and transparency index; Application Extensions such as the NETSCAPE looping block; Comment and Plain Text extensions; and the trailer. It counts the frames and reports each frame block by block with byte offsets, and flags common problems: a missing or wrong GIF magic, a truncated file, a block that overruns the end of the file, a frame declared with a zero-size image, and a missing trailer. Everything runs on-device.',
  keywords: [
    'gif',
    'gif89a',
    'gif87a',
    'frame',
    'logical screen',
    'color table',
    'graphic control',
    'netscape',
    'extension',
    'interlace',
    'animated',
    'decode',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.gif,image/gif',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'blocks',
      choices: [
        { value: 'blocks', label: 'Block list' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect an animated GIF', options: {} }],
  related: ['image-metadata', 'gif-maker', 'image-compress', 'data-uri'],
  status: 'stable',
};
