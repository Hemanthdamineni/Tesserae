import { describe, it, expect } from 'vitest';
import tool from './psd-inspector.tool';

const PSD_B64 =
  'OEJQUwEAAAAAAAAAAwAEAAAABAAAAAgAAwAAAAAAAAAAAAAAAAAAAAABAgMBAgMEAgMEBQMEBQYK' +
  'CwwNCwwNDgwNDg8NDg8QFBUWFxUWFxgWFxgZFxgZGg==' +
  '';

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.psd'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/vnd.adobe.photoshop' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('psd-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-PSD file', async () => {
    await expect(tableOf(fileOf(new Uint8Array(30), 'bad.bin'))).rejects.toThrow(/8BPS/);
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(PSD_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('88 B');
    expect(m.get('Signature')).toBe('8BPS');
    expect(m.get('Version')).toBe('1 (PSD)');
    expect(m.get('Dimensions')).toBe('4 x 4 px');
    expect(m.get('Channels')).toBe('3');
    expect(m.get('Bit depth')).toBe('8 bit');
    expect(m.get('Color mode')).toBe('RGB (3)');
    expect(m.get('Image data compression')).toBe('Raw');
    expect(m.get('Expected pixel data')).toBe('48 B');
  });

  it('reads the raw header fields', async () => {
    const t = await tableOf(fileOf(b64(PSD_B64)), { view: 'header' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Signature')).toBe('8BPS');
    expect(m.get('Version')).toBe('1 (PSD)');
    expect(m.get('Channels')).toBe('3');
    expect(m.get('Height')).toBe('4 px');
    expect(m.get('Width')).toBe('4 px');
    expect(m.get('Depth')).toBe('8 bit');
    expect(m.get('Color mode')).toBe('3 (RGB)');
  });

  it('lists the section lengths', async () => {
    const t = await tableOf(fileOf(b64(PSD_B64)), { view: 'sections' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Color mode data')).toBe('0 B');
    expect(m.get('Image resources')).toBe('0 B');
    expect(m.get('Layer and mask')).toBe('0 B');
    expect(m.get('Image data compression')).toBe('Raw');
  });
});
