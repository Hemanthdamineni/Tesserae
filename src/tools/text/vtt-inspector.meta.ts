import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'vtt-inspector',
  name: 'WebVTT Inspector',
  category: 'text',
  summary:
    'Validate and analyze a WebVTT subtitle file: header, cues, timings, overlap and malformed lines.',
  description:
    'Paste a WebVTT (.vtt) subtitle document and inspect its structure. The tool verifies the WEBVTT header, extracts the optional header metadata, and parses every cue: its identifier, start and end timestamps, the settings after the arrow, and the cue text lines. It then reports totals such as the cue count and total runtime, and flags problems a player would hit, including cues out of chronological order, overlapping cue times, timestamps that run past the end, and cue lines that are missing or malformed. The output is a table of cues with their timings and a separate issues list, all computed on-device from the pasted text.',
  keywords: [
    'webvtt',
    'vtt',
    'subtitle',
    'subtitles',
    'caption',
    'captions',
    'cue',
    'timing',
    'timestamp',
    'srt',
    'text',
    'inspector',
    'validator',
    'analytics',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'cues', label: 'Cue list' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [
    {
      title: 'A valid two-cue caption file',
      input:
        'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello, world.\n\n00:00:04.000 --> 00:00:06.500\nSecond caption.',
    },
    {
      title: 'Out-of-order cues',
      input:
        'WEBVTT\n\n00:00:05.000 --> 00:00:07.000\nThis cue starts late.\n\n00:00:02.000 --> 00:00:04.000\nThis one starts earlier.',
    },
    {
      title: 'A cue with an identifier and settings',
      input:
        'WEBVTT - Example\n\nintro\n00:00:00.500 --> 00:00:02.000 line:90% align:center\nWelcome to the show.\n\n00:00:02.500 --> 00:00:04.000\nEnjoy the episode.',
    },
  ],
  related: ['subtitle-converter', 'diff-text', 'text-stats', 'readability-score'],
  status: 'stable',
};
