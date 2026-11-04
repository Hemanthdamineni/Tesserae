import { describe, it, expect } from 'vitest';
import tool from './port-lookup.tool';
import { ToolError } from '@/lib/types';

type Result = { output: string; notes?: string[] };

const run = async (text: string) => (await tool.run({ text, options: {} })) as Result;

const table = (r: Result) => JSON.parse(r.output) as { headers: string[]; rows: string[][] };

describe('port-lookup', async () => {
  it('port 22 resolves to SSH over TCP', async () => {
    const r = await run('22');
    const rows = table(r).rows;
    expect(rows[0]![0]).toBe('22');
    expect(rows[0]![1]).toBe('TCP');
    expect(rows[0]![2]).toBe('SSH');
    expect(table(await run('22')).headers).toEqual(['Port', 'Protocol', 'Service', 'Description']);
  });

  it('service name lookup finds redis on 6379', async () => {
    const r = await run('redis');
    const rows = table(r).rows;
    expect(rows.some((row) => row[0] === '6379' && row[2] === 'Redis')).toBe(true);
  });

  it('empty input lists the whole table (100+ rows)', async () => {
    const r = await run('');
    const rows = table(r).rows;
    expect(rows.length).toBeGreaterThan(100);
  });

  it('matches substrings case-insensitively', async () => {
    const r = await run('postgres');
    const rows = table(r).rows;
    expect(rows.some((row) => row[0] === '5432')).toBe(true);
  });

  it('unknown port returns an empty table with a note', async () => {
    const r = await run('65534');
    expect(table(r).rows).toEqual([]);
    expect(r.notes?.[0]).toMatch(/No well-known service/);
  });

  it('rejects out-of-range port numbers with a ToolError', async () => {
    await expect(run('99999')).rejects.toThrow(ToolError);
    await expect(run('99999')).rejects.toThrow(/0 to 65535/);
  });

  it('TCP/UDP dual registration appears for DNS', async () => {
    const r = await run('53');
    const rows = table(r).rows;
    expect(rows[0]![1]).toBe('TCP/UDP');
  });
});
