import { describe, it, expect } from 'vitest';
import tool from './ico-inspector.tool';

const ICO_B64 =
  'AAABAAIAICAAAAEAIABPAQAAJgAAAAICAAABABgAPgAAAHUBAACJUE5HDQoaCgAAAA1JSERSAAAAIAAAACAIAgAAAPwY7aMAAAAJcEhZcwAAAAEAAAABAE8lxNYAAAEBSURBVHic7ZbZDcIwDIZtiXe6AWWDjMAqbAITsQojlA1gAhPHCXVDm6TqIYFqWVWOP/5ytKkRlJEqIw20q44S/Q5yRkioq6qGQZAYngKkR7YYj+wX9wOQqDPtAiNEGZgHfItGYaLhMWBK9A8DVJAOYHp0H4eXQTFg/LYXMfKv6UTzAJppc7TJIlZZwRLTF7OLWOsMNsAG2ABLA/T1Pa+tctnxzA3AGe2TDJebPdwBLsRP6w+onMK7/R/6juD1izuuQXGAZ6tA8x+H/OMAziTkSELyVwMcuylGnJvKaYb2xvnNVVziUxGcgN0BerEuQSvNTf0kBr6k1BZJVpvFiGBI9QYtoGs4j0gt/QAAAABJRU5ErkJggkJNPgAAAAAAAAAOAAAAKAAAAAIAAgABAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAAAAD/AAAA';

// [index, offset, w, h, colors, planes, bpp, size, dataOffset, format] from the Python oracle.
const ICO_ENTRIES: [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  string,
][] = [
  [0, 6, 32, 32, 0, 1, 32, 335, 38, 'PNG'],
  [1, 22, 2, 2, 0, 1, 24, 62, 373, 'BMP'],
];

const ICO_HEADER = { size: 435, reserved: 0, type: 1, count: 2 };

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.ico'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/x-icon' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('ico-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('matches the Python-oracle icon entries structurally', async () => {
    const rows = await rowsOf(fileOf(b64(ICO_B64), 'app.ico'));
    const got = rows.map((r) => [
      Number(r[0]),
      Number(r[1]),
      Number(r[2]),
      Number(r[3]),
      Number(r[4]),
      Number(r[5]),
      Number(r[6]),
      Number(r[7]),
      Number(r[8]),
    ]);
    const exp = ICO_ENTRIES.map((e) => [e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8]]);
    expect(got).toEqual(exp);
  });

  it('reads the header into the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(ICO_B64), 'app.ico'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Reserved')).toBe('0');
    expect(m.get('Type')).toBe('1 (icon)');
    expect(m.get('Images')).toBe(String(ICO_HEADER.count));
  });

  it('detects embedded PNG and BMP/DIB formats', async () => {
    const rows = await rowsOf(fileOf(b64(ICO_B64), 'app.ico'));
    expect(rows[0]?.[9]).toBe('PNG');
    expect(rows[1]?.[9]).toBe('BMP/DIB');
  });

  it('flags a non-icon type', async () => {
    const rows = await rowsOf(
      fileOf(
        new Uint8Array([0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        'bad.ico',
      ),
      { view: 'findings' },
    );
    expect(rows.some((r) => r[1] === 'type')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/\.ico/);
  });
});
