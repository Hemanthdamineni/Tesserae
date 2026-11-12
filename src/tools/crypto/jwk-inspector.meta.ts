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
  examples: [
    {
      title: 'An RSA signing key',
      input:
        '{\n  "keys": [\n    {\n      "kty": "RSA",\n      "kid": "rsa-2026-01",\n      "alg": "RS256",\n      "use": "sig",\n      "n": "u6iW8xv8pqx0VqYhTn5Fj6fEZmBfGQYkH0Q6XKr0Lv9N8I7Yw3TQp2m0AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789",\n      "e": "AQAB"\n    }\n  ]\n}',
    },
    {
      title: 'A key missing the exponent',
      input:
        '{\n  "kty": "RSA",\n  "kid": "rsa-broken",\n  "alg": "RS256",\n  "n": "u6iW8xv8pqx0VqYhTn5Fj6fEZmBfGQYkH0Q6XKr0Lv9N8I7Yw3TQp2m0AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789"\n}',
    },
    {
      title: 'An EC key set with two keys',
      input:
        '{\n  "keys": [\n    { "kty": "EC", "crv": "P-256", "kid": "ec-a", "x": "u6iW8xv8pqx0VqYhTn5Fj6fEZmBfGQYkH0Q6XKr0Lv8", "y": "u6iW8xv8pqx0VqYhTn5Fj6fEZmBfGQYkH0Q6XKr0Lv9" },\n    { "kty": "EC", "crv": "P-384", "kid": "ec-b", "x": "u6iW8xv8pqx0VqYhTn5Fj6fEZmBfGQYkH0Q6XKr0Lv0", "y": "u6iW8xv8pqx0VqYhTn5Fj6fEZmBfGQYkH0Q6XKr0Lv1" }\n  ]\n}',
    },
  ],
  related: ['jwt-decode', 'keypair-generator', 'asn1-inspector', 'x509-certificate-inspector'],
  status: 'stable',
};
