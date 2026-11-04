import { describe, it, expect } from 'vitest';
import tool from './hash.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; stats?: Record<string, unknown> };

describe('hash', async () => {
  it('MD5 of "abc" (known vector)', async () => {
    expect((await run('abc', { algorithm: 'md5' })).output).toBe(
      '900150983cd24fb0d6963f7d28e17f72',
    );
  });

  it('MD5 of the alphabet and a longer phrase', async () => {
    expect((await run('abcdefghijklmnopqrstuvwxyz', { algorithm: 'md5' })).output).toBe(
      'c3fcd3d76192e4007dfb496cca67e13b',
    );
    expect(
      (await run('The quick brown fox jumps over the lazy dog', { algorithm: 'md5' })).output,
    ).toBe('9e107d9d372bb6826bd81d3542a419d6');
  });

  it('SHA-1 of "abc"', async () => {
    expect((await run('abc', { algorithm: 'sha-1' })).output).toBe(
      'a9993e364706816aba3e25717850c26c9cd0d89d',
    );
  });

  it('SHA-256 of "abc" is the default', async () => {
    expect((await run('abc')).output).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('SHA-384 of "abc"', async () => {
    expect((await run('abc', { algorithm: 'sha-384' })).output).toBe(
      'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
    );
  });

  it('SHA-512 of "abc"', async () => {
    expect((await run('abc', { algorithm: 'sha-512' })).output).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    );
  });

  it('encodes the digest as Base64 and URL-safe Base64', async () => {
    expect((await run('abc', { output: 'base64' })).output).toBe(
      'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=',
    );
    expect((await run('abc', { output: 'base64url' })).output).toBe(
      'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0',
    );
  });

  it('uppercases hex output when asked', async () => {
    expect((await run('abc', { uppercase: true })).output).toBe(
      'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD',
    );
  });

  it('reports the number of bytes hashed', async () => {
    expect((await run('abc')).stats?.['bytes hashed']).toBe(3);
    expect((await run('héllo')).stats?.['bytes hashed']).toBe(6);
  });

  it('empty input produces empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('throws ToolError on an unsupported algorithm', async () => {
    await expect(run('abc', { algorithm: 'sha3-256' })).rejects.toBeInstanceOf(ToolError);
  });
});
