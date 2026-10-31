import { describe, it, expect } from 'vitest';
import tool from './png-chunk-inspector.tool';

const META = tool.meta;

/** Base64 to bytes. */
function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.png'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/png' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

async function summaryOf(f: File): Promise<Map<string, string>> {
  const rows = await rowsOf(f, { view: 'summary' });
  return new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

async function findingsOf(f: File): Promise<string[][]> {
  return rowsOf(f, { view: 'findings' });
}

function chunkTable(rows: string[][]): [number, number, string, string][] {
  return rows.map((r) => [Number(r[0]), Number(r[2]), r[1] ?? '', r[3] ?? '']);
}

interface Fixture {
  name: string;
  b64: string;
  bytes: number;
  rawSize: number;
  chunks: [number, number, string, string][];
  ihdr: [number, number, number, number, number, number];
  note: string;
}
type FixtureTuple = [Fixture, Fixture, Fixture, Fixture, Fixture, Fixture];
const FIXTURES: FixtureTuple = [
  {
    name: 'rgb_4x4',
    b64: 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAKUlEQVR4nA3HMQEAAAzCMIQhDGEVUVlbviSxcZGY1NZV+pmdm+yDxSF4F/IXwWmvaVAAAAAASUVORK5CYII=',
    bytes: 98,
    rawSize: 52,
    chunks: [
      [8, 13, 'IHDR', 'ok'],
      [33, 41, 'IDAT', 'ok'],
      [86, 0, 'IEND', 'ok'],
    ],
    ihdr: [4, 4, 8, 2, 0, 3],
    note: 'plain 8-bit RGB',
  },
  {
    name: 'rgba_meta_8x8',
    b64: 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAZdEVYdFNvZnR3YXJlAHRvb2xiZW5jaCBvcmFjbGXG2QFeAAAAB3RJTUUH6gECAwQF+iL8rQAAAF5JREFUeJwVyjEBBDEIALAqqRKUML8IlKAEJRi6T4dsOef8vkuQFM2wnHMFgqRohr0vhECQFM2w8UIKBEnRDJsvlECQFM2w9UILBEnRDNsvjECQFM2w88IKBEnRDMsf8WaNQSZTRScAAAAASUVORK5CYII=',
    bytes: 257,
    rawSize: 264,
    chunks: [
      [8, 13, 'IHDR', 'ok'],
      [33, 4, 'gAMA', 'ok'],
      [49, 1, 'sRGB', 'ok'],
      [62, 9, 'pHYs', 'ok'],
      [83, 25, 'tEXt', 'ok'],
      [120, 7, 'tIME', 'ok'],
      [139, 94, 'IDAT', 'ok'],
      [245, 0, 'IEND', 'ok'],
    ],
    ihdr: [8, 8, 8, 6, 0, 8],
    note: 'RGBA with gAMA/sRGB/pHYs/tEXt/tIME',
  },
  {
    name: 'palette_4x4',
    b64: 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAMAAACeL25MAAAADFBMVEX/AAAA/wAAAP///wDWAo97AAAABHRSTlP/gAD/oaGUZgAAABRJREFUeJxjYGBkYgZjBhDNAGIDAAEEABlCe5GMAAAAAElFTkSuQmCC',
    bytes: 117,
    rawSize: 20,
    chunks: [
      [8, 13, 'IHDR', 'ok'],
      [33, 12, 'PLTE', 'ok'],
      [57, 4, 'tRNS', 'ok'],
      [73, 20, 'IDAT', 'ok'],
      [105, 0, 'IEND', 'ok'],
    ],
    ihdr: [4, 4, 8, 3, 0, 5],
    note: 'palette with tRNS',
  },
  {
    name: 'gray16_4x4',
    b64: 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAEEAAAAADcCh3hAAAAI0lEQVR4nA3FMQEAAAyDMPwrQgYyKmPLE2CE/Ftz0CoDZ+oBMdMTga4hAXEAAAAASUVORK5CYII=',
    bytes: 92,
    rawSize: 36,
    chunks: [
      [8, 13, 'IHDR', 'ok'],
      [33, 35, 'IDAT', 'ok'],
      [80, 0, 'IEND', 'ok'],
    ],
    ihdr: [4, 4, 16, 0, 0, 3],
    note: '16-bit grayscale',
  },
  {
    name: 'split_idat_16x16',
    b64: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAx0lEQVR4nA3LkRpAIQyA0XAYDodh30/DMBwOwzDc4997/LTWkEZvaMMaozEb3liN3YhGNk7jNl6jGq0JInRBBROGMAUXlrCFEFI4whWeUPKHjnR6RzvWGZ3Z8c7q7E50snM6t/M61f+giNIVVUwZylRcWcpWQknlKFd5SukfDDG6oYYZw5iGG8vYRhhpHOMazyj7w0AGfaADG4zBHPhgDfYgBjk4gzt4gxp/mMikT3RikzGZE5+syZ7EJCdncidvUvMPjjjdUcec4UzHbdxXfAAAAMhJREFUneVsJ5x0jnOd55T/YSGLvtCFLcZiLnyxFnsRi1ycxV28Ra0/bGTTN7qxzdjMjW/WZm9ik5uzuZu3qf2HQIIeaGDBCGbgwQp2EEEGJ7jBCyr+kEjSE00sGclMPFnJTiLJ5CQ3eUnlHw5y6Ac92GEc5sEP67APccjDOdzDO9T5w0Uu/aIXu4zLvPhlXfYlLnk5l3t5l7p/eMijP/Rhj/GYD3+sx37EIx/ncR/vUe8PhRS90MKKUczCi1XsIoosTnGLV1TxAeI/qgHEz1OuAAAAAElFTkSuQmCC',
    bytes: 468,
    rawSize: 784,
    chunks: [
      [8, 13, 'IHDR', 'ok'],
      [33, 199, 'IDAT', 'ok'],
      [244, 200, 'IDAT', 'ok'],
      [456, 0, 'IEND', 'ok'],
    ],
    ihdr: [16, 16, 8, 2, 0, 4],
    note: 'IDAT split across two chunks',
  },
  {
    name: 'interlaced_8x8',
    b64: 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAAE8ahlKAAAAcklEQVR4nA2MMREAQAzCKgIRFVERnTMjoiIQ/T8w5AJUFbU/texSXdynXu5TNd1sc/3h6GOPO0rFFC7y22qmcZNf0zKLl/wDHXP4yN+UkGgxYoXFieiLQUMPM+zg4YbMF0amzZg1NmfiL4JChwkbHC4kPPV1OYHZGyxpAAAAAElFTkSuQmCC',
    bytes: 171,
    rawSize: 207,
    chunks: [
      [8, 13, 'IHDR', 'ok'],
      [33, 114, 'IDAT', 'ok'],
      [159, 0, 'IEND', 'ok'],
    ],
    ihdr: [8, 8, 8, 2, 1, 3],
    note: 'Adam7 interlaced RGB',
  },
];

describe('png-chunk-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('matches the zlib-verified chunk table for every fixture', async () => {
    for (const f of FIXTURES) {
      const rows = await rowsOf(fileOf(b64(f.b64), f.name + '.png'));
      expect(chunkTable(rows)).toEqual(f.chunks);
    }
  });

  it('decodes the IHDR summary from every fixture', async () => {
    for (const f of FIXTURES) {
      const rows = await rowsOf(fileOf(b64(f.b64), f.name + '.png'));
      // IHDR is the first row; offset, type, length
      expect(rows[0]?.[1]).toBe('IHDR');
      expect(rows[0]?.[2]).toBe('13');
      const s = await summaryOf(fileOf(b64(f.b64), f.name + '.png'));
      expect(s.get('Dimensions')).toBe(f.ihdr[0] + ' x ' + f.ihdr[1] + ' px');
      expect(s.get('Bit depth')).toBe(f.ihdr[2] + ' bit');
    }
  });

  it('reports the decompressed data size matching the expected scanline size', async () => {
    for (const f of FIXTURES) {
      const s = await summaryOf(fileOf(b64(f.b64), f.name + '.png'));
      expect(s.get('Decompressed data')).toBe(f.rawSize + ' B');
      expect(s.get('Expected raw pixels')).toBe(f.rawSize + ' B');
    }
  });

  it('identifies the color type label and interlace from IHDR', async () => {
    const rgb = await summaryOf(fileOf(b64(FIXTURES[0].b64), 'a.png'));
    expect(rgb.get('Color type')).toBe('2 (truecolor)');
    expect(rgb.get('Interlace')).toBe('none');
    const inter = await summaryOf(fileOf(b64(FIXTURES[5].b64), 'i.png'));
    expect(inter.get('Interlace')).toBe('Adam7');
    const pal = await summaryOf(fileOf(b64(FIXTURES[2].b64), 'p.png'));
    expect(pal.get('Color type')).toBe('3 (indexed)');
    expect(pal.get('Palette entries')).toBe('4');
  });

  it('describes metadata chunks', async () => {
    const rows = await rowsOf(fileOf(b64(FIXTURES[1].b64), 'm.png'));
    const detail = (t: string): string => rows.find((r) => r[1] === t)?.[5] ?? '<missing>';
    expect(detail('tIME')).toContain('2026-01-02');
    expect(detail('sRGB')).toContain('perceptual');
    expect(detail('pHYs')).toContain('2835 x 2835');
    expect(detail('tEXt')).toBe('');
  });

  it('flags a corrupted CRC', async () => {
    const f = FIXTURES[0];
    const png = b64(f.b64);
    // Find the IEND CRC and flip a byte in it.
    const iendRow = f.chunks.find((c) => c[2] === 'IEND')!;
    const off = iendRow[0];
    const bad = new Uint8Array(png);
    bad[off + 8] = bad[off + 8] === 0 ? 1 : 0; // flip a CRC byte (IEND has no data)
    const rows = await findingsOf(fileOf(bad, 'bad.png'));
    expect(rows.some((r) => r[1] === 'crc')).toBe(true);
    // And the chunks table shows MISMATCH for IEND.
    const crows = await rowsOf(fileOf(bad, 'bad.png'));
    const iend = crows.find((r) => r[1] === 'IEND');
    expect(iend?.[3]).toBe('MISMATCH');
  });

  it('flags corrupt IDAT data', async () => {
    const f = FIXTURES[0];
    const png = b64(f.b64);
    const bad = new Uint8Array(png);
    // Flip a byte inside the IDAT payload (keeps the chunk boundary; CRC will be recomputed? no, we just flip data -> CRC mismatch + inflate failure)
    bad[42] = bad[42] === 0 ? 1 : 0;
    const rows = await findingsOf(fileOf(bad, 'bad2.png'));
    // Either the inflate fails or the CRC mismatch is reported.
    expect(rows.some((r) => r[1] === 'crc') || rows.some((r) => r[1] === 'inflate')).toBe(true);
  });

  it('flags a missing IHDR', async () => {
    const f = FIXTURES[0];
    const png = b64(f.b64);
    const ihdr = f.chunks.find((c) => c[2] === 'IHDR')!;
    // Keep the 8-byte signature but drop IHDR, so the first chunk is IDAT.
    const stripped = new Uint8Array(png.subarray(8, 8) as never).slice(0, 0);
    const kept = png.subarray(8 + 12 + ihdr[1]);
    const full = new Uint8Array(8 + kept.length);
    full.set(png.subarray(0, 8), 0);
    full.set(kept, 8);
    const rows = await findingsOf(fileOf(full, 'noihdr.png'));
    expect(rows.some((r) => r[1] === 'ihdr')).toBe(true);
    expect(rows.some((r) => r[1] === 'order')).toBe(true);
  });

  it('flags a missing IEND', async () => {
    const png = b64(FIXTURES[0].b64);
    const cut = new Uint8Array(png.subarray(0, png.length - 12));
    const rows = await findingsOf(fileOf(cut, 'noiend.png'));
    expect(rows.some((r) => r[1] === 'iend')).toBe(true);
  });

  it('rejects an empty / non-PNG file with a signature finding', async () => {
    const rows = await findingsOf(fileOf(new Uint8Array([1, 2, 3]), 'x.png'));
    expect(rows.some((r) => r[1] === 'signature')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/PNG file/);
  });
});
