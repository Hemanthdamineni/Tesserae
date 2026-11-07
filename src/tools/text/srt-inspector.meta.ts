import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'srt-inspector',
  name: 'SRT Subtitle Inspector',
  category: 'text',
  summary:
    'Read a SubRip (SRT) subtitle file on-device: cue count, timestamps, duration and formatting issues.',
  description:
    'Open a SubRip (SRT) subtitle file and inspect its structure without uploading it. The tool validates the standard cue layout (a numeric index, an "HH:MM:SS,mmm --> HH:MM:SS,mmm" timing line, one or more subtitle lines, then a blank separator), counts the cues, and reports the total duration, the start and end of the first and last cue, the total number of subtitle lines, and any structural problems it finds: an out-of-order or non-sequential cue index, a missing or malformed timing line, an end time before its start, a cue with no text, or stray blank lines. The summary view gives the headline counts and the issues view lists each problem so you can tell whether a file is safe to convert or encode.',
  keywords: [
    'srt',
    'subrip',
    'subtitle',
    'caption',
    'cue',
    'timestamp',
    'format',
    'validate',
    'duration',
    'inspector',
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
  examples: [{ title: 'Inspect an SRT subtitle file' }],
  related: ['vtt-inspector', 'subtitle-converter', 'text-stats'],
  status: 'stable',
};
