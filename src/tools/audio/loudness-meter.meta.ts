import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'loudness-meter',
  name: 'Loudness Meter (LUFS)',
  category: 'audio',
  summary:
    'Measure the perceived loudness of an audio file in integrated LUFS, with momentary/short-term levels, LRA and true peak.',
  description:
    "Upload an audio file and measure its loudness the way broadcasters and streaming platforms do, on-device with the ITU-R BS.1770 / EBU R128 method. Every channel is passed through a K-weighting filter, split into gated blocks, and integrated to give: the integrated loudness in LUFS (the number streaming targets are measured against, typically -14 to -23), the momentary and short-term loudness, the loudness range (LRA), and the true peak in dBTP (the peak after oversampling, which catches inter-sample clipping that a normal peak meter misses). The result also shows each channel's contribution and a plain-language check of whether the file sits near common targets like -14 LUFS for streaming or -23 LUFS for broadcast. Nothing is uploaded.",
  keywords: [
    'loudness',
    'lufs',
    'lu',
    'true peak',
    'dtp',
    'bs.1770',
    'ebr128',
    'k-weighting',
    'lra',
    'loudness range',
    'meter',
    'mastering',
    'audio',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'channels', label: 'Per channel' },
        { value: 'findings', label: 'Findings' },
      ],
    },
    {
      key: 'target',
      label: 'Target',
      type: 'select',
      default: '-14',
      choices: [
        { value: '-14', label: '-14 LUFS (streaming)' },
        { value: '-16', label: '-16 LUFS' },
        { value: '-23', label: '-23 LUFS (broadcast)' },
      ],
    },
  ],
  examples: [
    { title: 'Measure a mastered track', options: { target: '-14' } },
    { title: 'Check against broadcast loudness', options: { target: '-23' } },
  ],
  related: ['audio-info', 'audio-normalize', 'audio-gain'],
  status: 'stable',
};
