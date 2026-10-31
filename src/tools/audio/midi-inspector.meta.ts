import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'midi-inspector',
  name: 'MIDI File Inspector',
  category: 'audio',
  summary:
    'Inspect a Standard MIDI File: header format, timing, track chunks, and note, tempo, and meta events.',
  description:
    'Drop in a Standard MIDI File (.mid or .midi) and inspect its structure. The tool verifies the MThd and MTrk chunks, reads the SMF format (0 or 1), the track count, and the division (ticks per quarter note), then walks every track chunk reporting each event with its delta time, message type (note on/off, control change, program change), and channel, and decodes the meta events (tempo in microseconds and BPM, time and key signatures, track name, end of track). It decodes the variable-length quantities used for delta times, translates note numbers to names, flags a bad MThd magic, a truncated header or chunk, an event that overruns its track, and an unexpected running-status byte. Everything runs on-device.',
  keywords: [
    'midi',
    'mid',
    'smf',
    'music',
    'sequence',
    'track',
    'chunk',
    'tempo',
    'bpm',
    'note',
    'meta event',
    'delta time',
    'vlq',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.mid,.midi,audio/midi,audio/x-midi',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'events',
      choices: [
        { value: 'events', label: 'Track events' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a MIDI file', options: {} }],
  related: ['wav-inspector', 'audio-info', 'file-signature', 'bmp-inspector'],
  status: 'stable',
};
