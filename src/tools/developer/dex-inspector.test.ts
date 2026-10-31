import { describe, it, expect } from 'vitest';
import tool from './dex-inspector.tool';

const DEX_B64 =
  'ZGV4CjAzNQBZEbPT8RThgQI2ym556xc9c7lscGl/S0SPAAAAcAAAAHhWNBIAAAAAAAAAAAAAAAAD' +
  'AAAAcAAAAAEAAAB8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPAAAAgAAAAIAA' +
  'AACJAAAAjAAAAAAAAAAHTEhlbGxvOwABVgABSQA=' +
  '';

const ORACLE = {
  size: 143,
  version: '035',
  checksum: '0xd3b31159',
  stringIds: 3,
  typeIds: 1,
  protoIds: 0,
  fieldIds: 0,
  methodIds: 0,
  classDefs: 0,
  endian: 'little',
  strings: ['LHello;', 'V', 'I'],
  types: ['LHello;'],
};

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.dex'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'application/octet-stream' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('dex-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-DEX file', async () => {
    await expect(tableOf(fileOf(new Uint8Array([1, 2, 3, 4]), 'bad.bin'))).rejects.toThrow(/DEX/);
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(DEX_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('143 B');
    expect(m.get('DEX version')).toBe('035');
    expect(m.get('Checksum (Adler-32)')).toBe('0xd3b31159 OK');
    expect(m.get('String IDs')).toBe('3 @ 0x00000070');
    expect(m.get('Type IDs')).toBe('1 @ 0x0000007c');
    expect(m.get('Proto IDs')).toBe('0 @ 0x00000000');
    expect(m.get('Endian tag')).toContain('little');
    expect(m.get('Declared size')).toBe('143 B');
  });

  it('lists the string table', async () => {
    const t = await tableOf(fileOf(b64(DEX_B64)), { view: 'strings' });
    const strs = t.rows.map((r) => r[1] ?? '');
    expect(strs).toEqual(['LHello;', 'V', 'I']);
  });

  it('resolves type descriptors', async () => {
    const t = await tableOf(fileOf(b64(DEX_B64)), { view: 'types' });
    const types = t.rows.map((r) => r[1] ?? '');
    expect(types).toContain('LHello;');
  });

  it('reports a checksum mismatch for a corrupt file', async () => {
    const bytes = b64(DEX_B64);
    bytes[40] = 0x00; // corrupt endian_tag byte region
    const t = await tableOf(fileOf(bytes), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Checksum (Adler-32)')).toContain('MISMATCH');
  });
});
