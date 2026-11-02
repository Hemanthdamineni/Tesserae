import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'webm-inspector',
  name: 'WebM Inspector',
  category: 'video',
  summary:
    'Parse a Matroska or WebM file on-device: the EBML element tree, DocType, and the top-level segment structure.',
  description:
    'Drop in a Matroska or WebM file (.webm or .mkv) and inspect its EBML element tree. The tool decodes the variable-length element IDs and sizes that make up the EBML structure, reports the EBML header with its DocType (webm or matroska), DocTypeVersion and DocTypeReadVersion, and walks the top-level elements down through the Segment, locating the Info block and reporting nested elements such as TimestampScale and the writing application. It validates every element ID and size field, detects truncated or overrunning elements, and flags an unknown top-level element or a missing EBML header. The views show the whole element tree with depth, the element name, its type, and its size, or a compact summary of the document type and segment layout. Everything runs on-device.',
  keywords: [
    'webm',
    'matroska',
    'mkv',
    'ebml',
    'video',
    'container',
    'element',
    'doctype',
    'segment',
    'timestamp',
    'muxing',
    'writingapp',
    'parse',
    'inspector',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.webm,.mkv,video/webm,video/x-matroska,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'tree', label: 'Element tree' },
        { value: 'header', label: 'EBML header' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect a WebM video file', options: {} },
    { title: 'Read the DocType and version of an MKV' },
    { title: 'Walk the EBML element tree of a WebM' },
  ],
  related: [
    'mp4-box-inspector',
    'avi-inspector',
    'mpegts-inspector',
    'video-frames',
    'video-extract-audio',
  ],
  status: 'stable',
};
