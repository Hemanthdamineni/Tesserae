import { describe, it, expect } from 'vitest';
import tool from './gif-inspector.tool';

const GIF_B64 =
  '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';

// [offset, kind] from the Python oracle block walker.
const GIF_ORACLE: [number, string][] = [
  [781, 'application'],
  [800, 'graphic-control'],
  [808, 'image'],
  [1843, 'graphic-control'],
  [1851, 'image'],
  [2477, 'graphic-control'],
  [2485, 'image'],
  [3085, 'graphic-control'],
  [3093, 'image'],
  [3720, 'graphic-control'],
  [3728, 'image'],
  [4412, 'trailer'],
];

const GIF_ORACLE_HEADER = {
  sig: 'GIF89a',
  w: 64,
  h: 64,
  gct: true,
  gctEntries: 256,
  bg: 31,
  colorRes: 8,
  frames: 5,
};

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.gif'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/gif' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('gif-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('matches the Python-oracle block tree of the animated GIF', async () => {
    const rows = await rowsOf(fileOf(b64(GIF_B64), 'anim.gif'));
    const got = rows.map((r) => [Number(r[0]), r[1] ?? '']);
    expect(got).toEqual(GIF_ORACLE);
  });

  it('reads the header into the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(GIF_B64), 'anim.gif'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Signature')).toBe('GIF89a');
    expect(m.get('Canvas')).toBe('64 x 64 px');
    expect(m.get('Global color table')).toBe('yes (256 entries)');
    expect(m.get('Color resolution')).toBe('8 bits');
    expect(m.get('Frames')).toBe(String(GIF_ORACLE_HEADER.frames));
    expect(m.get('Trailer')).toBe('present');
    expect(m.get('Global color table')).toBe(
      GIF_ORACLE_HEADER.gct ? 'yes (' + GIF_ORACLE_HEADER.gctEntries + ' entries)' : 'no',
    );
    expect(m.get('Canvas')).toBe(GIF_ORACLE_HEADER.w + ' x ' + GIF_ORACLE_HEADER.h + ' px');
  });

  it('decodes the NETSCAPE application extension and graphic-controls', async () => {
    const rows = await rowsOf(fileOf(b64(GIF_B64), 'anim.gif'));
    const app = rows.find((r) => Number(r[0]) === 781);
    expect(app?.[1]).toBe('application');
    expect(app?.[2]).toContain('NETSCAPE');
    const gce = rows.find((r) => Number(r[0]) === 800);
    expect(gce?.[1]).toBe('graphic-control');
    expect(gce?.[2]).toContain('delay 20cs');
    expect(gce?.[2]).toContain('disposal 1');
  });

  it('flags a missing GIF magic header', async () => {
    const rows = await rowsOf(
      fileOf(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]), 'bad.gif'),
      { view: 'findings' },
    );
    expect(rows.some((r) => r[1] === 'magic')).toBe(true);
  });

  it('flags a truncated GIF missing its trailer', async () => {
    const bytes = b64(GIF_B64);
    const cut = new Uint8Array(bytes.subarray(0, 4000));
    const rows = await rowsOf(fileOf(cut, 'cut.gif'), { view: 'findings' });
    expect(rows.some((r) => r[1] === 'trailer')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/GIF/);
  });
});
