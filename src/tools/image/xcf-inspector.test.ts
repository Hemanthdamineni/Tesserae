import { describe, it, expect } from 'vitest';
import tool from './xcf-inspector.tool';

const XCF_B64 =
  'Z2ltcCB4Y2YgZmlsZSB2ZXJzaW9uIDAsIGZpbGUgdHlwZSB4Y2YAAAAAeAAAAFAAAAAAAAAAEQAA' +
  'AAQAAAAAAAAAAAAAAAA=' +
  '';

const ORACLE = {
  size: 71,
  width: 120,
  height: 80,
  baseType: 'RGB',
  props: 1,
};

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.xcf'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/x-xcf' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('xcf-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-XCF file', async () => {
    const bad = new Uint8Array(80);
    bad[0] = 0x00;
    bad[1] = 0x01;
    bad[2] = 0x02;
    bad[3] = 0x03;
    await expect(tableOf(fileOf(bad, 'bad.bin'))).rejects.toThrow(/gimp xcf/);
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(XCF_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('71 B');
    expect(m.get('Version')).toBe('file version 0, file type xcf');
    expect(m.get('Width')).toBe('120 px');
    expect(m.get('Height')).toBe('80 px');
    expect(m.get('Base type')).toBe('RGB');
    expect(m.get('Properties')).toBe('1');
  });

  it('lists the properties', async () => {
    const t = await tableOf(fileOf(b64(XCF_B64)), { view: 'properties' });
    expect(t.rows).toHaveLength(ORACLE.props);
    expect(t.rows[0]?.[0]).toBe('compression');
    expect(t.rows[0]?.[3]).toBe('RLE');
  });
});
