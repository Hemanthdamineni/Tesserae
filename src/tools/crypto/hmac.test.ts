import { describe, it, expect } from 'vitest';
import tool from './hmac.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; stats?: Record<string, unknown> };

const FOX = 'The quick brown fox jumps over the lazy dog';

describe('hmac', async () => {
  it('HMAC-SHA256 with key "key" matches the published vector', async () => {
    expect((await run(FOX, { key: 'key' })).output).toBe(
      'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
    );
  });

  it('HMAC-SHA1 with key "key" matches the published vector', async () => {
    expect((await run(FOX, { algorithm: 'sha-1', key: 'key' })).output).toBe(
      'de7c9b85b8b78aa6bc8a7a36f70a90701c9db4d9',
    );
  });

  it('SHA-384 and SHA-512 branches return the expected digest length', async () => {
    expect((await run(FOX, { algorithm: 'sha-384', key: 'key' })).output).toHaveLength(96);
    expect((await run(FOX, { algorithm: 'sha-512', key: 'key' })).output).toHaveLength(128);
  });

  it('Base64 output decodes back to the hex digest', async () => {
    const b64 = (await run(FOX, { key: 'key', output: 'base64' })).output;
    const bin = atob(b64);
    let hex = '';
    for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
    expect(hex).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
  });

  it('reports key and message byte counts', async () => {
    const stats = (await run(FOX, { key: 'key' })).stats!;
    expect(stats['key bytes']).toBe(3);
    expect(stats['bytes signed']).toBe(FOX.length);
    expect(stats.algorithm).toBe('HMAC-SHA-256');
  });

  it('empty text produces empty output', async () => {
    expect((await run('', { key: 'key' })).output).toBe('');
  });

  it('throws ToolError when the key is empty', async () => {
    await expect(run(FOX, {})).rejects.toBeInstanceOf(ToolError);
    await expect(run(FOX, { key: '' })).rejects.toThrow(/key is required/i);
  });

  it('throws ToolError on an unsupported algorithm', async () => {
    await expect(run(FOX, { key: 'key', algorithm: 'md5' })).rejects.toBeInstanceOf(ToolError);
  });
});
