import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'mpegts-inspector',
  name: 'MPEG-TS Inspector',
  category: 'video',
  summary:
    'Parse an MPEG transport stream (.ts, .m2ts) on-device: 188-byte packets, PIDs, PAT and PMT tables, continuity.',
  description:
    'Drop in an MPEG transport stream file (.ts or .m2ts) and inspect its packetized structure. The tool validates the 0x47 sync byte on every 188-byte packet, decodes each packet header (the PID, the payload unit start indicator, the adaptation field control, and the continuity counter), and builds a PID histogram that shows how many packets each stream carries. It detects the Program Association Table (PID 0) and the Program Map Table it points to, reporting the PMT PID and the elementary stream PIDs it declares. The tool flags the classic problems: a missing or corrupt sync byte, a PID with a packet counter gap that indicates packet loss, an unexpected PID list, a PAT that never appears, and a file that does not end on a packet boundary. Everything runs on-device.',
  keywords: [
    'mpeg',
    'mpeg-ts',
    'transport stream',
    'ts',
    'm2ts',
    'video',
    'packet',
    'pid',
    'pat',
    'pmt',
    'psi',
    'pes',
    'sync',
    '0x47',
    'continuity',
    'counter',
    'broadcast',
    'dvb',
    'parser',
    'inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.ts,.m2ts,.mts,video/mp2t,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'packets', label: 'Packets' },
        { value: 'pids', label: 'PIDs' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect an MPEG transport stream file', options: {} },
    { title: 'List the PIDs in a TS file' },
    { title: 'Check for packet loss in a transport stream' },
  ],
  related: [
    'mp4-box-inspector',
    'avi-inspector',
    'video-frames',
    'video-extract-audio',
    'audio-info',
  ],
  status: 'stable',
};
