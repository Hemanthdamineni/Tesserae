import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'jwk-inspector',
  name: 'JWK / JWKS Inspector',
  category: 'crypto',
  summary: 'Inspect a JSON Web Key or key set on-device: kty, crv, use, alg, kid and key sizes.',
  description:
    'Paste a JSON Web Key (JWK) or a JWKS key set and inspect it without uploading it. The tool reads each key and reports its type, curve, intended use, algorithm and key id, plus structural facts: which key parameters are present, the declared key size for RSA moduli and EC curves, and whether a private key component is included. It also flags a malformed key set, an unknown key type and a missing required member for the key type. The summary gives the key counts by type, the keys view lists every key, and the issues view lists structural problems.',
  keywords: [
    'jwk',
    'jwks',
    'json web key',
    'jose',
    'rsa',
    'ec',
    'okp',
    'kid',
    'key set',
    'crypto',
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
        { value: 'keys', label: 'Keys' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a JWKS key set' }],
  related: ['jwt-decode', 'keypair-generator', 'asn1-inspector', 'x509-certificate-inspector'],
  status: 'stable',
};
