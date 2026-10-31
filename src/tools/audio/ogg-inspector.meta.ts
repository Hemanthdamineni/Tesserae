import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'ogg-inspector',
  name: 'Ogg Stream Inspector',
  category: 'audio',
  summary:
    'Inspect an Ogg container: capture pattern, header flags, granule position, serial, and every page.',
  description:
    'Drop in an Ogg container (.ogg, .oga, or .opus) and inspect its page structure. The tool validates the OggS capture pattern and stream version, then walks every page reporting its header type flags, granule position, stream serial number, page sequence number, header checksum, and segment table. It decodes the header flags into their meaning: the beginning-of-stream (BOS) and end-of-stream (EOS) markers and continuation pages. It flags a bad capture pattern, an unsupported stream version, a page that overruns the file, a checksum mismatch, and a trailing partial page header. Everything runs on-device.',
  keywords: [
    'ogg',
    'opus',
    'vorbis',
    'theora',
    'container',
    'page',
    'stream',
    'granule',
    'serial',
    'lacing',
    'audio',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.ogg,.oga,.opus,application/ogg,audio/ogg,audio/opus',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'pages',
      choices: [
        { value: 'pages', label: 'Pages' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect an Ogg stream', options: {} }],
  related: ['file-signature', 'flac-inspector', 'wav-inspector', 'midi-inspector'],
  status: 'stable',
};
