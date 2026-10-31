import { describe, it, expect } from 'vitest';
import tool from './loudness-meter.tool';

const META = tool.meta;

/** Encode a PCM16 WAV from per-channel float sample arrays. */
function wav(channels: number[][], sampleRate: number): Uint8Array {
  const frames = channels[0]?.length ?? 0;
  const ch = channels.length;
  const dataBytes = frames * ch * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  ascii(36, 'data');
  v.setUint32(40, dataBytes, true);
  let off = 44;
  for (let f = 0; f < frames; f += 1) {
    for (let c = 0; c < ch; c += 1) {
      const s = Math.max(-1, Math.min(1, channels[c]?.[f] ?? 0));
      v.setInt16(off, Math.round(s * 32767), true);
      off += 2;
    }
  }
  return new Uint8Array(buf);
}

/** Encode a WAV with an arbitrary PCM bit depth (format 1) or float (format 3). */
function wavCustom(
  channels: number[][],
  sampleRate: number,
  bits: number,
  format: number,
): Uint8Array {
  const frames = channels[0]?.length ?? 0;
  const ch = channels.length;
  const bytesPer = bits / 8;
  const dataBytes = frames * ch * bytesPer;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, format, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * bytesPer, true);
  v.setUint16(32, ch * bytesPer, true);
  v.setUint16(34, bits, true);
  ascii(36, 'data');
  v.setUint32(40, dataBytes, true);
  let off = 44;
  for (let f = 0; f < frames; f += 1) {
    for (let c = 0; c < ch; c += 1) {
      const s = Math.max(-1, Math.min(1, channels[c]?.[f] ?? 0));
      if (format === 3) {
        v.setFloat32(off, s, true);
      } else if (bits === 8) {
        v.setUint8(off, Math.round(s * 127) + 128);
      } else if (bits === 16) {
        v.setInt16(off, Math.round(s * 32767), true);
      } else if (bits === 24) {
        let n = Math.round(s * 8388607);
        if (n < 0) n += 0x1000000;
        v.setUint8(off, n & 255);
        v.setUint8(off + 1, (n >> 8) & 255);
        v.setUint8(off + 2, (n >> 16) & 255);
      } else {
        v.setInt32(off, Math.round(s * 2147483647), true);
      }
      off += bytesPer;
    }
  }
  return new Uint8Array(buf);
}

function sine(sampleRate: number, dur: number, amp: number, freq: number): number[] {
  const n = Math.round(sampleRate * dur);
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(amp * Math.sin((2 * Math.PI * freq * i) / sampleRate));
  return out;
}

function file(bytes: Uint8Array, name = 'x.wav'): File {
  // Copy into a fresh ArrayBuffer so the BlobPart type is satisfied across TS lib versions.
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'audio/wav' });
}

async function table(f: File, view = 'summary', target = '-14') {
  const r = await tool.run({ files: [f], options: { view, target } });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}
async function summary(f: File, target = '-14') {
  const rows = await table(f, 'summary', target);
  return new Map<string, string>(rows.map((x) => [String(x[0]), String(x[1])]));
}
const num = (s: string | undefined): number => Number(String(s).replace(/[^0-9.+-]/g, ''));

describe('loudness-meter', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('matches ffmpeg integrated loudness for a 48k mono 440Hz tone', async () => {
    const m = await summary(file(wav([sine(48000, 4, 0.2, 440)], 48000)));
    expect(num(m.get('Integrated loudness'))).toBeCloseTo(-17.7, 0); // within 0.5
  });

  it('tracks amplitude changes (quiet tone)', async () => {
    const quiet = await summary(file(wav([sine(48000, 4, 0.02, 440)], 48000)));
    expect(num(quiet.get('Integrated loudness'))).toBeCloseTo(-37.7, 0);
  });

  it('tracks stereo and higher sample rates', async () => {
    const st = await summary(
      file(wav([sine(48000, 4, 0.3, 1000), sine(48000, 4, 0.3, 1000)], 48000)),
    );
    expect(num(st.get('Integrated loudness'))).toBeCloseTo(-10.5, 0);
    const hi = await summary(
      file(wav([sine(96000, 4, 0.5, 3000), sine(96000, 4, 0.5, 3000)], 96000)),
    );
    expect(num(hi.get('Integrated loudness'))).toBeCloseTo(-2.9, 0);
    const lo = await summary(file(wav([sine(44100, 4, 0.1, 200)], 44100)));
    expect(num(lo.get('Integrated loudness'))).toBeCloseTo(-24.0, 0);
  });

  it('reports a steady tone as zero loudness range', async () => {
    const m = await summary(file(wav([sine(48000, 5, 0.3, 1000)], 48000)));
    expect(num(m.get('Loudness range'))).toBeLessThan(0.5);
  });

  it('computes a nonzero loudness range for a stepped-level clip', async () => {
    const step = 4.0 * 48000;
    const a = sine(48000, 4, 0.1, 1000);
    const b = sine(48000, 4, 0.5, 1000);
    const clip = new Float64Array(step * 2);
    clip.set(a, 0);
    clip.set(b, step);
    const m = await summary(file(wav([Array.from(clip)], 48000)));
    expect(num(m.get('Loudness range'))).toBeGreaterThan(10);
  });

  it('shows a positive true peak reading close to the sample peak for a sine', async () => {
    const m = await summary(file(wav([sine(48000, 3, 0.5, 1000)], 48000)));
    const tp = num(m.get('True peak'));
    expect(tp).toBeLessThan(0);
    expect(tp).toBeGreaterThan(-8);
  });

  it('reads silence as -infinity', async () => {
    const m = await summary(file(wav([[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], 48000)));
    expect(m.get('Integrated loudness')).toBe('-∞');
  });

  it('reports the target delta for a loud clip', async () => {
    const m = await summary(file(wav([sine(48000, 3, 0.9, 500)], 48000)), '-14');
    const vs = m.get('vs target');
    expect(vs).toMatch(/louder/);
  });

  it('offers per-channel rows', async () => {
    const rows = await table(
      file(wav([sine(48000, 3, 0.2, 440), sine(48000, 3, 0.2, 440)], 48000)),
      'channels',
    );
    expect(rows.length).toBe(2);
    expect(rows[0]?.[0]).toBe('Channel 1');
    expect(rows[1]?.[0]).toBe('Channel 2');
  });

  it('records a success finding in the findings view', async () => {
    const rows = await table(file(wav([sine(48000, 3, 0.2, 440)], 48000)), 'findings');
    expect(rows.some((r) => r[1] === 'format')).toBe(true);
  });

  it('flags a near-full-scale true peak', async () => {
    const rows = await table(file(wav([sine(48000, 3, 0.995, 1000)], 48000)), 'findings');
    expect(rows.some((r) => r[1] === 'peak')).toBe(true);
  });

  it('warns when the clip is shorter than 3 seconds', async () => {
    const rows = await table(file(wav([sine(48000, 1.5, 0.2, 440)], 48000)), 'findings');
    expect(rows.some((r) => r[1] === 'duration')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: { view: 'summary' }, text: '' })).rejects.toThrow(
      /audio file/,
    );
  });

  it('reproduces the ffmpeg loudness oracle within 0.2 dB', async () => {
    const cases: [number, number[][], number][] = [
      [48000, [sine(48000, 3, 0.2, 440)], -17.7],
      [48000, [sine(48000, 3, 0.02, 440)], -37.7],
      [48000, [sine(48000, 3, 0.3, 1000), sine(48000, 3, 0.3, 1000)], -10.5],
      [44100, [sine(44100, 3, 0.1, 200)], -24.0],
      [96000, [sine(96000, 3, 0.5, 3000), sine(96000, 3, 0.5, 3000)], -2.9],
      [48000, [sine(48000, 3, 0.9, 500)], -4.6],
    ];
    const bad: string[] = [];
    for (const [sr, chans, want] of cases) {
      const m = await summary(file(wav(chans, sr)));
      const got = num(m.get('Integrated loudness'));
      if (!(Math.abs(got - want) < 0.2)) bad.push(`${sr}Hz amp: got ${got} want ${want}`);
    }
    expect(bad).toEqual([]);
  });

  it('reproduces the ffmpeg loudness range oracle within 0.6 LU', async () => {
    const sr = 48000;
    const a = sine(sr, 6, 0.1, 1000);
    const b = sine(sr, 6, 0.5, 1000);
    const stepped = [...a, ...b];
    const m1 = await summary(file(wav([stepped], sr)));
    expect(Math.abs(num(m1.get('Loudness range')) - 14.0)).toBeLessThan(0.6);
    const three = [
      ...sine(sr, 4, 0.05, 1000),
      ...sine(sr, 4, 0.2, 1000),
      ...sine(sr, 4, 0.8, 1000),
    ];
    const m2 = await summary(file(wav([three], sr)));
    expect(Math.abs(num(m2.get('Loudness range')) - 24.1)).toBeLessThan(0.6);
  });

  it('parses 24-bit PCM WAV', async () => {
    const m = await summary(file(wavCustom([sine(48000, 3, 0.2, 440)], 48000, 24, 1)));
    expect(Math.abs(num(m.get('Integrated loudness')) - -17.7)).toBeLessThan(0.3);
  });

  it('parses 32-bit float WAV', async () => {
    const m = await summary(file(wavCustom([sine(48000, 3, 0.2, 440)], 48000, 32, 3)));
    expect(Math.abs(num(m.get('Integrated loudness')) - -17.7)).toBeLessThan(0.3);
  });

  it('parses 8-bit PCM WAV', async () => {
    const m = await summary(file(wavCustom([sine(48000, 3, 0.5, 440)], 48000, 8, 1)));
    expect(num(m.get('Integrated loudness'))).toBeLessThan(0);
  });

  it('warns about more than two channels', async () => {
    const rows = await table(
      file(
        wav([sine(48000, 3, 0.2, 440), sine(48000, 3, 0.2, 440), sine(48000, 3, 0.2, 440)], 48000),
      ),
      'findings',
    );
    expect(rows.some((r) => r[1] === 'channels')).toBe(true);
  });

  it('rejects a file that is neither WAV nor decodable here', async () => {
    const junk = new Uint8Array(64).fill(7);
    await expect(
      tool.run({ files: [file(junk, 'x.bin')], options: { view: 'summary' } }),
    ).rejects.toThrow();
  });
});
