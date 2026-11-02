import { describe, it, expect } from 'vitest';
import tool from './protobuf-decoder.tool';

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

const FIXTURE = '089601120361626319000000000000f03f2202aabb2d04030201';

describe('protobuf-decoder', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('decodes the full fixture message', async () => {
    const out = await run(FIXTURE);
    const parsed = JSON.parse(out.text) as Record<string, unknown>;
    expect(parsed['1']).toBe(150); // varint
    expect(parsed['2']).toBe('abc'); // length-delimited string
    expect(parsed['3']).toBe(1); // 64-bit double 1.0
    expect(parsed['4']).toBe('aabb'); // length-delimited bytes -> hex
    expect(parsed['5']).toBe(16909060); // 32-bit fixed 0x01020304
  });

  it('decodes a scalar varint', async () => {
    // field 1 wire type 0, value 1
    expect((await run('0801')).text).toContain('"1": 1');
  });

  it('decodes a length-delimited string', async () => {
    // field 2, "abc"
    expect((await run('1203616263')).text).toContain('"2": "abc"');
  });

  it('decodes base64 input', async () => {
    // base64 of the full fixture
    const b64 = 'CJYBEgNhYmMZAAAAAAAA8D8iAqq7LQQDAgE=';
    const out = await run(b64, { inputFormat: 'base64' });
    const parsed = JSON.parse(out.text) as Record<string, unknown>;
    expect(parsed['1']).toBe(150);
  });

  it('shows the field breakdown', async () => {
    const out = await run(FIXTURE, { view: 'fields' });
    expect(out.table).toBeDefined();
    const rows = out.table?.rows ?? [];
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('varint')).toBe('1');
    expect(m.get('64-bit')).toBe('1');
    expect(m.get('length-delimited')).toBe('2');
    expect(m.get('32-bit')).toBe('1');
    expect(m.get('total fields')).toBe('5');
  });

  it('rejects invalid input', async () => {
    await expect(run('!!')).rejects.toThrow(/Invalid|input|hex|base64/i);
  });
});
