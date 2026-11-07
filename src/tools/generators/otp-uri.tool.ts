import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './otp-uri.meta';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32 encode (unpadded, uppercase). */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const type = String(o.type ?? 'totp');
  const issuer = String(o.issuer ?? 'Tesserae').trim();
  const account = String(o.account ?? 'user@example.com').trim();
  const digits = String(o.digits ?? '6');
  const algorithm = String(o.algorithm ?? 'SHA1');
  const secretInput = String(o.secretInput ?? '')
    .trim()
    .replace(/\s+/g, '');

  let secret: string;
  if (secretInput) {
    if (!/^[A-Z2-7]+=*$/i.test(secretInput)) {
      throw new ToolError('That is not valid base32.', 'Use only letters A–Z and digits 2–7.');
    }
    secret = secretInput.toUpperCase().replace(/=+$/, '');
  } else {
    const n = Math.max(16, Math.floor(Number(o.secretBytes ?? 20)));
    secret = base32Encode(crypto.getRandomValues(new Uint8Array(n)));
  }

  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('issuer', issuer);
  params.set('algorithm', algorithm);
  params.set('digits', digits);
  if (type === 'hotp') {
    params.set('counter', String(Math.max(0, Math.floor(Number(o.counter ?? 0)))));
  } else {
    params.set('period', String(Math.max(15, Math.floor(Number(o.period ?? 30)))));
  }

  const uri = `otpauth://${type}/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${params.toString()}`;
  return {
    output: `${uri}\nSecret (base32): ${secret}`,
    render: 'text',
    filename: 'otpauth.txt',
    stats: { type: type.toUpperCase(), digits, algorithm },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
