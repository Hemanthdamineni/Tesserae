import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './delta-e.meta';

const MAX_TEXT = 100000;

/** A small set of common CSS color keywords. */
const NAMED: Record<string, string> = {
  black: '#000000',
  silver: '#c0c0c0',
  gray: '#808080',
  grey: '#808080',
  white: '#ffffff',
  maroon: '#800000',
  red: '#ff0000',
  purple: '#800080',
  fuchsia: '#ff00ff',
  magenta: '#ff00ff',
  green: '#008000',
  lime: '#00ff00',
  olive: '#808000',
  yellow: '#ffff00',
  navy: '#000080',
  blue: '#0000ff',
  teal: '#008080',
  aqua: '#00ffff',
  cyan: '#00ffff',
  orange: '#ffa500',
  tomato: '#ff6347',
  forestgreen: '#228b22',
  rebeccapurple: '#663399',
};

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface Lab {
  L: number;
  a: number;
  b: number;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  raw1: string;
  raw2: string;
  rgb1: RGB | null;
  rgb2: RGB | null;
  lab1: Lab | null;
  lab2: Lab | null;
  findings: Finding[];
}

function clampByte(x: number): number {
  if (x < 0) return 0;
  if (x > 255) return 255;
  return Math.round(x);
}

function parseHex(s: string): RGB | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/u.exec(s.trim());
  if (m === null) return null;
  let h = m[1] ?? '';
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function parseChannel(p: string): number | null {
  if (p.endsWith('%')) {
    const v = Number(p.slice(0, -1));
    return Number.isFinite(v) ? (v / 100) * 255 : null;
  }
  const v = Number(p);
  return Number.isFinite(v) ? v : null;
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const hh = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const chan = (t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: clampByte(chan(hh + 1 / 3) * 255),
    g: clampByte(chan(hh) * 255),
    b: clampByte(chan(hh - 1 / 3) * 255),
  };
}

function parseRgbFn(s: string): RGB | null {
  const m = /^rgba?\(([^)]*)\)$/iu.exec(s.trim());
  if (m === null) return null;
  const parts = (m[1] ?? '').split(/[\s,/]+/u).filter((x) => x.length > 0);
  const [p0, p1, p2] = parts;
  if (p0 === undefined || p1 === undefined || p2 === undefined) return null;
  const n0 = parseChannel(p0);
  const n1 = parseChannel(p1);
  const n2 = parseChannel(p2);
  if (n0 === null || n1 === null || n2 === null) return null;
  return { r: clampByte(n0), g: clampByte(n1), b: clampByte(n2) };
}

function parseHslFn(s: string): RGB | null {
  const m = /^hsla?\(([^)]*)\)$/iu.exec(s.trim());
  if (m === null) return null;
  const parts = (m[1] ?? '').split(/[\s,/]+/u).filter((x) => x.length > 0);
  const [p0, p1, p2] = parts;
  if (p0 === undefined || p1 === undefined || p2 === undefined) return null;
  const h = Number(p0.endsWith('deg') ? p0.slice(0, -3) : p0);
  const sat = Number(p1.replace('%', ''));
  const lig = Number(p2.replace('%', ''));
  if (!Number.isFinite(h) || !Number.isFinite(sat) || !Number.isFinite(lig)) return null;
  return hslToRgb(h, sat / 100, lig / 100);
}

function parseLabFn(s: string): Lab | null {
  const m = /^lab\(([^)]*)\)$/iu.exec(s.trim());
  if (m === null) return null;
  const parts = (m[1] ?? '').split(/[\s,/]+/u).filter((x) => x.length > 0);
  const [p0, p1, p2] = parts;
  if (p0 === undefined || p1 === undefined || p2 === undefined) return null;
  const L = p0.endsWith('%') ? Number(p0.slice(0, -1)) : Number(p0);
  const a = Number(p1);
  const b = Number(p2);
  if (!Number.isFinite(L) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { L, a, b };
}

interface ColorSpec {
  rgb: RGB | null;
  lab: Lab | null;
}

function parseColorSpec(raw: string): ColorSpec {
  const s = raw.trim();
  if (/^lab\(/iu.test(s)) {
    return { rgb: null, lab: parseLabFn(s) };
  }
  const rgb = parseColor(s);
  return { rgb, lab: rgb === null ? null : rgbToLab(rgb) };
}

function parseColor(raw: string): RGB | null {
  const s = raw.trim().toLowerCase();
  if (s === '') return null;
  const named = NAMED[s];
  if (named !== undefined) return parseHex(named);
  if (s.startsWith('#')) return parseHex(s);
  if (/^rgba?\(/u.test(s)) return parseRgbFn(s);
  if (/^hsla?\(/u.test(s)) return parseHslFn(s);
  return parseHex(s);
}

/** Pull color-like tokens out of free text, in order. */
function extractColors(text: string): string[] {
  const found: string[] = [];
  const re = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|lab\([^)]*\)|\b[a-zA-Z]{3,20}\b/gu;
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    const tok = m[0] ?? '';
    const lower = tok.toLowerCase();
    if (
      tok.startsWith('#') ||
      /^rgba?\(/iu.test(tok) ||
      /^hsla?\(/iu.test(tok) ||
      /^lab\(/iu.test(tok) ||
      NAMED[lower] !== undefined
    ) {
      found.push(tok);
    }
    m = re.exec(text);
  }
  return found;
}
function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function rgbToXyz(c: RGB): [number, number, number] {
  const r = srgbToLinear(c.r);
  const g = srgbToLinear(c.g);
  const b = srgbToLinear(c.b);
  return [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ];
}

function xyzToLab(x: number, y: number, z: number): Lab {
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / 0.95047);
  const fy = f(y / 1.0);
  const fz = f(z / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function rgbToLab(c: RGB): Lab {
  const [x, y, z] = rgbToXyz(c);
  return xyzToLab(x, y, z);
}

function labToLch(l: Lab): { L: number; C: number; h: number } {
  const C = Math.hypot(l.a, l.b);
  let h = (Math.atan2(l.b, l.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L: l.L, C, h };
}

/** CIE76: Euclidean distance in Lab. */
function de76(p: Lab, q: Lab): number {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

/** CIE94 (graphic arts weighting), using the first color as the reference. */
function de94(p: Lab, q: Lab): number {
  const c1 = Math.hypot(p.a, p.b);
  const c2 = Math.hypot(q.a, q.b);
  const dL = p.L - q.L;
  const dC = c1 - c2;
  const da = p.a - q.a;
  const db = p.b - q.b;
  const dH2 = Math.max(0, da * da + db * db - dC * dC);
  const sc = 1 + 0.045 * c1;
  const sh = 1 + 0.015 * c1;
  return Math.sqrt(dL * dL + (dC / sc) ** 2 + dH2 / (sh * sh));
}

/** CIEDE2000, the current CIE recommendation. */
function de2000(p: Lab, q: Lab): number {
  const rad = (d: number): number => (d * Math.PI) / 180;
  const deg = (r: number): number => (r * 180) / Math.PI;
  const c1 = Math.hypot(p.a, p.b);
  const c2 = Math.hypot(q.a, q.b);
  const cBar = (c1 + c2) / 2;
  const cBar7 = cBar ** 7;
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)));
  const a1p = (1 + g) * p.a;
  const a2p = (1 + g) * q.a;
  const c1p = Math.hypot(a1p, p.b);
  const c2p = Math.hypot(a2p, q.b);
  const h1p = a1p === 0 && p.b === 0 ? 0 : ((deg(Math.atan2(p.b, a1p)) % 360) + 360) % 360;
  const h2p = a2p === 0 && q.b === 0 ? 0 : ((deg(Math.atan2(q.b, a2p)) % 360) + 360) % 360;
  const dLp = q.L - p.L;
  const dCp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    const d = h2p - h1p;
    if (Math.abs(d) <= 180) dhp = d;
    else if (d > 180) dhp = d - 360;
    else dhp = d + 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dhp / 2));
  const lBarP = (p.L + q.L) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBarP: number;
  if (c1p * c2p === 0) {
    hBarP = h1p + h2p;
  } else {
    const s = h1p + h2p;
    if (Math.abs(h1p - h2p) <= 180) hBarP = s / 2;
    else if (s < 360) hBarP = (s + 360) / 2;
    else hBarP = (s - 360) / 2;
  }
  const t =
    1 -
    0.17 * Math.cos(rad(hBarP - 30)) +
    0.24 * Math.cos(rad(2 * hBarP)) +
    0.32 * Math.cos(rad(3 * hBarP + 6)) -
    0.2 * Math.cos(rad(4 * hBarP - 63));
  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const cBarP7 = cBarP ** 7;
  const rc = 2 * Math.sqrt(cBarP7 / (cBarP7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBarP - 50) ** 2) / Math.sqrt(20 + (lBarP - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin(rad(2 * dTheta)) * rc;
  return Math.sqrt(
    (dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rt * (dCp / sc) * (dHp / sh),
  );
}

/** A plain-language reading of a CIEDE2000 difference. */
function band(de: number): string {
  if (de < 1) return 'not perceptible to most people';
  if (de < 2) return 'perceptible on close inspection';
  if (de < 5) return 'clearly perceptible';
  if (de < 10) return 'a strong difference';
  if (de < 20) return 'very different colors';
  return 'almost unrelated colors';
}

function fmt(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return String(x);
  return x.toFixed(digits);
}
function buildModel(text: string, color1: string, color2: string): Model {
  const findings: Finding[] = [];
  const trimmed = text.trim();
  let r1 = trimmed;
  let r2 = '';
  const lines = trimmed.split(/\r?\n/u).filter((x) => x.trim().length > 0);
  if (lines.length >= 2) {
    r1 = (lines[0] ?? '').trim();
    r2 = (lines[1] ?? '').trim();
  } else if (trimmed !== '') {
    const found = extractColors(trimmed);
    r1 = found[0] ?? trimmed;
    r2 = found[1] ?? '';
  }
  if (r1 === '') r1 = color1;
  if (r2 === '') r2 = color2;
  const spec1 = parseColorSpec(r1);
  const spec2 = parseColorSpec(r2);
  const rgb1 = spec1.rgb;
  const rgb2 = spec2.rgb;
  if (spec1.lab === null) {
    findings.push({
      severity: 'error',
      kind: 'color',
      detail: `Could not parse the first color: "${r1}".`,
    });
  }
  if (spec2.lab === null) {
    findings.push({
      severity: 'error',
      kind: 'color',
      detail: `Could not parse the second color: "${r2}".`,
    });
  }
  return { raw1: r1, raw2: r2, rgb1, rgb2, lab1: spec1.lab, lab2: spec2.lab, findings };
}

function colorRow(label: string, raw: string, rgb: RGB | null, lab: Lab | null): string[][] {
  const rgbText = rgb === null ? '(lab input)' : `rgb(${rgb.r} ${rgb.g} ${rgb.b})`;
  if (lab === null) return [[label, raw, rgbText, 'unparsed', '']];
  const lch = labToLch(lab);
  return [
    [
      label,
      raw,
      rgbText,
      `L ${fmt(lab.L)} a ${fmt(lab.a)} b ${fmt(lab.b)}`,
      `C ${fmt(lch.C)} h ${fmt(lch.h)}`,
    ],
  ];
}

function summaryTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Item', 'Value'];
  const rows: string[][] = [];
  if (m.lab1 === null || m.lab2 === null) {
    rows.push(['Status', 'could not compute']);
    return { headers, rows };
  }
  const d2 = de2000(m.lab1, m.lab2);
  rows.push(['CIEDE2000', fmt(d2)]);
  rows.push(['CIE76', fmt(de76(m.lab1, m.lab2))]);
  rows.push(['CIE94', fmt(de94(m.lab1, m.lab2))]);
  rows.push(['Reading', band(d2)]);
  return { headers, rows };
}

function colorsTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Color', 'Input', 'RGB', 'Lab', 'LCh'];
  const rows: string[][] = [];
  rows.push(...colorRow('Color 1', m.raw1, m.rgb1, m.lab1));
  rows.push(...colorRow('Color 2', m.raw2, m.rgb2, m.lab2));
  return { headers, rows };
}

function metricTable(m: Model, metric: string): { headers: string[]; rows: string[][] } {
  const headers = ['Formula', 'Result'];
  const rows: string[][] = [];
  if (m.lab1 === null || m.lab2 === null) {
    rows.push(['Error', 'a color could not be parsed']);
    return { headers, rows };
  }
  if (metric === 'de2000') rows.push(['CIEDE2000', fmt(de2000(m.lab1, m.lab2))]);
  else if (metric === 'de76') rows.push(['CIE76', fmt(de76(m.lab1, m.lab2))]);
  else if (metric === 'de94') rows.push(['CIE94', fmt(de94(m.lab1, m.lab2))]);
  else {
    rows.push(['CIEDE2000', fmt(de2000(m.lab1, m.lab2))]);
    rows.push(['CIE76', fmt(de76(m.lab1, m.lab2))]);
    rows.push(['CIE94', fmt(de94(m.lab1, m.lab2))]);
  }
  return { headers, rows };
}

function findingsTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Severity', 'Kind', 'Detail'];
  const rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
  if (rows.length === 0) rows.push(['info', 'ok', 'Both colors parsed.']);
  return { headers, rows };
}
const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    let body = input.text ?? '';
    const file = (input.files ?? [])[0];
    if (file !== undefined) {
      if (file.size > MAX_TEXT) {
        throw new ToolError(
          'That file is too large.',
          'Provide a small text file with two colors.',
        );
      }
      body = await file.text();
    }
    if (body.length > MAX_TEXT) {
      throw new ToolError('That input is too long.', 'Provide just two colors.');
    }
    const m = buildModel(body, String(options.color1 ?? ''), String(options.color2 ?? ''));
    const view = String(options.view ?? 'summary');
    const metric = String(options.metric ?? 'all');
    let report: FileRunResult['report'];
    if (view === 'colors') report = { output: JSON.stringify(colorsTable(m)), render: 'table' };
    else if (view === 'findings')
      report = { output: JSON.stringify(findingsTable(m)), render: 'table' };
    else if (view === 'differences')
      report = { output: JSON.stringify(metricTable(m, metric)), render: 'table' };
    else report = { output: JSON.stringify(summaryTable(m)), render: 'table' };
    const notes: string[] = [];
    if (m.lab1 !== null && m.lab2 !== null) {
      const d2 = de2000(m.lab1, m.lab2);
      notes.push('CIEDE2000 ' + fmt(d2) + ': the two colors are ' + band(d2) + '.');
    }
    notes.push(
      'A CIEDE2000 of about 2.3 is the usual just-noticeable difference; the verbal bands are guidelines, not hard thresholds.',
    );
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
