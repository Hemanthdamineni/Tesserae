import { describe, it, expect } from 'vitest';
import tool from './stl-inspector.tool';

const STL_B64 =
  'U1RMIGZpeHR1cmUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAAAAAACAPwAA' +
  'AAAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAAAAgL8AAIA/AAAAAAAAAAAAAABAAAAAAAAAAAAA' +
  'AIA/AACAPwAAAAAAAA==';

const ORACLE = {
  triangles: 2,
  vertices: 6,
  header: 'STL fixture',
  xRange: '0 to 2',
  yRange: '0 to 1',
  zRange: '0 to 0',
};

function fileOf(b64: string, name = 'model.stl'): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new File([bytes.buffer as ArrayBuffer], name, { type: 'model/stl' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('stl-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-STL file', async () => {
    const bad = new Uint8Array(20).fill(0xff);
    const b64 = btoa(String.fromCharCode(...bad));
    await expect(rowsOf(fileOf(b64, 'bad.bin'))).rejects.toThrow(/STL/i);
  });

  it('reads the summary', async () => {
    const t = await rowsOf(fileOf(STL_B64));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('Binary STL');
    expect(m.get('Header')).toBe(ORACLE.header);
    expect(m.get('Triangles')).toBe(String(ORACLE.triangles));
    expect(m.get('Vertices')).toBe(String(ORACLE.vertices));
    expect(m.get('X range')).toBe(ORACLE.xRange);
    expect(m.get('Y range')).toBe(ORACLE.yRange);
    expect(m.get('Z range')).toBe(ORACLE.zRange);
  });

  it('lists the triangles', async () => {
    const t = await rowsOf(fileOf(STL_B64), { format: 'triangles' });
    expect(t.rows).toHaveLength(ORACLE.triangles);
    expect(t.rows[0]?.[0]).toBe('1');
    expect(t.rows[0]?.[1]).toBe('0,0,0');
    expect(t.rows[1]?.[0]).toBe('2');
    expect(t.rows[1]?.[1]).toBe('1,0,0');
  });

  it('rejects a truncated triangle count', async () => {
    const full = atob(STL_B64);
    // patch the triangle count byte at offset 84 (in the header region no; triangle count is at 80)
    const bytes = new Uint8Array(full.length);
    for (let i = 0; i < full.length; i += 1) bytes[i] = full.charCodeAt(i);
    // corrupt: cut the file to half, so size != 84 + count*50
    const truncated = bytes.slice(0, 84 + 50); // one triangle worth, but count says 2
    const b64 = btoa(String.fromCharCode(...truncated));
    await expect(rowsOf(fileOf(b64, 'trunc.stl'))).rejects.toThrow(/size|triangle count/i);
  });
});
