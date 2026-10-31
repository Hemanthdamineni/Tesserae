import { describe, it, expect } from 'vitest';
import tool from './dicom-inspector.tool';

const DICOM_B64 =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAABESUNNAgAAAFVMBAAqAAAAAgABAE9CAAACAAAAAAECABAAVUkUADEuMi44' +
  'NDAuMTAwMDguMS4yLjEACABgAENTAgBPVBAAEABQTggARG9lXkpvaG4gABMASVMBADHgfxAAT0IA' +
  'ABAAAAAAAQIDBAUGBwgJCgsMDQ4P' +
  '';

const ORACLE = {
  size: 249,
  preamble: 'all zero',
  dicm: 'present',
  transferSyntax: '1.2.840.10008.1.2.1',
  modality: 'OT',
  patientName: 'Doe^John',
  instanceNumber: '1',
  pixelDataLen: 16,
  elementCount: 7,
};

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.dcm'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'application/dicom' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('dicom-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-DICOM file', async () => {
    await expect(tableOf(fileOf(new Uint8Array(132), 'bad.bin'))).rejects.toThrow(/DICOM/);
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(DICOM_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('249 B');
    expect(m.get('Preamble')).toBe('all zero');
    expect(m.get('DICM prefix')).toBe('present');
    expect(m.get('Transfer syntax')).toBe('1.2.840.10008.1.2.1');
    expect(m.get('Modality')).toBe('OT');
    expect(m.get('Patient name')).toBe('Doe^John');
    expect(m.get('Pixel data length')).toBe('16 B');
    expect(m.get('Elements')).toBe('7');
  });

  it('lists all data elements', async () => {
    const t = await tableOf(fileOf(b64(DICOM_B64)), { view: 'elements' });
    const tags = t.rows.map((r) => r[0] ?? '');
    for (const tg of [
      '0002,0000',
      '0002,0010',
      '0008,0060',
      '0010,0010',
      '0020,0013',
      '7FE0,0010',
    ]) {
      expect(tags).toContain(tg);
    }
    expect(t.rows).toHaveLength(ORACLE.elementCount);
    const pixel = t.rows.find((r) => (r[0] ?? '') === '7FE0,0010');
    expect(pixel?.[1]).toBe('OB');
    expect(pixel?.[2]).toBe('16');
  });

  it('resolves the modality and patient name values', async () => {
    const t = await tableOf(fileOf(b64(DICOM_B64)), { view: 'elements' });
    const mod = t.rows.find((r) => (r[0] ?? '') === '0008,0060');
    expect(mod?.[3]).toBe('OT');
    const pat = t.rows.find((r) => (r[0] ?? '') === '0010,0010');
    expect(pat?.[3]).toBe('Doe^John');
  });

  it('lists only the meta group in meta view', async () => {
    const t = await tableOf(fileOf(b64(DICOM_B64)), { view: 'meta' });
    for (const r of t.rows) {
      expect(r[0] ?? '').toMatch(/^0002,/);
    }
    expect(t.rows.length).toBeGreaterThanOrEqual(2);
  });
});
