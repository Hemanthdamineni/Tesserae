import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'avi-inspector',
  name: 'AVI Inspector',
  category: 'video',
  summary:
    'Parse an AVI video file on-device: the RIFF chunk tree, dimensions, frame rate, streams and codec, and the index blocks.',
  description:
    'Drop in a Video for Windows AVI file (.avi) and inspect its RIFF container structure. The tool verifies the RIFF header and the AVI  form type, then walks every chunk and LIST in file order reporting its fourcc tag, byte offset and size. It decodes the main header (avih) into the frame width and height, the frame rate, the total frame count, the number of streams and the file flags, then decodes each stream list (strl) reporting the stream type (vids video, auds audio, mids MIDI, txts text), the fourcc codec or format, and the stream format details (for video the pixel bit depth and compression fourcc, for audio the sample rate and channel count). It recognizes the movi data list and the idx1 index block. It flags the classic problems: a bad RIFF or form signature, a chunk that overruns its parent list, an odd-size chunk missing its pad byte, an inconsistent list size, a stream header whose scale and rate are inconsistent with the declared frame rate, and trailing garbage after the last chunk. Everything runs on-device.',
  keywords: [
    'avi',
    'riff',
    'video',
    'microsoft',
    'video for windows',
    'container',
    'chunk',
    'fourcc',
    'avih',
    'strh',
    'strf',
    'hdrl',
    'movi',
    'idx1',
    'codec',
    'frame rate',
    'bitmapinfoheader',
    'waveformatex',
    'parser',
    'decoder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.avi,video/x-msvideo,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'chunks',
      choices: [
        { value: 'chunks', label: 'Chunk tree' },
        { value: 'summary', label: 'Summary' },
        { value: 'streams', label: 'Streams' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect an AVI video file', options: {} },
    { title: 'Read the codec and frame rate of an AVI' },
    { title: 'List every chunk and stream' },
  ],
  related: ['mp4-box-inspector', 'wav-inspector', 'video-info', 'video-compress', 'image-metadata'],
  status: 'stable',
};
