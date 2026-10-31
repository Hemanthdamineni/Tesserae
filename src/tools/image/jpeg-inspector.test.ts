import { describe, it, expect } from 'vitest';
import tool from './jpeg-inspector.tool';

const JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4f' +
  'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj//wAARCAACAAQDASIAAhEBAxEB/8QAFAAB' +
  'AAAAAAAAAAAAAAAAAAAAAP/dAAQABP/aAAwDAQACEQMRAD8AJCQkJCQkJCT/2Q==' +
  '';

const ORACLE = {
  size: 160,
  width: 4,
  height: 2,
  precision: 8,
  components: 3,
  frame: 'SOF0 (baseline)',
  dqt: 1,
  dht: 1,
  restart: 4,
  jfifVersion: '1.01',
  jfifUnits: 'dpi',
  jfifDensity: '96x96',
  markers: 8,
};

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.jpg'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/jpeg' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('jpeg-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-JPEG file', async () => {
    await expect(tableOf(fileOf(new Uint8Array([1, 2, 3, 4]), 'bad.bin'))).rejects.toThrow(
      /JPEG|SOI/,
    );
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(JPEG_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('160 B');
    expect(m.get('EOI marker')).toBe('present');
    expect(m.get('Frame')).toContain('SOF0');
    expect(m.get('Precision')).toBe('8 bit');
    expect(m.get('Dimensions')).toBe('4x2');
    expect(m.get('Components')).toBe('3');
    expect(m.get('Quantisation tables')).toBe('1');
    expect(m.get('Huffman tables')).toBe('1');
    expect(m.get('Restart interval')).toBe('4');
    expect(m.get('JFIF version')).toBe('1.01');
    expect(m.get('Density units')).toBe('dpi');
    expect(m.get('Pixel density')).toBe('96x96');
  });

  it('lists all segments in order', async () => {
    const t = await tableOf(fileOf(b64(JPEG_B64)), { view: 'segments' });
    const names = t.rows.map((r) => r[3] ?? '');
    for (const n of ['SOI', 'APP0 (JFIF)', 'DQT', 'SOF0 (baseline)', 'DHT', 'DRI', 'SOS', 'EOI']) {
      expect(names).toContain(n);
    }
    expect(t.rows).toHaveLength(ORACLE.markers);
  });

  it('reports the SOF frame details', async () => {
    const t = await tableOf(fileOf(b64(JPEG_B64)), { view: 'segments' });
    const sof = t.rows.find((r) => (r[3] ?? '').startsWith('SOF0'));
    expect(sof?.[5]).toContain('8-bit');
    expect(sof?.[5]).toContain('4x2');
    expect(sof?.[5]).toContain('3 comps');
  });

  it('lists quantisation and Huffman tables', async () => {
    const t = await tableOf(fileOf(b64(JPEG_B64)), { view: 'tables' });
    const dqt = t.rows.filter((r) => (r[0] ?? '') === 'DQT');
    const dht = t.rows.filter((r) => (r[0] ?? '') === 'DHT');
    expect(dqt.length).toBeGreaterThanOrEqual(1);
    expect(dht.length).toBeGreaterThanOrEqual(1);
    expect(dqt[0]?.[1]).toBe('0');
  });
});
