import { describe, it, expect } from 'vitest';
import tool from './pcapng-inspector.tool';

const PCAPNG_B64 =
  'Cg0NChwAAABNPCsaAQAAAP//////////HAAAAAEAAAAUAAAAAQAAAP//AAAUAAAABgAAACQAAAAA' +
  'AAAAAAAAAOgDAAAEAAAABAAAAKq7zN0kAAAABQAAABgAAAAAAAAAAAAAANAHAAAYAAAA' +
  '';

const ORACLE = {
  size: 108,
  byteOrder: 'little-endian',
  major: 1,
  minor: 0,
  sectionLength: -1,
  linkType: 1,
  linkName: 'Ethernet',
  snapLen: 65535,
  packetCount: 1,
  blockCount: 4,
  blocks: [
    ['0', '0A0D0D0A', 'Section Header Block (SHB)'],
    ['28', '00000001', 'Interface Description Block (IDB)'],
    ['48', '00000006', 'Enhanced Packet Block (EPB)'],
    ['84', '00000005', 'Interface Statistics Block (ISB)'],
  ],
};

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.pcapng'): File {
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

describe('pcapng-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-pcapng file', async () => {
    await expect(tableOf(fileOf(new Uint8Array(20), 'bad.bin'))).rejects.toThrow(/Section Header/);
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(PCAPNG_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('108 B');
    expect(m.get('Byte order')).toBe('little-endian');
    expect(m.get('Format version')).toBe('1.0');
    expect(m.get('Section length')).toBe('-1 (unspecified)');
    expect(m.get('Data-link type')).toBe('1 (Ethernet)');
    expect(m.get('Snap length')).toBe('65535');
    expect(m.get('Packets')).toBe('1');
    expect(m.get('Blocks')).toBe('4');
  });

  it('lists every block in order', async () => {
    const t = await tableOf(fileOf(b64(PCAPNG_B64)), { view: 'blocks' });
    expect(t.rows).toHaveLength(ORACLE.blockCount);
    for (const [off, type, name] of ORACLE.blocks) {
      const found = t.rows.find((r) => (r[0] ?? '') === off);
      expect(found?.[1]).toBe(type);
      expect(found?.[2]).toBe(name);
    }
  });

  it('decodes the interface link type', async () => {
    const t = await tableOf(fileOf(b64(PCAPNG_B64)), { view: 'blocks' });
    const idb = t.rows.find((r) => (r[0] ?? '') === '28');
    expect(idb?.[4]).toContain('Ethernet');
    expect(idb?.[4]).toContain('65535');
  });

  it('lists packet blocks', async () => {
    const t = await tableOf(fileOf(b64(PCAPNG_B64)), { view: 'packets' });
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]?.[0] ?? '').toBe('0');
    expect(t.rows[0]?.[1]).toBe('4');
    expect(t.rows[0]?.[2]).toBe('4');
  });
});
