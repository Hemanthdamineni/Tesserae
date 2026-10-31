import { describe, it, expect } from 'vitest';
import tool from './midi-inspector.tool';

const MIDI_B64 = 'TVRoZAAAAAYAAQABAGBNVHJrAAAAEwD/UQMHoSAAkDxkYIA8QAD/LwA=';

// [delta, event-label] expected sequence from the Python oracle event walker.
const MIDI_EVENTS: [number, string][] = [
  [0, 'tempo 500000us (120 bpm)'],
  [0, 'note on ch0 note60 vel100'],
  [96, 'note off ch0 note60 vel64'],
  [0, 'end of track'],
];

const MIDI_HEADER = { size: 41, format: 1, tracks: 1, division: 96 };

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.mid'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'audio/midi' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('midi-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('matches the Python-oracle event delta-times in order', async () => {
    const rows = await rowsOf(fileOf(b64(MIDI_B64), 'tune.mid'));
    const got = rows.map((r) => Number(r[2]));
    expect(got).toEqual(MIDI_EVENTS.map((e) => e[0]));
  });

  it('reads the header into the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(MIDI_B64), 'tune.mid'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Magic')).toBe('valid (MThd)');
    expect(m.get('Format')).toBe(String(MIDI_HEADER.format));
    expect(m.get('Track count')).toBe(String(MIDI_HEADER.tracks));
    expect(m.get('Division (tick/quarter)')).toBe(String(MIDI_HEADER.division));
    expect(m.get('Tempo')).toBe('120 bpm');
  });

  it('decodes tempo, note names, and end-of-track', async () => {
    const rows = await rowsOf(fileOf(b64(MIDI_B64), 'tune.mid'));
    expect(rows.some((r) => r[3] === 'tempo 500000us (120 bpm)')).toBe(true);
    expect(rows.some((r) => r[3] === 'note on ch0 C4 vel 100')).toBe(true);
    expect(rows.some((r) => r[3] === 'note off ch0 C4 vel 64')).toBe(true);
    expect(rows.some((r) => r[3] === 'end of track')).toBe(true);
  });

  it('flags a bad MThd magic', async () => {
    const rows = await rowsOf(
      fileOf(new Uint8Array([1, 2, 3, 4, 0, 0, 0, 6, 0, 1, 0, 1, 0, 96]), 'bad.mid'),
      { view: 'findings' },
    );
    expect(rows.some((r) => r[1] === 'magic')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/MIDI/);
  });
});
