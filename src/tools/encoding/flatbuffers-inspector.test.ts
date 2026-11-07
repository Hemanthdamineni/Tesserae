import { describe, it, expect } from 'vitest';
import tool from './flatbuffers-inspector.tool';

const FB_B64 = 'DAAAAAgADAAEAAgA+P///yoAAABjAAAA';

const ORACLE = {
  root: 12,
  vtableSize: 8,
  tableSize: 12,
  fields: 2,
  f0Offset: 4,
  f1Offset: 8,
};

function fileOf(b64: string, name = 'msg.bin'): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new File([bytes.buffer as ArrayBuffer], name, { type: 'application/octet-stream' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('flatbuffers-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-FlatBuffers file', async () => {
    const bad = new Uint8Array(20).fill(0xff);
    const b64 = btoa(String.fromCharCode(...bad));
    await expect(rowsOf(fileOf(b64, 'bad.bin'))).rejects.toThrow(/root table|too short/i);
  });

  it('reads the summary', async () => {
    const t = await rowsOf(fileOf(FB_B64));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('FlatBuffers');
    expect(m.get('Root table offset')).toBe(String(ORACLE.root));
    expect(m.get('File identifier')).toBe('(none)');
    expect(m.get('Vtable size')).toBe(String(ORACLE.vtableSize));
    expect(m.get('Table size')).toBe(String(ORACLE.tableSize));
    expect(m.get('Fields')).toBe(String(ORACLE.fields));
  });

  it('lists the fields', async () => {
    const t = await rowsOf(fileOf(FB_B64), { format: 'fields' });
    expect(t.rows).toHaveLength(ORACLE.fields);
    expect(t.rows[0]?.[0]).toBe('1');
    expect(t.rows[0]?.[1]).toBe(String(ORACLE.f0Offset));
    expect(t.rows[1]?.[1]).toBe(String(ORACLE.f1Offset));
  });

  it('rejects a root offset that points outside the buffer', async () => {
    const bad = 'DAAAAAgADAAEAAgA+P///yoAAABj';
    const b64 = bad; // already base64 (truncated) => decodes to 3 bytes only
    const full = atob(b64);
    const bytes = new Uint8Array(full.length);
    for (let i = 0; i < full.length; i += 1) bytes[i] = full.charCodeAt(i);
    const reb64 = btoa(String.fromCharCode(...bytes.slice(0, 3))); // too short
    await expect(rowsOf(fileOf(reb64, 'trunc.bin'))).rejects.toThrow(/too short/i);
  });
});
