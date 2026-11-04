import { describe, it, expect } from 'vitest';
import tool from './basic-auth.tool';
import { ToolError } from '@/lib/types';

const run = async (text = '', options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options });

describe('basic-auth', async () => {
  it('builds the RFC 7617 example header', async () => {
    const r = await run('', { mode: 'build', username: 'Aladdin', password: 'open sesame' });
    expect(r.output).toBe('Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==');
  });

  it('decodes a header with the Authorization prefix', async () => {
    const r = await run('Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==', { mode: 'decode' });
    expect(r.output).toBe('Username: Aladdin\nPassword: open sesame');
  });

  it('decodes a bare token too', async () => {
    const r = await run('QWxhZGRpbjpvcGVuIHNlc2FtZQ==', { mode: 'decode' });
    expect(r.output).toBe('Username: Aladdin\nPassword: open sesame');
  });

  it('round-trips a UTF-8 password', async () => {
    const built = (await run('', { mode: 'build', username: 'u', password: 'pä$$' })).output;
    const token = built.replace('Authorization: Basic ', '');
    const decoded = (await run(token, { mode: 'decode' })).output;
    expect(decoded).toBe('Username: u\nPassword: pä$$');
  });

  it('warns when both fields are blank (encodes ":")', async () => {
    const r = await run('', { mode: 'build' });
    expect(r.output).toBe('Authorization: Basic Og==');
    expect(r.warnings?.[0]).toMatch(/no username or password/i);
  });

  it('throws ToolError on non-base64 decode input', async () => {
    await expect(run('!!!not base64!!!', { mode: 'decode' })).rejects.toThrow(ToolError);
    await expect(run('!!!not base64!!!', { mode: 'decode' })).rejects.toThrow(/valid base64/);
  });

  it('empty decode input gives empty output', async () => {
    expect((await run('', { mode: 'decode' })).output).toBe('');
  });
});
