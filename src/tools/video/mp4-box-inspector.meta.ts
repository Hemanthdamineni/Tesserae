import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'mp4-box-inspector',
  name: 'MP4 Box Inspector',
  category: 'video',
  summary:
    'Walk an MP4/MOV ISO-BMFF atom tree: every box offset, size, type, container nesting, header form and CRC.',
  description:
    'Drop in an MP4, MOV, M4A or any ISO Base Media file and see its full atom (box) hierarchy: the byte offset of each box, its declared size, its four-character type (ftyp, moov, trak, mdia, minf, stbl, stsd, mdat, moof, mfhd and more), how deeply it is nested, and whether it is a container or a leaf box. The tool decodes a few common boxes into a readable summary (ftyp major brand and version, mvhd timescale and duration, tkhd track id, hdlr handler type) and flags the classic structural problems: a box that overruns its parent, a size smaller than the header, a missing mdat or moov, a top-level box that is not ftyp first, an illegal ftyp placement, boxes with a non-letter type code, and a truncated file. It correctly handles the extended 64-bit size field and the uuid box with a 16-byte user type. Everything runs on-device.',
  keywords: [
    'mp4',
    'mov',
    'm4a',
    'isobmff',
    'iso-bmff',
    'atom',
    'box',
    'ftyp',
    'moov',
    'mdat',
    'moof',
    'stsd',
    'hierarchy',
    'container',
    'parser',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.mp4,.mov,.m4a,.m4v,.3gp,video/mp4,video/quicktime,audio/mp4',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'boxes',
      choices: [
        { value: 'boxes', label: 'Box tree' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
    {
      key: 'maxDepth',
      label: 'Max depth',
      type: 'number',
      default: 20,
      min: 1,
      max: 64,
    },
  ],
  examples: [
    { title: 'Inspect an MP4 file', options: {} },
    { title: 'Check which boxes an MP4 carries' },
  ],
  related: ['video-info', 'video-compress', 'video-frames', 'video-trim'],
  status: 'stable',
};
