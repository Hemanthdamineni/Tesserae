import { describe, it, expect } from 'vitest';
import tool from './webm-inspector.tool';

const WEBM_B64 =
  'GkXfo5FCgoR3ZWJtQoeCAAJChYIAAhhTgGejFUmpZp4q17GEAA9CQFdBk3dlYm0taW5zcGVjdG9y' + 'LXRlc3Q=' + '';

const ORACLE = {
  size: 62,
  doctype: 'webm',
  doctypeVersion: 2,
  doctypeReadVersion: 2,
  elements: 8,
  masters: 3,
};

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.webm'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'video/webm' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('webm-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-EBML file', async () => {
    const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]);
    await expect(tableOf(fileOf(bad, 'bad.bin'))).rejects.toThrow(/EBML/);
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(WEBM_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('62 B');
    expect(m.get('Document type')).toBe('webm');
    expect(m.get('DocTypeVersion')).toBe('2');
    expect(m.get('DocTypeReadVersion')).toBe('2');
    expect(m.get('Segment')).toBe('present');
    expect(m.get('Elements parsed')).toBe('8');
    expect(m.get('Master elements')).toBe('3');
  });

  it('reads the EBML header view', async () => {
    const t = await tableOf(fileOf(b64(WEBM_B64)), { view: 'header' });
    const names = t.rows.map((r) => (r[0] ?? '').trim());
    expect(names).toContain('EBML');
    expect(names).toContain('DocType');
    expect(names).toContain('DocTypeVersion');
    expect(names).toContain('DocTypeReadVersion');
  });

  it('walks the element tree', async () => {
    const t = await tableOf(fileOf(b64(WEBM_B64)), { view: 'tree' });
    const names = t.rows.map((r) => (r[0] ?? '').trim());
    expect(names[0]).toBe('EBML');
    expect(names.some((n) => n === 'Segment')).toBe(true);
    expect(names.some((n) => n === 'Info')).toBe(true);
    expect(names.some((n) => n === 'WritingApp')).toBe(true);
    expect(t.rows).toHaveLength(ORACLE.elements);
  });
});
