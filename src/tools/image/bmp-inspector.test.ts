import { describe, it, expect } from 'vitest';
import tool from './bmp-inspector.tool';

const BMP_24 = {
  b64: 'Qk12CwAAAAAAADYAAAAoAAAAKAAAABgAAAABABgAAAAAAEALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD/AAD///8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD///8A//8A//8A////////////////////AAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD///8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD///8A//8A////////////////////AAD/ACb/AEz/AHL/AJj/AL7/AOT/AP/1AP/PAP+pAP+DAP9dAP83AP8RFP8AOv8AYP8Ahv8ArP8A0v8A+P8A/+EA/7sA/5UA/28A/0kA/yMA/wAC/wAo/wBO/wB0/wCa/wDA/wDm8wD/zQD/pwD/gQD/WwD/NQD/AAD/ACb/AEz/AHL/AJj/AL7/AOT/AP/1AP/PAP+pAP+DAP9dAP83AP8RFP8AOv8AYP8Ahv8ArP8A0v8A+P8A/+EA/7sA/5UA/28A/0kA/yMA/wAC/wAo/wBO/wB0/wCa/wDA/wDm8wD/zQD/pwD/gQD/WwD/NQD/AAD/ACb/AEz/AHL/AJj/AL7/AOT/AP/1AP/PAP+pAP+DAP9dAP83AP8RFP8AOv8AYP8Ahv8ArP8A0v8A+P8A/+EA/7sA/5UA/28A/0kA/yMA/wAC/wAo/wBO/wB0/wCa/wDA/wDm8wD/zQD/pwD/gQD/WwD/NQD/AAD/ACb/AEz/AHL/AJj/AL7/AOT/AP/1AP/PAP+pAP+DAP9dAP83AP8RFP8AOv8AYP8Ahv8ArP8A0v8A+P8A/+EA/7sA/5UA/28A/0kA/yMA/wAC/wAo/wBO/wB0/wCa/wDA/wDm8wD/zQD/pwD/gQD/WwD/NQD/AAAAAAAAAAAAAAAAAAAA//8A//8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/AAAA////////////////AAAAAAAAAAAAAAAAAAAA//8A//8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/AAAA////////////////AAAAAAAAAAAAAAAAAAAA//8A//8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/AAAA////////////////AAAAAAAAAAAAAAAAAAAA//8A//8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/AAAA////////////////AAAAAAAAAAAAAAAAAAAA//8A//8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/AAAA////////////////AAAAAAAAAAAAAAAAAAAA//8A//8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/AAAA////////////////AAAAAAAAAAAAAAAAAAAA//8A//8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/AAAA////////////////AAAAAAAAAAAAAAAAAAAA//8A//8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/AAAA////////////////AAAAAAAAAAAAAAAAAAAA//8A//8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/AAAA////////////////AAAAAAAAAAAAAAAAAAAA//8A//8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/AAAA////////////////AAAAAAAAAAAAAAAAAAAA//8A//8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/AAAA////////////////AAAAAAAAAAAAAAAAAAAAAAD///8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/////////////////////AAAAAAAAAAAAAAAAAAAAAAD///8A//8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD/AAD/////////////////////AAAAAAAAAAAAAAAAAAAAAAD/AAD///8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD///8A////////////////////AAAAAAAAAAAAAAAAAAAAAAD/AAD///8A//8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD/AAD///8A////////////////////AAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD///8A//8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD/AAD///8A//8A////////////////////AAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD/AAD///8A/wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD/AAD///8A//8A//8A////////////////////AAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD/AAD/AAD//wD//wD//wD//wD//wD//wAA/wAA/wAA/wAA/wAAAP//AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAAD///8A//8A//8A//8A////////////////////',
  oracle: {
    sig: 'BM',
    file_size: 2934,
    pixel_offset: 54,
    dib_size: 40,
    width: 40,
    height: 24,
    planes: 1,
    bpp: 24,
    compression: 0,
    image_size: 2880,
    palette_entries: 0,
  },
};

const BMP_8 = {
  b64: 'Qk12AAAAAAAAAFYAAAAoAAAACAAAAAQAAAABAAgAAAAAACAAAAATCwAAEwsAAAgAAAAAAAAAAAAAACQ8WgBIeLQAbLQOAJDwaAC0LMIA2GgcAPykdgADBAUGBwABAgIDBAUGBwABAQIDBAUGBwAAAQIDBAUGBw==',
  oracle: {
    sig: 'BM',
    file_size: 118,
    pixel_offset: 86,
    dib_size: 40,
    width: 8,
    height: 4,
    planes: 1,
    bpp: 8,
    compression: 0,
    image_size: 32,
    colors_used: 8,
    palette_entries: 8,
  },
};

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.bmp'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/bmp' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('bmp-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('reads the header fields of a 24-bit BMP from the oracle', async () => {
    const rows = await rowsOf(fileOf(b64(BMP_24.b64), 'c.bmp'), { view: 'headers' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    const o = BMP_24.oracle;
    expect(m.get('File size')).toBe(String(o.file_size) + ' B');
    expect(m.get('Pixel-data offset')).toBe(String(o.pixel_offset));
    expect(m.get('DIB header size')).toBe(String(o.dib_size));
    expect(m.get('Width')).toBe(String(o.width));
    expect(m.get('Height')).toBe(String(o.height));
    expect(m.get('Planes')).toBe(String(o.planes));
    expect(m.get('Bits per pixel')).toBe(String(o.bpp));
    expect(m.get('Compression')).toBe('none (BI_RGB)');
    expect(m.get('Palette entries')).toBe('0');
  });

  it('decodes the color palette of an indexed 8-bit BMP', async () => {
    const rows = await rowsOf(fileOf(b64(BMP_8.b64), 'p.bmp'), { view: 'headers' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    const o = BMP_8.oracle;
    expect(m.get('Width')).toBe(String(o.width));
    expect(m.get('Height')).toBe(String(o.height));
    expect(m.get('Bits per pixel')).toBe(String(o.bpp));
    expect(m.get('Colors used')).toBe(String(o.colors_used));
    expect(m.get('Palette entries')).toBe(String(o.palette_entries));
  });

  it('builds a summary for a 24-bit BMP', async () => {
    const rows = await rowsOf(fileOf(b64(BMP_24.b64), 'c.bmp'));
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('Windows BMP');
    expect(m.get('Dimensions')).toBe('40 x 24 px');
    expect(m.get('Bit depth')).toBe('24 bpp');
    expect(m.get('Compression')).toBe('none (BI_RGB)');
    expect(m.get('Palette')).toBe('none');
  });

  it('flags a bad BMP signature', async () => {
    const rows = await rowsOf(fileOf(new Uint8Array([0x42, 0x41, 0, 0, 0, 0]), 'bad.bmp'), {
      view: 'findings',
    });
    expect(rows.some((r) => r[1] === 'magic')).toBe(true);
  });

  it('flags a truncated BMP with an overrunning image', async () => {
    const bytes = b64(BMP_24.b64);
    const cut = new Uint8Array(bytes.subarray(0, 60));
    const rows = await rowsOf(fileOf(cut, 'cut.bmp'), { view: 'findings' });
    expect(rows.some((r) => r[1] === 'overrun')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/BMP/);
  });
});
