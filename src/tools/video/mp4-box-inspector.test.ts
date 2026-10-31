import { describe, it, expect } from 'vitest';
import tool from './mp4-box-inspector.tool';

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.mp4'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'video/mp4' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

function headerLen(label: string): number {
  if (label === 'normal') return 8;
  if (label === '64-bit') return 16;
  return 24;
}

/** Structural projection [offset, depth, type, size, hdr] used by the oracle. */
function structRows(rows: string[][]): [number, number, string, number, number][] {
  return rows.map((r) => [
    Number(r[0]),
    Number(r[1]),
    r[2] ?? '',
    Number(r[3]),
    headerLen(r[4] ?? ''),
  ]);
}

const MP4_SYNTH_B64 =
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAKZnJlZQAAAAAADG1kYXQAAQIDAAAB0W1vb3YAAABMbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAfQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAABc3RyYWsAAABwdGtoZAAAAAcAAAAAAAAAAAAAA+gAAAfQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABAAAAA+21kaWEAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAADGbWluZgAAAL5zdGJsAAAAanN0c2QAAAAAAAAAAQAAAFphdmMxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABRzdHRzAAAAAAAAAAAAAAAAAAAAFHN0c2MAAAAAAAAAAAAAAAAAAAAUc3RzegAAAAAAAAAAAAAAAAAAABBzdGNvAAAAAAAAAAAAAAAKdWR0YQAAAAAAGG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAHHV1aWSKLTxLAAECAwQFBgcICQoLZGF0YQAAAApza2lwAAAAAAAMbWRhdAABAgMAAAAKZnJlZQAA';

const MP4_SYNTH_STRUCT: [number, number, string, number, number][] = [
  [0, 0, 'ftyp', 32, 8],
  [32, 0, 'free', 10, 8],
  [42, 0, 'mdat', 12, 8],
  [54, 0, 'moov', 465, 8],
  [62, 1, 'mvhd', 76, 8],
  [138, 1, 'trak', 371, 8],
  [146, 2, 'tkhd', 112, 8],
  [258, 2, 'mdia', 251, 8],
  [266, 3, 'hdlr', 45, 8],
  [311, 3, 'minf', 198, 8],
  [319, 4, 'stbl', 190, 8],
  [327, 5, 'stsd', 106, 8],
  [433, 5, 'stts', 20, 8],
  [453, 5, 'stsc', 20, 8],
  [473, 5, 'stsz', 20, 8],
  [493, 5, 'stco', 16, 8],
  [509, 1, 'udta', 10, 8],
  [519, 0, 'moof', 24, 8],
  [527, 1, 'mfhd', 16, 8],
  [543, 0, 'uuid', 28, 8],
  [571, 0, 'skip', 10, 8],
  [581, 0, 'mdat', 12, 8],
  [593, 0, 'free', 10, 8],
];

const REAL_MP4_B64 =
  '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';

describe('mp4-box-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('matches the Python-oracle box tree for the synthetic MP4', async () => {
    const rows = await rowsOf(fileOf(b64(MP4_SYNTH_B64), 's.mp4'));
    expect(structRows(rows)).toEqual(MP4_SYNTH_STRUCT);
  });

  it('decodes ftyp, mvhd, tkhd and hdlr in the synthetic fixture', async () => {
    const rows = await rowsOf(fileOf(b64(MP4_SYNTH_B64), 's.mp4'));
    const find = (off: number): string =>
      rows.find((r) => Number(r[0]) === off)?.[6] ?? '<missing>';
    expect(find(0)).toContain('major isom v512');
    expect(find(62)).toContain('timescale 1000');
    expect(find(146)).toContain('track id 1000');
    expect(find(266)).toContain('handler vide');
    expect(find(42)).toContain('4 B media data');
  });

  it('marks container versus leaf kinds', async () => {
    const rows = await rowsOf(fileOf(b64(MP4_SYNTH_B64), 's.mp4'));
    const kind = (off: number): string => rows.find((r) => Number(r[0]) === off)?.[5] ?? '?';
    expect(kind(54)).toBe('container'); // moov
    expect(kind(62)).toBe('leaf'); // mvhd
    expect(kind(327)).toBe('leaf'); // stsd
  });

  it('honours the max depth option', async () => {
    const full = await rowsOf(fileOf(b64(MP4_SYNTH_B64), 's.mp4'));
    const shallow = await rowsOf(fileOf(b64(MP4_SYNTH_B64), 's.mp4'), { maxDepth: 1 });
    expect(full.length).toBe(23);
    expect(shallow.length).toBe(13);
  });

  it('parses a real ffmpeg-encoded MP4 with a nested moov', async () => {
    const png = await Promise.resolve(b64(REAL_MP4_B64));
    const rows = await rowsOf(fileOf(png, 'real.mp4'));
    expect(rows.length).toBeGreaterThan(10);
    expect(rows[0]?.[2]).toBe('ftyp');
    const types = new Set(rows.map((r) => r[2]));
    expect(types.has('moov')).toBe(true);
    expect(types.has('mdat')).toBe(true);
    expect(types.has('mvhd')).toBe(true);
    expect(types.has('trak')).toBe(true);
    expect(types.has('stbl')).toBe(true);
  });

  it('reports the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(MP4_SYNTH_B64), 's.mp4'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Total boxes')).toBe('23');
    expect(m.get('Top-level boxes')).toBe('9');
    expect(m.get('Moov present')).toBe('yes');
    expect(m.get('Mdat present')).toBe('yes');
  });

  it('flags an out-of-range box size as an overrun', async () => {
    // Craft a box whose size runs past the end of the file.
    const bytes = new Uint8Array(24);
    bytes.set([0, 0, 0, 40], 0); // size 40 > 24 bytes available -> overruns end of file
    bytes.set([109, 111, 111, 118], 4); // 'moov'
    const rows = await rowsOf(fileOf(bytes, 'bad.mp4'), { view: 'findings' });
    expect(rows.some((r) => r[1] === 'overrun')).toBe(true);
  });

  it('flags a missing moov in a mdat-only file', async () => {
    const bytes = new Uint8Array(16);
    bytes.set([0, 0, 0, 16, 109, 100, 97, 116], 0); // mdat size 16
    const rows = await rowsOf(fileOf(bytes, 'nodata.mp4'), { view: 'findings' });
    expect(rows.some((r) => r[1] === 'moov')).toBe(true);
  });

  it('rejects an empty file with a parse error', async () => {
    const rows = await rowsOf(fileOf(new Uint8Array([0, 0, 0, 4, 1, 2, 3, 4]), 'tiny.mp4'), {
      view: 'findings',
    });
    // size 4 < header 8 -> undersize finding or a parse issue
    expect(rows.some((r) => r[1] === 'undersize') || rows.some((r) => r[1] === 'parse')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/MP4\/MOV/);
  });
});
