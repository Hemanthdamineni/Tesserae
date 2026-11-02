import { describe, it, expect } from 'vitest';
import tool from './msgpack-decoder.tool';

type Result = {
  r: Awaited<ReturnType<typeof tool.run>>;
  text: string;
  table?: { headers: string[]; rows: string[][] };
};

const run = async (
  text: string,
  options: Record<string, string | number | boolean> = {},
): Promise<Result> => {
  const r = await tool.run({ files: [], text, options });
  const table =
    r.report?.render === 'table'
      ? (JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] })
      : undefined;
  return { r, text: (r.report?.output ?? '').trim(), table };
};

describe('msgpack-decoder', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('decodes scalars', async () => {
    expect((await run('03')).text).toBe('3');
    expect((await run('c3')).text).toBe('true');
    expect((await run('c2')).text).toBe('false');
    expect((await run('c0')).text).toBe('null');
    expect((await run('cb3fe0000000000000')).text).toBe('0.5');
    expect((await run('cd0008')).text).toBe('8');
  });

  it('decodes the full map fixture', async () => {
    const hex =
      '87a46e616d65a474657374a5636f756e7403a5726174696fcb3fe0000000000000a47461677392a161a162a26f6bc3a5656d707479c0a3626967ce00010000';
    const out = await run(hex);
    expect(out.text).toContain('"name": "test"');
    expect(out.text).toContain('"count": 3');
    expect(out.text).toContain('"ratio": 0.5');
    expect(out.text).toContain('"ok": true');
    expect(out.text).toContain('"big": 65536');
    expect(out.text).toContain('"empty": null');
  });

  it('decodes base64 input', async () => {
    // base64 of the full fixture
    const out = await run(
      'h6RuYW1lpHRlc3SlY291bnQDpXJhdGlvyz/gAAAAAAAApHRhZ3OSoWGhYqJva8OlZW1wdHnAo2JpZ84AAQAA',
      { inputFormat: 'base64' },
    );
    expect(out.text).toContain('"count": 3');
  });

  it('shows the type breakdown', async () => {
    const hex =
      '87a46e616d65a474657374a5636f756e7403a5726174696fcb3fe0000000000000a47461677392a161a162a26f6bc3a5656d707479c0a3626967ce00010000';
    const out = await run(hex, { view: 'types' });
    expect(out.table).toBeDefined();
    const rows = out.table?.rows ?? [];
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('map')).toBe('1');
    expect(m.get('array')).toBe('1');
    expect(m.get('bool')).toBe('1');
    expect(m.get('nil')).toBe('1');
    expect(m.get('float')).toBe('1');
  });

  it('rejects invalid hex', async () => {
    await expect(run('!!')).rejects.toThrow(/hex|Invalid|input/i);
  });
});
