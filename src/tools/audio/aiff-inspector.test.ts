import { describe, it, expect } from 'vitest';
import tool from './aiff-inspector.tool';

const AIFF_B64 =
  'Rk9STQAAAE5BSUZGQ09NTQAAABIAAgAArEQAEEAOLEQAAAAAAABTU05EAAAADAAAAAAAAAAAAAEC' +
  'A05BTUUAAAATQUlGRiBJbnNwZWN0b3IgVGVzdAA=' +
  '';
const ORACLE = {
  size: 86,
  type: 'AIFF',
  channels: 2,
  frames: 44100,
  sampleSize: 16,
  sampleRate: 44100,
  chunks: 3,
};

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.aiff'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'audio/aiff' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('aiff-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-AIFF file', async () => {
    const bad = new Uint8Array([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
      0x0f,
    ]);
    await expect(tableOf(fileOf(bad, 'bad.bin'))).rejects.toThrow(/FORM/);
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(AIFF_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('86 B');
    expect(m.get('FORM type')).toBe('AIFF');
    expect(m.get('Channels')).toBe('2');
    expect(m.get('Sample frames')).toBe('44100');
    expect(m.get('Sample size')).toBe('16 bit');
    expect(m.get('Sample rate')).toBe('44100 Hz');
    expect(m.get('Sound data')).toContain('4 B');
  });

  it('lists the chunks', async () => {
    const t = await tableOf(fileOf(b64(AIFF_B64)), { view: 'chunks' });
    expect(t.rows).toHaveLength(ORACLE.chunks);
    const ids = t.rows.map((r) => r[0] ?? '');
    expect(ids).toEqual(['COMM', 'SSND', 'NAME']);
    const nameRow = t.rows.find((r) => r[0] === 'NAME');
    expect(nameRow?.[2]).toBe('"AIFF Inspector Test"');
  });
});
