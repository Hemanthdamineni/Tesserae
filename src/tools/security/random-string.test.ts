import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './random-string.tool';

type Res = { output: string; render?: string; stats?: Record<string, string | number> };
const run = async (options: Record<string, string | number | boolean> = {}, text = '') =>
  (await tool.run({ text, options })) as Res;
const lines = (r: Awaited<ReturnType<typeof run>>) => r.output.split('\n');

describe('random-string', async () => {
  it('default: one 32-char alphanumeric string rendered as code', async () => {
    const r = await run({});
    expect(lines(r)).toHaveLength(1);
    expect(lines(r)[0]!).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(r.render).toBe('code');
  });

  it('preset charset branches', async () => {
    expect(lines(await run({ length: 16, charset: 'alpha' }))[0]!).toMatch(/^[A-Za-z]{16}$/);
    expect(lines(await run({ length: 16, charset: 'lowercase' }))[0]!).toMatch(/^[a-z]{16}$/);
    expect(lines(await run({ length: 16, charset: 'uppercase' }))[0]!).toMatch(/^[A-Z]{16}$/);
    expect(lines(await run({ length: 16, charset: 'digits' }))[0]!).toMatch(/^[0-9]{16}$/);
    expect(lines(await run({ length: 20, charset: 'hex-lower' }))[0]!).toMatch(/^[0-9a-f]{20}$/);
    expect(lines(await run({ length: 20, charset: 'hex-upper' }))[0]!).toMatch(/^[0-9A-F]{20}$/);
    expect(lines(await run({ length: 20, charset: 'base64url' }))[0]!).toMatch(
      /^[A-Za-z0-9_-]{20}$/,
    );
  });

  it('custom charset: dedupes and honours the set', async () => {
    const r = await run({ length: 24, charset: 'custom', custom: 'aab' });
    expect(lines(r)[0]!).toMatch(/^[ab]{24}$/);
    expect(r.stats!['charset size']).toBe(2);
    expect(r.stats!['entropy (bits)']).toBe(24); // round(log2(2) * 24)
  });

  it('empty custom set throws ToolError', async () => {
    await expect(run({ charset: 'custom', custom: '' })).rejects.toThrow(ToolError);
    await expect(run({ charset: 'custom', custom: '' })).rejects.toThrow(
      /custom character set is empty/i,
    );
  });

  it('count option produces that many unique lines', async () => {
    const r = await run({ length: 21, charset: 'base64url', count: 30 });
    expect(lines(r)).toHaveLength(30);
    expect(new Set(lines(r)).size).toBe(30);
  });

  it('clamps length to 1..4096', async () => {
    expect(lines(await run({ length: 99999, charset: 'digits' }))[0]!).toHaveLength(4096);
    expect(lines(await run({ length: 0, charset: 'digits' }))[0]!).toHaveLength(1);
  });

  it('known charset size and entropy for digits length 10', async () => {
    const r = await run({ length: 10, charset: 'digits' });
    expect(r.stats!['charset size']).toBe(10);
    expect(r.stats!['entropy (bits)']).toBe(33); // round(log2(10) * 10)
    expect(r.stats!['length']).toBe(10);
  });

  it('throws ToolError when count or length is not a number', async () => {
    await expect(run({ count: 'abc' })).rejects.toThrow(ToolError);
    await expect(run({ length: 'abc' })).rejects.toThrow(ToolError);
  });

  it('still generates for empty text input (it is a generator)', async () => {
    expect((await run({ length: 8 }, '')).output).not.toBe('');
  });
});
