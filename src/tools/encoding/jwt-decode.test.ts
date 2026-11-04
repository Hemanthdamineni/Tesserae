import { describe, it, expect } from 'vitest';
import tool from './jwt-decode.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    notes?: string[];
    stats?: Record<string, string | number>;
  };

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const makeToken = (header: unknown, payload: unknown) =>
  `${b64url(header)}.${b64url(payload)}.signature`;

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.sw5c';

describe('jwt-decode', async () => {
  it('decodes header and payload of the sample token', async () => {
    const out = (await run(SAMPLE)).output;
    expect(out).toBe(
      '// header\n{\n  "alg": "HS256",\n  "typ": "JWT"\n}\n\n// payload\n{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}',
    );
  });

  it('reports the algorithm in stats', async () => {
    expect((await run(SAMPLE)).stats).toEqual({ algorithm: 'HS256', type: 'JWT' });
  });

  it('renders iat as a UTC date', async () => {
    const { notes } = await run(SAMPLE);
    expect(
      (notes ?? []).some((n: string) => n.includes('iat (issued at): 2018-01-18 01:30:22 UTC')),
    ).toBe(true);
  });

  it('always notes that the signature is not verified', async () => {
    const { notes } = await run(SAMPLE);
    expect((notes ?? []).some((n: string) => /not verified/i.test(n))).toBe(true);
  });

  it('flags an expired token', async () => {
    const { notes } = await run(makeToken({ alg: 'HS256' }, { exp: 1000000000 }));
    expect(
      (notes ?? []).some(
        (n: string) => n.startsWith('exp (expires):') && n.includes('has expired'),
      ),
    ).toBe(true);
  });

  it('flags a token that is not yet expired', async () => {
    const { notes } = await run(makeToken({ alg: 'HS256' }, { exp: 4102444800 }));
    expect((notes ?? []).some((n: string) => n.includes('not yet expired'))).toBe(true);
  });

  it('part: header only', async () => {
    expect((await run(SAMPLE, { part: 'header' })).output).toBe(
      '// header\n{\n  "alg": "HS256",\n  "typ": "JWT"\n}',
    );
  });

  it('part: payload only', async () => {
    const out = (await run(SAMPLE, { part: 'payload' })).output;
    expect(out.startsWith('// payload')).toBe(true);
    expect(out.includes('// header')).toBe(false);
  });

  it('empty input → empty output', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   ')).output).toBe('');
  });

  it('throws when the token does not have three parts', async () => {
    await await expect(run('abc.def')).rejects.toThrow(ToolError);
    await await expect(run('abc.def')).rejects.toThrow(/three dot-separated parts/i);
  });

  it('throws on a segment that is not valid base64url', async () => {
    await await expect(run('@@@@.@@@@.sig')).rejects.toThrow(ToolError);
  });

  it('throws when a segment is valid base64 but not JSON', async () => {
    // "hello" base64url-encoded is not a JSON value
    await expect(run('aGVsbG8.aGVsbG8.sig')).rejects.toThrow(/not valid JSON/i);
  });
});
