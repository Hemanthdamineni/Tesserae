import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'm3u-playlist-inspector',
  name: 'M3U Playlist Inspector',
  category: 'audio',
  summary: 'Inspect an M3U/M3U8 playlist on-device: entries, durations, URIs and missing links.',
  description:
    'Paste an M3U or M3U8 playlist and inspect it without uploading it. The tool checks for the EXTINF header, pairs each EXTINF entry with the URI that follows it, and counts the entries and distinct media URIs. It flags an EXTINF line with no following URI, a bare URI that has no EXTINF metadata, a non-numeric duration, and a playlist with no EXTINF header, so you can fix a broken playlist before importing it. The summary view gives the counts, the entries view lists every track with its duration and URI, and the issues view lists the structural problems.',
  keywords: [
    'm3u',
    'm3u8',
    'playlist',
    'extinf',
    'iptv',
    'media',
    'uri',
    'track',
    'audio',
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
        { value: 'entries', label: 'Entries' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [
    {
      title: 'A simple extended playlist',
      input:
        '#EXTM3U\n#EXTINF:245,Artist One - Track One\n/media/one.mp3\n#EXTINF:182,Artist Two - Track Two\n/media/two.flac',
    },
    {
      title: 'A playlist with only paths',
      input: '/music/alpha.mp3\n/music/beta.ogg\n/music/gamma.mp3',
    },
    {
      title: 'An EXTINF line with no following entry',
      input: '#EXTM3U\n#EXTINF:245,Orphan track\n/media/one.mp3\n#EXTINF:120,Missing media',
    },
  ],
  related: ['srt-inspector', 'vtt-inspector', 'audio-info', 'audio-merge'],
  status: 'stable',
};
