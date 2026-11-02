import { describe, it, expect } from 'vitest';
import tool from './pe-inspector.tool';

const PE_B64 =
  'TVoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAABQRQAATAECAAAAAF8AAAAAAAAAAOAAAgELAQ4XAAIAAAACAAAAAAAAABAA' +
  'AAAQAAAAIAAAAABAAAAQAAAAAgAABgAAAAAAAAAGAAAAAAAAAAAgAAAAAgAAAAAAAAMAQIEAABAA' +
  'ABAAAAAAEAAAEAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC50ZXh0AAAAABAAAAAQAAAAAgAAAAIA' +
  'AAAAAAAAAAAAAAAAACAAAGAuZGF0YQAAAAAQAAAAIAAAAAIAAAAEAAAAAAAAAAAAAAAAAAAgAABg' +
  '';

const ORACLE = {
  size: 456,
  format: 'PE32 (32-bit)',
  machine: 'Intel 80386',
  sections: 2,
  entry: '0x1000',
  imageBase: '0x400000',
  subsystem: 'Windows console',
};

function fileOf(b64: string, name = 'app.exe'): File {
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

describe('pe-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-PE file', async () => {
    const bad = new Uint8Array(70);
    bad[0] = 0x00;
    bad[1] = 0x01;
    await expect(tableOf(fileOf(btoa(String.fromCharCode(...bad)), 'bad.bin'))).rejects.toThrow(
      /MZ|PE/i,
    );
  });

  it('reads the summary', async () => {
    const t = await tableOf(fileOf(PE_B64));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe(ORACLE.format);
    expect(m.get('Machine')).toContain('80386');
    expect(m.get('Sections')).toBe('2');
    expect(m.get('Entry point')).toBe(ORACLE.entry);
    expect(m.get('Image base')).toBe(ORACLE.imageBase);
    expect(m.get('Subsystem')).toContain('console');
  });

  it('lists the sections', async () => {
    const t = await tableOf(fileOf(PE_B64), { format: 'sections' });
    expect(t.rows).toHaveLength(ORACLE.sections);
    expect(t.rows[0]?.[0]).toBe('.text');
    expect(t.rows[1]?.[0]).toBe('.data');
  });

  it('shows header fields', async () => {
    const t = await tableOf(fileOf(PE_B64), { format: 'headers' });
    const flat = t.rows.map((r) => (r[0] ?? '') + '=' + (r[1] ?? '')).join('\n');
    expect(flat).toContain('0x10b');
    expect(flat).toContain('Image base=0x400000');
    expect(flat).toContain('Section alignment=0x1000');
    expect(flat).toContain('File alignment=0x200');
  });
});
