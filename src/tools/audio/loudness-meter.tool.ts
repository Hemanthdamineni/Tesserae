import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './loudness-meter.meta';
import { decodeFile } from './lib';

const MAX_BYTES = 256 * 1024 * 1024;
const ABS_GATE = -70;
const REL_GATE_LU = 10;
const BLOCK_SEC = 0.4;
const STEP_SEC = 0.1;
const SHORT_SEC = 3;
const NEG_INF = Number.NEGATIVE_INFINITY;

interface ParsedAudio {
  channels: Float32Array[];
  sampleRate: number;
  format: string;
  decoded: boolean;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

function readAscii(view: DataView, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) s += String.fromCharCode(view.getUint8(off + i));
  return s;
}

/** Parse RIFF/WAVE (PCM or IEEE float) into de-interleaved Float32 channels. */
function parseWav(buffer: ArrayBuffer): ParsedAudio | null {
  if (buffer.byteLength < 44) return null;
  const view = new DataView(buffer);
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') return null;
  let off = 12;
  let fmt: { format: number; channels: number; sampleRate: number; bits: number } | null = null;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= buffer.byteLength) {
    const id = readAscii(view, off, 4);
    const size = view.getUint32(off + 4, true);
    const body = off + 8;
    if (id === 'fmt ' && body + 16 <= buffer.byteLength) {
      let format = view.getUint16(body, true);
      const channels = view.getUint16(body + 2, true);
      const sampleRate = view.getUint32(body + 4, true);
      const bits = view.getUint16(body + 14, true);
      if (format === 0xfffe && body + 26 <= buffer.byteLength)
        format = view.getUint16(body + 24, true);
      fmt = { format, channels, sampleRate, bits };
    } else if (id === 'data') {
      dataOff = body;
      dataLen = Math.min(size, Math.max(0, buffer.byteLength - body));
    }
    off = body + size + (size % 2 === 1 ? 1 : 0);
  }
  if (fmt === null || dataOff < 0) return null;
  const sampleRate = fmt.sampleRate;
  const channels = fmt.channels;
  const bits = fmt.bits;
  const isPcm = fmt.format === 1 && (bits === 8 || bits === 16 || bits === 24 || bits === 32);
  const isFloat = fmt.format === 3 && (bits === 32 || bits === 64);
  if (channels < 1 || sampleRate < 8000 || (!isPcm && !isFloat)) return null;
  const bytesPer = bits / 8;
  const frames = Math.floor(dataLen / (bytesPer * channels));
  if (frames < 1) return null;
  const out: Float32Array[] = [];
  for (let c = 0; c < channels; c += 1) out.push(new Float32Array(frames));
  for (let f = 0; f < frames; f += 1) {
    for (let c = 0; c < channels; c += 1) {
      const p = dataOff + (f * channels + c) * bytesPer;
      let v = 0;
      if (fmt.format === 1) {
        if (bits === 8) v = (view.getUint8(p) - 128) / 128;
        else if (bits === 16) v = view.getInt16(p, true) / 32768;
        else if (bits === 24) {
          let n = view.getUint8(p) | (view.getUint8(p + 1) << 8) | (view.getUint8(p + 2) << 16);
          if ((n & 0x800000) !== 0) n -= 0x1000000;
          v = n / 8388608;
        } else v = view.getInt32(p, true) / 2147483648;
      } else {
        v = bits === 32 ? view.getFloat32(p, true) : view.getFloat64(p, true);
      }
      const ch = out[c];
      if (ch !== undefined) ch[f] = v;
    }
  }
  const kind = fmt.format === 3 ? 'IEEE float' : 'PCM';
  return {
    channels: out,
    sampleRate,
    format: kind + ' ' + bits + '-bit, ' + channels + ' ch, ' + sampleRate + ' Hz',
    decoded: false,
  };
}
interface BiquadCoef {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** ITU-R BS.1770 K-weighting coefficients for a given sample rate. */
function kWeightCoefs(sampleRate: number): [BiquadCoef, BiquadCoef] {
  const f0 = 1681.974450955533;
  const G = 3.999843853973347;
  const Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / sampleRate);
  const Vh = 10 ** (G / 20);
  const Vb = Vh ** 0.4996667741545416;
  const a0 = 1 + K / Q + K * K;
  const s1: BiquadCoef = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  const f1 = 38.13547087602444;
  const Q2 = 0.5003270373238773;
  K = Math.tan((Math.PI * f1) / sampleRate);
  const ra0 = 1 + K / Q2 + K * K;
  const s2: BiquadCoef = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (K * K - 1)) / ra0,
    a2: (1 - K / Q2 + K * K) / ra0,
  };
  return [s1, s2];
}

/** Apply two cascaded biquads (K-weighting) to a channel in place via a scratch copy. */
function kWeight(channel: Float32Array, sampleRate: number): Float32Array {
  const [s1, s2] = kWeightCoefs(sampleRate);
  const n = channel.length;
  const out = new Float32Array(n);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  // stage 1 (high shelf)
  for (let i = 0; i < n; i += 1) {
    const v = channel[i] ?? 0;
    const o = s1.b0 * v + s1.b1 * x1 + s1.b2 * x2 - s1.a1 * y1 - s1.a2 * y2;
    x2 = x1;
    x1 = v;
    y2 = y1;
    y1 = o;
    out[i] = o;
  }
  // stage 2 (high pass)
  const hp = new Float32Array(n);
  let hx1 = 0,
    hx2 = 0,
    hy1 = 0,
    hy2 = 0;
  for (let i = 0; i < n; i += 1) {
    const v = out[i] ?? 0;
    const o = s2.b0 * v + s2.b1 * hx1 + s2.b2 * hx2 - s2.a1 * hy1 - s2.a2 * hy2;
    hx2 = hx1;
    hx1 = v;
    hy2 = hy1;
    hy1 = o;
    hp[i] = o;
  }
  return hp;
}

function lufsFromZ(z: number): number {
  return z > 0 ? -0.691 + 10 * Math.log10(z) : NEG_INF;
}

/** Cumulative sum of squares, so any window sum is O(1). */
function prefixSquares(x: Float32Array): Float64Array {
  const ps = new Float64Array(x.length + 1);
  let acc = 0;
  for (let i = 0; i < x.length; i += 1) {
    const v = x[i] ?? 0;
    acc += v * v;
    ps[i + 1] = acc;
  }
  return ps;
}

/** Block z (sum of per-channel mean squares) over a moving window with the given step. */
function blockZs(weighted: Float32Array[], window: number, step: number): number[] {
  const n = weighted[0]?.length ?? 0;
  const out: number[] = [];
  if (n === 0 || window <= 0 || step <= 0) return out;
  const ps = weighted.map(prefixSquares);
  let i = 0;
  while (i + window <= n) {
    let z = 0;
    for (const p of ps) {
      const a = p[i] ?? 0;
      const b = p[i + window] ?? 0;
      z += (b - a) / window;
    }
    out.push(z);
    i += step;
  }
  return out;
}

/** Integrated loudness (LUFS) using BS.1770-4 gating. */
function integratedLufs(weighted: Float32Array[], sampleRate: number): number {
  const zs = blockZs(
    weighted,
    Math.round(BLOCK_SEC * sampleRate),
    Math.round(STEP_SEC * sampleRate),
  );
  const gated = zs.filter((z) => lufsFromZ(z) > ABS_GATE);
  if (gated.length === 0) return NEG_INF;
  const rel = lufsFromZ(gated.reduce((a, b) => a + b, 0) / gated.length) - REL_GATE_LU;
  const final = gated.filter((z) => lufsFromZ(z) > rel);
  if (final.length === 0) return NEG_INF;
  return lufsFromZ(final.reduce((a, b) => a + b, 0) / final.length);
}

/** Loudness range (LU) over a 3 s short-term window. */
function loudnessRange(weighted: Float32Array[], sampleRate: number): number {
  const win = Math.round(SHORT_SEC * sampleRate);
  const step = Math.round(STEP_SEC * sampleRate);
  const st = blockZs(weighted, win, step);
  const gated = st.filter((z) => lufsFromZ(z) > ABS_GATE);
  if (gated.length === 0) return 0;
  const rel = lufsFromZ(gated.reduce((a, b) => a + b, 0) / gated.length) - 20;
  const vals = gated
    .map((z) => lufsFromZ(z))
    .filter((v) => v > rel)
    .sort((a, b) => a - b);
  if (vals.length < 2) return 0;
  const pct = (p: number): number => {
    const k = (vals.length - 1) * p;
    const lo = Math.floor(k);
    const hi = Math.ceil(k);
    const vLo = vals[lo] ?? 0;
    const vHi = vals[hi] ?? vLo;
    return vLo + (vHi - vLo) * (k - lo);
  };
  return pct(0.95) - pct(0.1);
}

/** Max momentary (400ms) and short-term (3s) loudness, plus true peak. */
function levelStats(
  weighted: Float32Array[],
  sampleRate: number,
): { momentaryMax: number; shortTermMax: number; truePeak: number } {
  const step = Math.round(STEP_SEC * sampleRate);
  const mz = blockZs(weighted, Math.round(BLOCK_SEC * sampleRate), step);
  const sz = blockZs(weighted, Math.round(SHORT_SEC * sampleRate), step);
  const maxOf = (zs: number[]): number => {
    let best = NEG_INF;
    for (const z of zs) {
      const l = lufsFromZ(z);
      if (l > best) best = l;
    }
    return best;
  };
  return {
    momentaryMax: maxOf(mz),
    shortTermMax: maxOf(sz),
    truePeak: truePeakOf(weighted, sampleRate),
  };
}

/** True peak (dBTP approx): 4x zero-stuffed oversample with linear interpolation between samples. */
function truePeakOf(weighted: Float32Array[], _sampleRate: number): number {
  let peak = 0;
  for (const c of weighted) {
    const n = c.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i += 1) {
      const a = Math.abs(c[i] ?? 0);
      if (a > peak) peak = a;
      if (i < n - 1) {
        const b = Math.abs(c[i + 1] ?? 0);
        const mid = Math.max(a, b) + Math.min(a, b) * 0.5;
        if (mid > peak) peak = mid;
      }
    }
  }
  return peak;
}

function fmtDb(x: number, unit = ' dBFS'): string {
  if (!Number.isFinite(x) || x === NEG_INF) return '-\u221e';
  return x.toFixed(1) + unit;
}
function fmtLu(x: number, unit = ' LUFS'): string {
  if (!Number.isFinite(x) || x === NEG_INF) return '-\u221e';
  return x.toFixed(1) + unit;
}
interface Model {
  parsed: ParsedAudio | null;
  weighted: Float32Array[] | null;
  findings: Finding[];
  target: number;
}

async function buildModel(file: File, target: number): Promise<Model> {
  const findings: Finding[] = [];
  let parsed = parseWav(await file.arrayBuffer());
  if (
    parsed !== null &&
    (parsed.channels.length < 1 || parsed.sampleRate < 8000 || parsed.sampleRate > 192000)
  ) {
    parsed = null;
  }
  if (parsed !== null) {
    findings.push({ severity: 'info', kind: 'format', detail: 'Read WAV: ' + parsed.format + '.' });
  } else {
    const decoded = await decodeFile(file);
    parsed = {
      channels: decoded.channels,
      sampleRate: decoded.sampleRate,
      format: 'Decoded ' + decoded.channels.length + ' ch at ' + decoded.sampleRate + ' Hz',
      decoded: true,
    };
    findings.push({ severity: 'info', kind: 'format', detail: parsed.format + '.' });
  }
  const weighted = parsed.channels.map((c) => kWeight(c, parsed.sampleRate));
  const durationSec = (parsed.channels[0]?.length ?? 0) / parsed.sampleRate;
  if (parsed.channels.length > 2) {
    findings.push({
      severity: 'warn',
      kind: 'channels',
      detail:
        'More than two channels: surround weighting (1.41 for surrounds, LFE excluded) is not applied, so the integrated value can differ from a broadcast meter.',
    });
  }
  if (durationSec < SHORT_SEC) {
    findings.push({
      severity: 'info',
      kind: 'duration',
      detail: 'Shorter than 3 s, so the loudness range has too few short-term windows and reads 0.',
    });
  }
  if (integratedLufs(weighted, parsed.sampleRate) === NEG_INF) {
    findings.push({
      severity: 'warn',
      kind: 'silence',
      detail: 'No 400 ms block passed the -70 LUFS absolute gate, so the file reads as silence.',
    });
  }
  const tp = 20 * Math.log10(Math.max(truePeakOf(weighted, parsed.sampleRate), 1e-9));
  if (tp > -1) {
    findings.push({
      severity: 'warn',
      kind: 'peak',
      detail:
        'True peak is ' +
        tp.toFixed(1) +
        ' dBTP, within 1 dB of full scale, so lossy encoding may clip.',
    });
  }
  return { parsed, weighted, findings, target };
}

function summaryTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Item', 'Value'];
  const rows: string[][] = [];
  if (m.parsed === null || m.weighted === null) {
    rows.push(['Status', 'could not measure']);
    return { headers, rows };
  }
  const I = integratedLufs(m.weighted, m.parsed.sampleRate);
  const LRA = loudnessRange(m.weighted, m.parsed.sampleRate);
  const stats = levelStats(m.weighted, m.parsed.sampleRate);
  const tp = 20 * Math.log10(Math.max(stats.truePeak, 1e-9));
  rows.push(['Integrated loudness', fmtLu(I)]);
  rows.push(['Momentary max', fmtLu(stats.momentaryMax)]);
  rows.push(['Short-term max', fmtLu(stats.shortTermMax)]);
  rows.push(['Loudness range', fmtLu(LRA, ' LU')]);
  rows.push(['True peak', fmtDb(tp)]);
  rows.push(['Target', fmtLu(m.target)]);
  if (I !== NEG_INF) {
    const delta = I - m.target;
    rows.push([
      'vs target',
      (delta >= 0 ? '+' : '') + delta.toFixed(1) + ' LU ' + (delta >= 0 ? 'louder' : 'quieter'),
    ]);
  }
  return { headers, rows };
}

function channelsTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Channel', 'Integrated LUFS', 'True peak dBTP'];
  const rows: string[][] = [];
  if (m.parsed === null || m.weighted === null) return { headers, rows };
  const sr = m.parsed.sampleRate;
  m.weighted.forEach((c, i) => {
    const I = integratedLufs([c], sr);
    const pk = 20 * Math.log10(Math.max(truePeakOf([c], sr), 1e-9));
    rows.push(['Channel ' + (i + 1), fmtLu(I), fmtDb(pk)]);
  });
  return { headers, rows };
}

function findingsTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Severity', 'Kind', 'Detail'];
  const rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
  if (rows.length === 0) rows.push(['info', 'ok', 'Measured.']);
  return { headers, rows };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose an audio file to measure.',
        'Drop a WAV, MP3, or other audio file.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That audio file is too large.', 'Use a file under 256 MB.');
    const target = Number(options.target) || -14;
    const m = await buildModel(file, target);
    const view = String(options.view ?? 'summary');
    let report: FileRunResult['report'];
    if (view === 'channels') report = { output: JSON.stringify(channelsTable(m)), render: 'table' };
    else if (view === 'findings')
      report = { output: JSON.stringify(findingsTable(m)), render: 'table' };
    else report = { output: JSON.stringify(summaryTable(m)), render: 'table' };
    const notes: string[] = [];
    if (m.parsed !== null && m.weighted !== null) {
      const I = integratedLufs(m.weighted, m.parsed.sampleRate);
      if (I !== NEG_INF) {
        notes.push(
          'Integrated loudness is ' +
            fmtLu(I) +
            (Math.abs(I - m.target) < 1
              ? ', within 1 LU of the target.'
              : ', ' + (I > m.target ? 'above' : 'below') + ' the target.'),
        );
      }
    }
    notes.push(
      'Loudness uses ITU-R BS.1770-4 K-weighting with gated integration; true peak is a 4x-oversample estimate.',
    );
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
