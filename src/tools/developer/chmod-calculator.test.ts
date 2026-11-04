import { describe, it, expect } from 'vitest';
import tool from './chmod-calculator.tool';

interface Res {
  output: string;
  stats?: Record<string, string | number>;
}

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Res;

const table = (r: Awaited<ReturnType<typeof run>>) =>
  JSON.parse(r.output) as { headers: string[]; rows: string[][] };

describe('chmod-calculator', async () => {
  it('converts octal 755 to symbolic', async () => {
    const r = await run('755');
    expect(r.stats!.octal).toBe('0755');
    expect(r.stats!.symbolic).toBe('rwxr-xr-x');
    const t = table(r);
    expect(t.headers).toEqual(['Class', 'Read', 'Write', 'Execute', 'Special']);
    expect(t.rows[0]).toEqual(['Owner', 'yes', 'yes', 'yes', '-']);
    expect(t.rows[1]).toEqual(['Group', 'yes', 'no', 'yes', '-']);
    expect(t.rows[2]).toEqual(['Other', 'yes', 'no', 'yes', '-']);
  });

  it('converts symbolic rwxr-xr-x to octal', async () => {
    expect((await run('rwxr-xr-x')).stats!.octal).toBe('0755');
  });

  it('handles a leading 0 in octal input', async () => {
    expect((await run('0644')).stats!.symbolic).toBe('rw-r--r--');
  });

  it('parses the setuid special bit (4755)', async () => {
    const r = await run('4755');
    expect(r.stats!.symbolic).toBe('rwsr-xr-x');
    expect(table(r).rows[0]).toEqual(['Owner', 'yes', 'yes', 'yes', 'setuid']);
  });

  it('parses setgid (2755) and sticky (1755)', async () => {
    expect((await run('2755')).stats!.symbolic).toBe('rwxr-sr-x');
    expect((await run('1755')).stats!.symbolic).toBe('rwxr-xr-t');
  });

  it('accepts a 10-char symbolic string with a file-type prefix', async () => {
    expect((await run('-rwsr-xr-x')).stats!.octal).toBe('4755');
    expect((await run('drwxr-xr-x')).stats!.octal).toBe('0755');
  });

  it('distinguishes uppercase S (special bit without execute)', async () => {
    expect((await run('rwSr-xr-x')).stats!.octal).toBe('4655');
    expect((await run('4655')).stats!.symbolic).toBe('rwSr-xr-x');
  });

  it('respects the to-symbolic direction option', async () => {
    expect((await run('700', { mode: 'to-symbolic' })).stats!.symbolic).toBe('rwx------');
    await expect(run('rwx------', { mode: 'to-symbolic' })).rejects.toThrow(/expects an octal/i);
  });

  it('respects the to-octal direction option', async () => {
    expect((await run('rwx------', { mode: 'to-octal' })).stats!.octal).toBe('0700');
    await expect(run('700', { mode: 'to-octal' })).rejects.toThrow(/expects a symbolic/i);
  });

  it('throws ToolError on invalid input', async () => {
    await expect(run('999')).rejects.toThrow(/not a valid permission mode/i);
    await expect(run('rwxr-xr')).rejects.toThrow(/not a valid permission mode/i);
    await expect(run('hello world')).rejects.toThrow(/not a valid permission mode/i);
  });

  it('empty input gives empty output', async () => {
    expect((await run('')).output).toBe('');
  });
});
