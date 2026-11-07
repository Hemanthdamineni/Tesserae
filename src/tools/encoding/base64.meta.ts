import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'base64',
  name: 'Base64 Encode / Decode',
  category: 'encoding',
  summary: 'Convert text or a file to and from Base64, with URL-safe and MIME line-wrap options.',
  description:
    'Encode text or a whole file as Base64, or decode Base64 back to text or a file. Supports the URL-safe alphabet and 76-character MIME line wrapping. Runs entirely in your browser — nothing is uploaded.',
  keywords: ['base64', 'encode', 'decode', 'btoa', 'atob', 'url-safe', 'base64url', 'mime', 'file'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: true,
  accept: '',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Text → Base64' },
        { value: 'decode', label: 'Base64 → Text' },
      ],
    },
    {
      key: 'urlSafe',
      label: 'URL-safe alphabet',
      type: 'boolean',
      default: false,
      help: 'Use - and _ instead of + and /, and drop padding. Text input only.',
    },
    {
      key: 'wrap',
      label: 'Wrap at 76 chars (MIME)',
      type: 'boolean',
      default: false,
      help: 'Only affects encoding of typed text.',
      showWhen: { key: 'mode', value: 'encode' },
    },
    {
      key: 'outputName',
      label: 'Decoded filename',
      type: 'text',
      default: 'decoded.bin',
      help: 'Name for the file produced when decoding. Files only.',
      showWhen: { key: 'mode', value: 'decode' },
    },
  ],
  examples: [
    { title: 'Encode "hello"', input: 'hello', options: { mode: 'encode' } },
    { title: 'Decode', input: 'aGVsbG8gd29ybGQ=', options: { mode: 'decode' } },
    { title: 'Emoji round-trips', input: 'I ❤ Tesserae', options: { mode: 'encode' } },
  ],
  related: ['base32', 'url-encode', 'hex', 'jwt-decode'],
  status: 'stable',
};
