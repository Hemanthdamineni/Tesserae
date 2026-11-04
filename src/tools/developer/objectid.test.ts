import { describe, it, expect } from 'vitest';
import tool from './objectid.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    render?: string;
    stats?: Record<string, string | number>;
  };

async function fields(text: string, options: Record<string, string | number | boolean> = {}) {
  const { output } = await run(text, options);
  const parsed = JSON.parse(output) as { headers: string[]; rows: string[][] };
  const map: Record<string, string> = {};
  for (const [k, v] of parsed.rows) map[k!] = v!;
  return map;
}

describe('objectid', async () => {
  it('decodes the classic 507f1f77bcf86cd799439011', async () => {
    const f = await fields('507f1f77bcf86cd799439011');
    expect(f['Timestamp (ISO UTC)']).toBe('2012-10-17T21:13:27.000Z');
    expect(f['Unix time (seconds)']).toBe('1350508407');
    expect(f['Random value (5 bytes)']).toBe('bcf86cd799');
    expect(f['Counter (3 bytes, hex)']).toBe('439011');
    expect(f['Counter (decimal)']).toBe('4427793');
  });

  it('accepts uppercase and trims whitespace', async () => {
    const f = await fields('  507F1F77BCF86CD799439011  ');
    expect(f['Unix time (seconds)']).toBe('1350508407');
  });

  it('throws on the wrong length', async () => {
    await expect(run('xyz')).rejects.toThrow(ToolError);
    await expect(run('507f1f77bcf86cd79943901')).rejects.toThrow(/24 hex/i);
  });

  it('throws on non-hex characters', async () => {
    await expect(run('507f1f77bcf86cd79943901g')).rejects.toThrow(/0-9 and a-f/i);
  });

  it('empty input in decode mode → empty output', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   ')).output).toBe('');
  });

  it('generates a structurally valid ObjectId', async () => {
    const r = await run('', { mode: 'generate' });
    expect(r.output).toMatch(/^[0-9a-f]{24}$/);
    expect(r.render).toBe('code');
    const secs = parseInt(r.output.slice(0, 8), 16);
    const nowSecs = Math.floor(Date.now() / 1000);
    expect(Math.abs(nowSecs - secs)).toBeLessThan(5);
  });

  it('generates a different id each call', async () => {
    const a = (await run('', { mode: 'generate' })).output;
    const b = (await run('', { mode: 'generate' })).output;
    expect(a).not.toBe(b);
  });

  it('round-trips: a generated id decodes cleanly', async () => {
    const id = (await run('', { mode: 'generate' })).output;
    const f = await fields(id, { mode: 'decode' });
    expect(f['Random value (5 bytes)']).toMatch(/^[0-9a-f]{10}$/);
    expect(Number(f['Unix time (seconds)'])).toBeGreaterThan(1_700_000_000);
  });
});
