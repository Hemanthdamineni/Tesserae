import { describe, it, expect } from 'vitest';
import tool from './bson-decoder.tool';

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

const FIXTURE =
  '5b000000026e616d6500050000007465737400106e0005000000086f6b0001017069001f85eb51b81e0940097768656e0000000000000000000461727200130000001030000100000010310002000000000a6e6f7468696e670000';

const BSON_B64 =
  'WwAAAAJuYW1lAAUAAAB0ZXN0ABBuAAUAAAAIb2sAAQFwaQAfhetRuB4JQAl3aGVuAAAAAAAAAAAA' +
  'BGFycgATAAAAEDAAAQAAABAxAAIAAAAACm5vdGhpbmcAAA==' +
  '';

describe('bson-decoder', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('decodes the full fixture document', async () => {
    const out = await run(FIXTURE);
    const parsed = JSON.parse(out.text) as Record<string, unknown>;
    expect(parsed['name']).toBe('test');
    expect(parsed['n']).toBe(5);
    expect(parsed['ok']).toBe(true);
    expect(parsed['pi']).toBe(3.14);
    expect(parsed['when']).toContain('ISODate(');
    expect(parsed['arr']).toEqual([1, 2]);
    expect(parsed['nothing']).toBeNull();
  });

  it('decodes a boolean-only document', async () => {
    // { ok: true } -> 0a000000086f6b000100
    expect((await run('0a000000086f6b000100')).text).toContain('"ok": true');
  });

  it('decodes base64 input', async () => {
    const out = await run(BSON_B64, { inputFormat: 'base64' });
    const parsed = JSON.parse(out.text) as Record<string, unknown>;
    expect(parsed['name']).toBe('test');
    expect(parsed['arr']).toEqual([1, 2]);
  });

  it('shows the type breakdown', async () => {
    const out = await run(FIXTURE, { view: 'types' });
    expect(out.table).toBeDefined();
    const rows = out.table?.rows ?? [];
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('string')).toBe('1');
    expect(m.get('int32')).toBe('3');
    expect(m.get('boolean')).toBe('1');
    expect(m.get('double')).toBe('1');
    expect(m.get('datetime')).toBe('1');
    expect(m.get('array')).toBe('1');
    expect(m.get('null')).toBe('1');
    expect(m.get('total elements')).toBe('9');
  });

  it('rejects invalid input', async () => {
    await expect(run('!!')).rejects.toThrow(/Invalid|input|hex|base64/i);
  });
});
