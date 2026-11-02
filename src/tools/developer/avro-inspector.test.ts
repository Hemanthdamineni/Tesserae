import { describe, it, expect } from 'vitest';
import tool from './avro-inspector.tool';

const AVRO_B64 =
  'T2JqAQQWYXZyby5zY2hlbWGKAXsidHlwZSI6InJlY29yZCIsIm5hbWUiOiJUZXN0IiwiZmllbGRz' +
  'IjpbeyJuYW1lIjoieCIsInR5cGUiOiJsb25nIn1dfRRhdnJvLmNvZGVjCG51bGwAAAECAwQFBgcI' +
  'CQoLDA0ODwQECgAAAQIDBAUGBwgJCgsMDQ4P';

const ORACLE = {
  size: 141,
  codec: 'null',
  blocks: 1,
  records: 2,
  sync: '000102030405060708090a0b0c0d0e0f',
};

function fileOf(b64: string, name = 'data.avro'): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new File([bytes.buffer as ArrayBuffer], name, { type: 'application/octet-stream' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('avro-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-Avro file', async () => {
    const bad = new Uint8Array(30);
    bad[0] = 0x00;
    bad[1] = 0x01;
    bad[2] = 0x02;
    bad[3] = 0x03;
    const b64 = btoa(String.fromCharCode(...bad));
    await expect(tableOf(fileOf(b64, 'bad.bin'))).rejects.toThrow(/Obj|Avro/i);
  });

  it('reads the summary', async () => {
    const t = await tableOf(fileOf(AVRO_B64));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Codec')).toBe(ORACLE.codec);
    expect(m.get('Data blocks')).toBe('1');
    expect(m.get('Total records')).toBe('2');
    expect(m.get('Sync marker')).toBe(ORACLE.sync);
    expect(m.get('Schema')).toContain('Test');
  });

  it('shows the schema', async () => {
    const t = await tableOf(fileOf(AVRO_B64), { format: 'schema' });
    const flat = t.rows.map((r) => (r[0] ?? '') + '=' + (r[1] ?? '')).join('\n');
    expect(flat).toContain('Codec');
    expect(flat).toContain('record');
    expect(flat).toContain('long');
  });

  it('lists the data blocks', async () => {
    const t = await tableOf(fileOf(AVRO_B64), { format: 'blocks' });
    expect(t.rows).toHaveLength(ORACLE.blocks);
    expect(t.rows[0]?.[1]).toBe('2'); // records
    expect(t.rows[0]?.[3]).toBe('yes'); // sync ok
  });
});
