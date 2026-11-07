import { describe, it, expect } from 'vitest';
import tool, { base32Encode } from './otp-uri.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  (tool.run({ text, options }) as { output: string }).output;

describe('otp-uri', () => {
  it('defaults produce a totp URI with the expected shape', () => {
    const out = run('');
    expect(out.startsWith('otpauth://totp/Tesserae:user%40example.com?secret=')).toBe(true);
    expect(out).toContain('digits=6');
    expect(out).toContain('period=30');
    expect(out).toContain('algorithm=SHA1');
  });

  it('secret line matches base32 alphabet', () => {
    expect(run('').split('\n')[1]).toMatch(/^Secret \(base32\): [A-Z2-7]+$/);
  });

  it('generates the default 20-byte secret (32 base32 chars, no padding)', () => {
    const secret = run('').split('\n')[1]!.replace('Secret (base32): ', '');
    expect(secret).toHaveLength(32);
    expect(secret.endsWith('=')).toBe(false);
  });

  it('hotp sets counter and no period', () => {
    const out = run('', { type: 'hotp', counter: 5 });
    expect(out).toContain('&counter=5');
    expect(out).not.toContain('period=');
  });

  it('accepts a supplied base32 secret case-insensitively', () => {
    const out = run('', { secretInput: 'jbswy3dpehpk3pxp' });
    expect(out).toContain('secret=JBSWY3DPEHPK3PXP');
  });

  it('rejects invalid base32 secrets', () => {
    expect(() => run('', { secretInput: 'abc188!' })).toThrow(/base32/);
    expect(() => run('', { secretInput: 'abc109' })).toThrow(/base32/); // 0,1,9 not allowed
  });

  it('base32Encode matches the RFC 4648 test vectors', () => {
    const enc = (s: string) => base32Encode(new TextEncoder().encode(s));
    expect(enc('')).toBe('');
    expect(enc('f')).toBe('MY======'.replace(/=/g, ''));
    expect(enc('fo')).toBe('MZXQ===='.replace(/=/g, ''));
    expect(enc('foo')).toBe('MZXW6');
    expect(enc('foobar')).toBe('MZXW6YTBOI======'.replace(/=/g, ''));
  });

  it('SHA256 and 8 digits appear in the URI when chosen', () => {
    const out = run('', { algorithm: 'SHA256', digits: '8' });
    expect(out).toContain('&algorithm=SHA256&digits=8');
  });
});
