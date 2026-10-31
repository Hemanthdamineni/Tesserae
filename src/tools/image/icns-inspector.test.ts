import { describe, it, expect } from 'vitest';
import tool from './icns-inspector.tool';

const ICNS_B64 =
  'aWNucwAAAFBpY3A0AAAAJIlQTkcNChoKAAAAAAAAAAAAAAAAAAAAAAAAAABpYzEwAAAAJAAAAAxqUCAgDQqHCgAAAAAAAAAAAAAAAAAAAAA=';

const ICNS_HEADER = { size: 80, total: 80, nchunks: 2 };
const ICNS_CHUNKS: [number, number, string, number, number][] = [
  [0, 8, 'icp4', 36, 28],
  [1, 44, 'ic10', 36, 28],
];

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.icns'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/icns' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('icns-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('reads the header into the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(ICNS_B64), 'app.icns'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe(String(ICNS_HEADER.size) + ' B');
    expect(m.get('Magic')).toBe('icns (valid)');
    expect(m.get('Declared length')).toBe(String(ICNS_HEADER.total) + ' B');
    expect(m.get('Icon resources')).toBe(String(ICNS_HEADER.nchunks));
  });

  it('matches the Python-oracle icon chunks in order', async () => {
    const rows = await rowsOf(fileOf(b64(ICNS_B64), 'app.icns'), { view: 'chunks' });
    const got = rows.map((r) => [Number(r[0]), Number(r[1]), r[2], Number(r[4]), Number(r[5])]);
    expect(got).toEqual(ICNS_CHUNKS);
  });

  it('translates icon resource types', async () => {
    const rows = await rowsOf(fileOf(b64(ICNS_B64), 'app.icns'), { view: 'chunks' });
    const m = new Map<string, string>(rows.map((r) => [r[2] ?? '', r[3] ?? '']));
    expect(m.get('icp4')).toBe('PNG 16x16');
    expect(m.get('ic10')).toBe('PNG 32x32 (Retina)');
  });

  it('flags a bad magic', async () => {
    const rows = await rowsOf(fileOf(new Uint8Array([1, 2, 3, 4]), 'bad.icns'), {
      view: 'findings',
    });
    expect(rows.some((r) => r[1] === 'magic')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/ICNS/);
  });
});
