import { describe, it, expect } from 'vitest';
import tool from './ogg-inspector.tool';

const OGG_B64 =
  'T2dnUwACAAAAAAAAAADSBAAAAAAAAAAAAAAC/xYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAT2dnUwAAoAAAAAAAAADSBAAAAQAAAAAAAAABKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

const OGG_HEADER = { size: 374, version: 0, npage: 2 };
const OGG_PAGES: [number, number, number, string, number, number, number, number, number][] = [
  [0, 0, 2, 'BOS', 0, 1234, 0, 2, 277],
  [1, 306, 0, 'normal', 160, 1234, 1, 1, 40],
];

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.ogg'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'audio/ogg' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('ogg-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('reads the header into the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(OGG_B64), 'song.ogg'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe(String(OGG_HEADER.size) + ' B');
    expect(m.get('Capture pattern')).toBe('OggS (valid)');
    expect(m.get('Stream version')).toBe(String(OGG_HEADER.version));
    expect(m.get('Pages')).toBe(String(OGG_HEADER.npage));
  });

  it('matches the Python-oracle pages in order', async () => {
    const rows = await rowsOf(fileOf(b64(OGG_B64), 'song.ogg'), { view: 'pages' });
    const got = rows.map((r) => [
      Number(r[0]),
      Number(r[1]),
      Number(r[2]),
      r[3],
      Number(r[4]),
      Number(r[5]),
      Number(r[6]),
      Number(r[7]),
      Number(r[8]),
    ]);
    expect(got).toEqual(OGG_PAGES);
  });

  it('decodes header-type flags', async () => {
    const rows = await rowsOf(fileOf(b64(OGG_B64), 'song.ogg'), { view: 'pages' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[3] ?? '']));
    expect(m.get('0')).toBe('BOS');
    expect(m.get('1')).toBe('normal');
  });

  it('flags a bad capture pattern', async () => {
    const rows = await rowsOf(fileOf(new Uint8Array([1, 2, 3, 4]), 'bad.ogg'), {
      view: 'findings',
    });
    expect(rows.some((r) => r[1] === 'magic')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Ogg/);
  });
});
