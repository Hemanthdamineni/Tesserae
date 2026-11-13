import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'sri-validator',
  name: 'SRI Hash Validator',
  category: 'web',
  summary:
    'Validate Subresource Integrity attributes on-device: algorithm, base64 and digest length.',
  description:
    'Paste an SRI integrity attribute (the integrity="..." value of a script or link tag) and validate it without uploading anything. The tool splits it into its individual algorithm-token pairs, checks that each algorithm is one of sha256, sha384 or sha512, and that the base64 value decodes to the exact digest length for that algorithm (32, 48 or 64 bytes). It also flags an unexpected algorithm, malformed base64, and an empty or missing token. When you also paste the expected content, it compares each token against the real digest, so you can confirm which integrity hashes actually match the asset before you ship it.',
  keywords: [
    'sri',
    'subresource integrity',
    'integrity',
    'sha256',
    'sha384',
    'sha512',
    'crossorigin',
    'cdn',
    'hash',
    'security',
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
        { value: 'tokens', label: 'Tokens' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [
    {
      title: 'A valid SHA-384 integrity attribute',
      input:
        '<script src="https://cdn.example.com/app.js" integrity="sha384-OgVRvuATP1z7JjHLkuOU7Xw704+h835Lr+6QL9UvYjZE3Ipu6Tp75j7Bh/kR0JKI" crossorigin="anonymous"></script>',
    },
    {
      title: 'A tag with no integrity attribute',
      input: '<script src="https://cdn.example.com/app.js" crossorigin="anonymous"></script>',
    },
    {
      title: 'A bare integrity value with an unknown algorithm',
      input: 'sha1-8H12Y3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0aAbBcCdDeEfFgGhHi',
    },
  ],
  related: ['sri-hash-generator', 'hash', 'file-hash', 'security-headers'],
  status: 'stable',
};
