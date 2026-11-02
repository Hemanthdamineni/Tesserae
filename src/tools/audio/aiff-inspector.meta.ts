import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'aiff-inspector',
  name: 'AIFF Inspector',
  category: 'audio',
  summary:
    'Parse an Audio Interchange File Format (AIFF/AIFC) file on-device: the FORM header, COMM, SSND and metadata chunks.',
  description:
    'Drop in an AIFF or AIFF-C audio file (.aiff or .aifc) and inspect its IFF chunk structure. The tool reads the big-endian FORM container, verifies the AIFF or AIFC form type, and walks every chunk, decoding the COMM common chunk for the number of channels, sample frames, sample size, and the sample rate stored as an 80-bit IEEE 754 extended float. It locates the SSND sound-data chunk (reporting the byte offset and block size) and any metadata chunks such as NAME, AUTH and ANNO as text. The tool flags a missing FORM or AIFF marker, a chunk that overruns the file, and the odd-length chunk padding rule. The views show a chunk map or a decoded summary of the audio parameters. Everything runs on-device.',
  keywords: [
    'aiff',
    'aifc',
    'audio',
    'iff',
    'chunk',
    'form',
    'comm',
    'ssnd',
    'sample',
    'sample rate',
    'extended float',
    'audio format',
    'inspector',
    'parser',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.aiff,.aif,.aifc,audio/aiff,audio/x-aiff,audio/aiffc,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'chunks', label: 'Chunks' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect an AIFF audio file', options: {} },
    { title: 'Read the sample rate and channels of an AIFF' },
    { title: 'List the IFF chunks in an AIFF' },
  ],
  related: ['wav-inspector', 'audio-info', 'flac-inspector', 'ogg-inspector', 'audio-convert'],
  status: 'stable',
};
