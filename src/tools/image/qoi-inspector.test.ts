import { describe, it, expect } from 'vitest';
import tool from './qoi-inspector.tool';

const QOI_B64 = 'cW9pZgAAAAIAAAACAwD//wAA//4A/wD+AAD//v///wAAAAAAAAAB' + '';

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.qoi'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/x-qoi' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('qoi-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-QOI file', async () => {
    await expect(tableOf(fileOf(new Uint8Array(30), 'bad.bin'))).rejects.toThrow(/qoif/);
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(QOI_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('39 B');
    expect(m.get('Signature')).toBe('qoif');
    expect(m.get('Dimensions')).toBe('2 x 2 px');
    expect(m.get('Channels')).toBe('3 (RGB)');
    expect(m.get('Colorspace')).toBe('sRGB');
    expect(m.get('Expected pixels')).toBe('4');
    expect(m.get('Decoded pixels')).toBe('4');
    expect(m.get('Data bytes')).toBe('17 B');
    expect(m.get('End marker')).toBe('present');
  });

  it('reads the raw header fields', async () => {
    const t = await tableOf(fileOf(b64(QOI_B64)), { view: 'header' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Signature')).toBe('qoif');
    expect(m.get('Width')).toBe('2 px');
    expect(m.get('Height')).toBe('2 px');
    expect(m.get('Channels')).toBe('3 (RGB)');
    expect(m.get('Colorspace')).toBe('0 (sRGB)');
  });

  it('walks the pixel opcodes', async () => {
    const t = await tableOf(fileOf(b64(QOI_B64)), { view: 'opcodes' });
    expect(t.rows).toHaveLength(4);
    expect(t.rows[0]?.[1]).toBe('QOI_OP_RGBA');
    expect(t.rows[1]?.[1]).toBe('QOI_OP_RGB');
    expect(t.rows[2]?.[1]).toBe('QOI_OP_RGB');
    expect(t.rows[3]?.[1]).toBe('QOI_OP_RGB');
  });
});
