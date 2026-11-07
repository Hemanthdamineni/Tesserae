import { describe, it, expect } from 'vitest';
import tool from './exr-inspector.tool';

const EXR_B64 =
  'di8xAQICAABjaGFubmVscwBjaGxpc3QAEwAAAFkAAQAAAAAAAAABAAAAAQAAAABjb21wcmVzc2lv' +
  'bgBjb21wcmVzc2lvbgABAAAAAGRhdGFXaW5kb3cAYm94MmkAEAAAAAAAAAAAAAAAAAAAAAAAAABk' +
  'aXNwbGF5V2luZG93AGJveDJpABAAAAAAAAAAAAAAAAAAAAAAAAAAbGluZU9yZGVyAGxpbmVPcmRl' +
  'cgABAAAAAHBpeGVsQXNwZWN0UmF0aW8AZmxvYXQABAAAAAAAgD9zY3JlZW5XaW5kb3dDZW50ZXIA' +
  'djJmAAgAAAAAAAAAAAAAAHNjcmVlbldpbmRvd1dpZHRoAGZsb2F0AAQAAAAAAIA/AB0BAAAAAAAA' +
  'AAAAAAIAAAAAOA==';

const ORACLE = {
  version: 2,
  layout: 'Tiled',
  dims: '1\u00d71',
  channels: 1,
  names: 'Y',
  compression: 'None',
  deep: 'no',
  multi: 'no',
};

function fileOf(b64: string, name = 'image.exr'): File {
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

describe('exr-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-EXR file', async () => {
    const bad = new Uint8Array(30);
    bad[0] = 0x00;
    bad[1] = 0x01;
    bad[2] = 0x02;
    bad[3] = 0x03;
    const b64 = btoa(String.fromCharCode(...bad));
    await expect(tableOf(fileOf(b64, 'bad.bin'))).rejects.toThrow(/OpenEXR/i);
  });

  it('reads the summary', async () => {
    const t = await tableOf(fileOf(EXR_B64));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('OpenEXR');
    expect(m.get('Version')).toBe(String(ORACLE.version));
    expect(m.get('Layout')).toBe(ORACLE.layout);
    expect(m.get('Dimensions')).toBe(ORACLE.dims);
    expect(m.get('Channels')).toBe(String(ORACLE.channels));
    expect(m.get('Channel names')).toBe(ORACLE.names);
    expect(m.get('Compression')).toBe(ORACLE.compression);
    expect(m.get('Deep data')).toBe(ORACLE.deep);
    expect(m.get('Multi-part')).toBe(ORACLE.multi);
  });

  it('lists the channels', async () => {
    const t = await tableOf(fileOf(EXR_B64), { format: 'channels' });
    expect(t.rows).toHaveLength(ORACLE.channels);
    expect(t.rows[0]?.[0]).toBe('Y');
    expect(t.rows[0]?.[1]).toBe('HALF');
    expect(t.rows[0]?.[2]).toBe('1/1');
  });

  it('lists the attributes', async () => {
    const t = await tableOf(fileOf(EXR_B64), { format: 'attributes' });
    const names = t.rows.map((r) => r[0]);
    expect(names).toContain('channels');
    expect(names).toContain('compression');
    expect(names).toContain('dataWindow');
    expect(names).toContain('displayWindow');
  });
});
