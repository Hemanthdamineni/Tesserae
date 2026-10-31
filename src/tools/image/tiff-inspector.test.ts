import { describe, it, expect } from 'vitest';
import tool from './tiff-inspector.tool';

const TIFF_B64 =
  'SUkqAF4JAADyACv/AAD/AAD/AAD/AAD/AAD/AP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAP7/HAD//wD//wD//wD//wAA/wAA/wAA/wAA/wAA/wD//gD//wYA//8A//8A8P/yAAn/AAD/AAD/AAD//gD+/xsA//8A//8A//8A//8A/wAA/wAA/wAA/wAA/wAA/v8fAP//AP//AP//AP//AAD/AAD/AAD/AAD/AAD/AP8AAP/+AP//AwD//wDw//IABv8AAP8AAP/+AP//AAD+/xsA//8A//8A//8A//8A/wAA/wAA/wAA/wAA/wAA/v8iAP//AP//AP//AP//AAD/AAD/AAD/AAD/AAD/AP8AAP8AAP/+AP//AADw//IAA/8AAP/+AP//AwD//wD+/xsA//8A//8A//8A//8A/wAA/wAA/wAA/wAA/wAA/v8lAP//AP//AP//AP//AAD/AAD/AAD/AAD/AAD/AP8AAP8AAP8AAP/+APD/8gAD/wAA//4A//8DAP//AP7/GwD//wD//wD//wD//wD/AAD/AAD/AAD/AAD/AAD+/yUA//8A//8A//8A//8AAP8AAP8AAP8AAP8AAP8A/wAA/wAA/wAA//4A8P/yAAD//gD//wYA//8A//8A/v8bAP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAP7/KgD//wD//wD//wD//wAA/wAA/wAA/wAA/wAA/wD/AAD/AAD/AAD/AAD/AADy//IAAP/+AP//BgD//wD//wD+/xsA//8A//8A//8A//8A/wAA/wAA/wAA/wAA/wAA/v8qAP//AP//AP//AP//AAD/AAD/AAD/AAD/AAD/AP8AAP8AAP8AAP8AAP8AAPL/8QD//wkA//8A//8A//8A/v8bAP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAP7/KAD//wD//wD//wD//wAA/wAA/wAA/wAA/wAA/wD/AAD/AAD/AAD/AAD//AD1//EA//8JAP//AP//AP//AP7/GwD//wD//wD//wD//wD/AAD/AAD/AAD/AAD/AAD+/ygA//8A//8A//8A//8AAP8AAP8AAP8AAP8AAP8A/wAA/wAA/wAA/wAA//wA9f/xAP//CQD//wD//wD//wD+/xsA//8A//8A//8A//8A/wAA/wAA/wAA/wAA/wAA/v8oAP//AP//AP//AP//AAD/AAD/AAD/AAD/AAD/AP8AAP8AAP8AAP8AAP/8APX/8QD//wkA//8A//8A//8A/v8bAP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAP7/KAD//wD//wD//wD//wAA/wAA/wAA/wAA/wAA/wD/AAD/AAD/AAD/AAD//AD1//EA//8JAP//AP//AP//AP7/GwD//wD//wD//wD//wD/AAD/AAD/AAD/AAD/AAD+/ygA//8A//8A//8A//8AAP8AAP8AAP8AAP8AAP8A/wAA/wAA/wAA/wAA//wA9f/xAP//CQD//wD//wD//wD+/xsA//8A//8A//8A//8A/wAA/wAA/wAA/wAA/wAA/v8oAP//AP//AP//AP//AAD/AAD/AAD/AAD/AAD/AP8AAP8AAP8AAP8AAP/8APX/8QD//wkA//8A//8A//8A/v8bAP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAP7/KAD//wD//wD//wD//wAA/wAA/wAA/wAA/wAA/wD/AAD/AAD/AAD/AAD//AD1//EA//8JAP//AP//AP//AP7/GwD//wD//wD//wD//wD/AAD/AAD/AAD/AAD/AAD+/ygA//8A//8A//8A//8AAP8AAP8AAP8AAP8AAP8A/wAA/wAA/wAA/wAA//wA9f/xAP//CQD//wD//wD//wD+/xsA//8A//8A//8A//8A/wAA/wAA/wAA/wAA/wAA/v8oAP//AP//AP//AP//AAD/AAD/AAD/AAD/AAD/AP8AAP8AAP8AAP8AAP/8APX/8QD//wkA//8A//8A//8A/v8bAP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAP7/KAD//wD//wD//wD//wAA/wAA/wAA/wAA/wAA/wD/AAD/AAD/AAD/AAD//AD1//EA//8JAP//AP//AP//AP7/GwD//wD//wD//wD//wD/AAD/AAD/AAD/AAD/AAD+/ygA//8A//8A//8A//8AAP8AAP8AAP8AAP8AAP8A/wAA/wAA/wAA/wAA//wA9f93/wAA/yYA/0wA/3IA/5gA/74A/+QA9f8Az/8Aqf8Ag/8AXf8AN/8AEf8AAP8UAP86AP9gAP+GAP+sAP/SAP/4AOH/ALv/AJX/AG//AEn/ACP/AgD/KAD/TgD/dAD/mgD/wAD/5gD//wDz/wDN/wCn/wCB/wBb/wA1d/8AAP8mAP9MAP9yAP+YAP++AP/kAPX/AM//AKn/AIP/AF3/ADf/ABH/AAD/FAD/OgD/YAD/hgD/rAD/0gD/+ADh/wC7/wCV/wBv/wBJ/wAj/wIA/ygA/04A/3QA/5oA/8AA/+YA//8A8/8Azf8Ap/8Agf8AW/8ANXf/AAD/JgD/TAD/cgD/mAD/vgD/5AD1/wDP/wCp/wCD/wBd/wA3/wAR/wAA/xQA/zoA/2AA/4YA/6wA/9IA//gA4f8Au/8Alf8Ab/8ASf8AI/8CAP8oAP9OAP90AP+aAP/AAP/mAP//APP/AM3/AKf/AIH/AFv/ADV3/wAA/yYA/0wA/3IA/5gA/74A/+QA9f8Az/8Aqf8Ag/8AXf8AN/8AEf8AAP8UAP86AP9gAP+GAP+sAP/SAP/4AOH/ALv/AJX/AG//AEn/ACP/AgD/KAD/TgD/dAD/mgD/wAD/5gD//wDz/wDN/wCn/wCB/wBb/wA18gAG/wAA/wAA//4A//8AAP7/GwD//wD//wD//wD//wD/AAD/AAD/AAD/AAD/AAD+/yIA//8A//8A//8A//8AAP8AAP8AAP8AAP8AAP8A/wAA/wAA//4A//8AAPD/8gAJ/wAA/wAA/wAA//4A/v8bAP//AP//AP//AP//AP8AAP8AAP8AAP8AAP8AAP7/HwD//wD//wD//wD//wAA/wAA/wAA/wAA/wAA/wD/AAD//gD//wMA//8A8P8IAAgACABIAAAAAQAAAEgAAAABAAAATGF2YzYzLjEuMTAyAA4A/gAEAAEAAAAAAAAAAAEEAAEAAAAoAAAAAQEEAAEAAAAYAAAAAgEDAAMAAAA7CQAAAwEDAAEAAAAFgAAABgEDAAEAAAACAAAAEQEEAAEAAAAIAAAAFQEDAAEAAAADAAAAFgEEAAEAAABDAAAAFwEEAAEAAAAzCQAAGgEFAAEAAABBCQAAGwEFAAEAAABJCQAAKAEDAAEAAAACAAAAMQECAA0AAABRCQAAAAAAAA==';

// [offset, tag, name, type, count, value] from the Python oracle IFD walker.
const TIFF_IFD: [number, number, string, string, number, string][] = [
  [2400, 254, 'NewSubfileType', 'LONG', 1, '0'],
  [2412, 256, 'ImageWidth', 'LONG', 1, '40'],
  [2424, 257, 'ImageLength', 'LONG', 1, '24'],
  [2436, 258, 'BitsPerSample', 'SHORT', 3, 'off=2363'],
  [2448, 259, 'Compression', 'SHORT', 1, '32773'],
  [2460, 262, 'PhotometricInterpretation', 'SHORT', 1, '2'],
  [2472, 273, 'StripOffsets', 'LONG', 1, '8'],
  [2484, 277, 'SamplesPerPixel', 'SHORT', 1, '3'],
  [2496, 278, 'RowsPerStrip', 'LONG', 1, '67'],
  [2508, 279, 'StripByteCounts', 'LONG', 1, '2355'],
  [2520, 282, 'XResolution', 'RATIONAL', 1, 'off=2369'],
  [2532, 283, 'YResolution', 'RATIONAL', 1, 'off=2377'],
  [2544, 296, 'ResolutionUnit', 'SHORT', 1, '2'],
  [2556, 305, 'Software', 'ASCII', 13, 'off=2385'],
];

const TIFF_HEADER = { byte_order: 'II', magic: 42, ifd: 2398, entries: 14 };

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.tiff'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/tiff' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('tiff-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('matches the Python-oracle IFD entry offsets, tags, names, types, and counts', async () => {
    const rows = await rowsOf(fileOf(b64(TIFF_B64), 'img.tiff'), { view: 'ifd' });
    const got = rows.map((r) => [Number(r[0]), Number(r[1]), r[2] ?? '', r[3] ?? '', Number(r[4])]);
    const exp = TIFF_IFD.map((e) => [e[0], e[1], e[2], e[3], e[4]]);
    expect(got).toEqual(exp);
  });

  it('reads the header into the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(TIFF_B64), 'img.tiff'));
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Byte order')).toBe('little');
    expect(m.get('Magic')).toBe('valid (42)');
    expect(m.get('IFD entries')).toBe(String(TIFF_HEADER.entries));
    expect(m.get('Width')).toBe('40');
    expect(m.get('Height')).toBe('24');
  });

  it('decodes the compression, photometric, and resolution-unit tags', async () => {
    const rows = await rowsOf(fileOf(b64(TIFF_B64), 'img.tiff'), { view: 'ifd' });
    const comp = rows.find((r) => Number(r[1]) === 259);
    expect(comp?.[5]).toBe('PackBits (32773)');
    const photo = rows.find((r) => Number(r[1]) === 262);
    expect(photo?.[5]).toBe('RGB (2)');
    const unit = rows.find((r) => Number(r[1]) === 296);
    expect(unit?.[5]).toBe('inch (2)');
  });

  it('flags a bad TIFF magic', async () => {
    const rows = await rowsOf(fileOf(new Uint8Array([0x49, 0x49, 0x2a, 0x01]), 'bad.tiff'), {
      view: 'findings',
    });
    expect(rows.some((r) => r[1] === 'magic')).toBe(true);
  });

  it('flags an IFD offset beyond the file', async () => {
    const rows = await rowsOf(
      fileOf(new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0xff, 0xff, 0xff, 0x7f]), 'bad.tiff'),
      { view: 'findings' },
    );
    expect(rows.some((r) => r[1] === 'ifd')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/TIFF/);
  });
});
