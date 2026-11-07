import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'otp-uri',
  name: 'OTP Auth URI Generator',
  category: 'generators',
  summary: 'Build otpauth:// URIs (TOTP/HOTP) with a base32 secret for authenticator apps.',
  description:
    'Create the otpauth:// provisioning URI that Google Authenticator, Aegis, 1Password and friends scan as a QR code. Generates a random base32 secret on-device or validates one you paste in.',
  keywords: [
    'otpauth',
    'totp',
    'hotp',
    '2fa',
    'two factor',
    'authenticator',
    'base32 secret',
    'otp uri',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      default: 'totp',
      choices: [
        { value: 'totp', label: 'TOTP (time-based)' },
        { value: 'hotp', label: 'HOTP (counter-based)' },
      ],
    },
    { key: 'issuer', label: 'Issuer', type: 'text', default: 'Tesserae' },
    { key: 'account', label: 'Account', type: 'text', default: 'user@example.com' },
    {
      key: 'secretInput',
      label: 'Secret (base32, empty = generate)',
      type: 'text',
      default: '',
      placeholder: 'e.g. JBSWY3DPEHPK3PXP',
    },
    {
      key: 'secretBytes',
      label: 'Random secret bytes',
      type: 'number',
      default: 20,
      min: 16,
    },
    {
      key: 'digits',
      label: 'Code digits',
      type: 'select',
      default: '6',
      choices: [
        { value: '6', label: '6' },
        { value: '8', label: '8' },
      ],
    },
    {
      key: 'algorithm',
      label: 'Hash algorithm',
      type: 'select',
      default: 'SHA1',
      choices: [
        { value: 'SHA1', label: 'SHA1 (default)' },
        { value: 'SHA256', label: 'SHA256' },
        { value: 'SHA512', label: 'SHA512' },
      ],
    },
    {
      key: 'period',
      label: 'Period (seconds)',
      type: 'number',
      default: 30,
      min: 15,
      showWhen: { key: 'type', value: 'totp' },
    },
    {
      key: 'counter',
      label: 'Initial counter',
      type: 'number',
      default: 0,
      showWhen: { key: 'type', value: 'hotp' },
    },
  ],
  examples: [
    {
      title: 'TOTP with a fresh secret',
      options: { type: 'totp', issuer: 'Tesserae', account: 'you@example.com' },
    },
    {
      title: 'Known secret',
      options: { type: 'totp', issuer: 'ACME', account: 'alice', secretInput: 'JBSWY3DPEHPK3PXP' },
    },
    {
      title: 'HOTP with a counter',
      options: { type: 'hotp', issuer: 'ACME', account: 'alice', counter: 5, digits: '8' },
    },
  ],
  related: ['qr-code', 'random-string', 'hmac'],
  status: 'stable',
};
