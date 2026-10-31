import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './css-transform-inspector.meta';

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_FUNCS = 4096;
const DEG = Math.PI / 180;
interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface TransformFunc {
  name: string;
  args: number[];
  is2D: boolean;
}

interface Decomp {
  translate: { x: number; y: number };
  rotateDeg: number;
  scale: { x: number; y: number };
  skewX: number;
  /** True when the determinant is negative: the transform mirrors. */
  mirrored: boolean;
}

interface Model {
  source: string;
  functions: TransformFunc[];
  findings: Finding[];
  is3D: boolean;
  matrix: number[] | null;
  det2: number | null;
  invertible: boolean;
  decomp: Decomp | null;
  round: number;
}
/** Convert a CSS angle token ("45deg", "0.5turn", "1rad", "100grad") to degrees. */

function angleToDeg(token: string): number | null {
  const m = /^(-?\d*\.?\d+)(deg|rad|grad|turn)?$/u.exec(token.trim());
  if (m === null) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2] ?? 'deg';
  if (unit === 'deg') return n;
  if (unit === 'rad') return (n * 180) / Math.PI;
  if (unit === 'grad') return n * 0.9;
  return n * 360;
}

/** Convert a CSS length token in px, or a bare number, to px. */

/** Convert a unitless scale token. */
/** Identity as a column-major 4x4 (length 16). */

function identity4(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/**
 * Multiply two column-major 4x4 matrices: result = a * b.
 * Column-major index(i,j) = i + 4*j.
 */

function mul4(a: number[], b: number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[row + 4 * k]! * b[k + 4 * col]!;
      out[row + 4 * col] = sum;
    }
  }
  return out;
}

/** 2D translate(x, y) as column-major 4x4; y defaults to 0. */

function matTranslate(x: number, y: number): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, 0, 1];
}

/** 2D scale(sx, sy); sy defaults to sx. */

function matScale(sx: number, sy: number): number[] {
  return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** 2D rotate by an angle in degrees, about the origin. */

function matRotate(deg: number): number[] {
  const t = deg * DEG;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** 2D skewX / skewY by an angle in degrees. */

function matSkew(ax: number, ay: number): number[] {
  const tx = Math.tan(ax * DEG);
  const ty = Math.tan(ay * DEG);
  return [1, ty, 0, 0, tx, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
/** Round for display and normalise -0, NaN and Infinity into CSS-safe text. */

function fmt(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) < 1e-12) value = 0;
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return String(rounded);
}

/** CSS matrix(a, b, c, d, e, f) from the 2D projections of a column-major 4x4. */

function asMatrix2d(m: number[], digits: number): string {
  const a = m[0]!;
  const b = m[1]!;
  const c = m[4]!;
  const d = m[5]!;
  const e = m[12]!;
  const f = m[13]!;
  return `matrix(${fmt(a, digits)}, ${fmt(b, digits)}, ${fmt(c, digits)}, ${fmt(d, digits)}, ${fmt(e, digits)}, ${fmt(f, digits)})`;
}

/** CSS matrix3d with column-major 16 values. */
/**
 * Decompose a 2D affine matrix into translate, rotate, scale and skewX.
 *
 * QR-style split: the first column (m11, m21) gives scaleX; project the second
 * column onto the unit first column to get the shear; remove it and the
 * remainder's length is scaleY. A negative determinant means the matrix
 * mirrors, which is reported rather than folded into a spurious 180-degree
 * rotation.
 */

function decompose2d(m: number[]): Decomp | null {
  let a = m[0]!;
  let b = m[1]!;
  let c = m[4]!;
  let d = m[5]!;
  const e = m[12]!;
  const f = m[13]!;

  const sx = Math.hypot(a, b);
  if (sx !== 0) {
    a /= sx;
    b /= sx;
  }
  const shear = a * c + b * d;
  c -= a * shear;
  d -= b * shear;
  const sy = Math.hypot(c, d);
  const det = a * d - b * c;
  const mirrored = det < 0;
  if (mirrored) {
    a = -a;
    b = -b;
  }
  const rotateDeg = (Math.atan2(b, a) * 180) / Math.PI;
  const skewX = Math.atan(shear) * (180 / Math.PI);
  return {
    translate: { x: e, y: f },
    rotateDeg: Math.abs(rotateDeg) < 1e-9 ? 0 : rotateDeg,
    scale: { x: sx, y: sy },
    skewX: Math.abs(skewX) < 1e-9 ? 0 : skewX,
    mirrored,
  };
} /** Split a transform string on top-level commas, honouring nested parens. */

/**
 * Split a transform value into its function groups on top-level whitespace,
 * e.g. "translate(10px) scale(2) rotate(45deg)" becomes three groups.
 * A boundary is a closing paren at depth zero followed by whitespace.
 */
function splitTransformList(s: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i] ?? '';
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (depth === 0 && /\s/u.test(ch) && cur.trim() !== '') {
      groups.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '') groups.push(cur.trim());
  return groups;
}

function splitTopLevelCommas(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '') parts.push(cur);
  return parts;
}

/** Validate that all parens in a transform string are balanced. */

function parensBalanced(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}
function parseFunction(raw: string, findings: Finding[]): TransformFunc | null {
  const open = raw.indexOf('(');
  const close = raw.lastIndexOf(')');
  if (open < 0 || close < 0 || close < open) {
    findings.push({
      severity: 'error',
      kind: 'syntax',
      detail: `Missing parentheses in "${raw}".`,
    });
    return null;
  }
  const name = raw.slice(0, open).trim().toLowerCase();
  const inner = raw.slice(open + 1, close).trim();

  if (THREE_D_FUNCS.has(name)) {
    findings.push({
      severity: 'error',
      kind: 'unsupported-3d',
      detail: `"${name}()" is a 3D transform and is not supported.`,
    });
    return null;
  }
  const arity = ARITY[name];
  if (arity === undefined) {
    findings.push({
      severity: 'error',
      kind: 'unknown-function',
      detail: `Unknown transform function "${name}".`,
    });
    return null;
  }
  const rawArgs = inner === '' ? [] : splitTopLevelCommas(inner).map((a) => a.trim());
  if (rawArgs.length < arity[0] || rawArgs.length > arity[1]) {
    const expect = arity[0] === arity[1] ? `${arity[0]}` : `${arity[0]}..${arity[1]}`;
    findings.push({
      severity: 'error',
      kind: 'arity',
      detail: `"${name}" takes ${expect} argument${arity[1] === 1 ? '' : 's'} but got ${rawArgs.length}.`,
    });
    return null;
  }
  const converter = argConverter(name);
  const args: number[] = [];
  for (const ra of rawArgs) {
    const v = converter ? converter(ra) : null;
    if (v === null) {
      findings.push({
        severity: 'error',
        kind: 'argument',
        detail: `Cannot read "${ra}" as an argument of ${name}().`,
      });
      return null;
    }
    args.push(v);
  }
  if (rawArgs.some((a) => a.trim().endsWith('%'))) {
    findings.push({
      severity: 'warn',
      kind: 'percentage',
      detail: `${name}() uses a percentage; with no element box given it is read as a px value.`,
    });
  }
  return { name, args, is2D: true };
}
const THREE_D_FUNCS = new Set([
  'matrix3d',
  'translatez',
  'translate3d',
  'scalez',
  'scale3d',
  'rotatex',
  'rotatey',
  'rotate3d',
  'perspective',
]);

/** Minimum and maximum argument counts for each supported 2D function. */
const ARITY: Record<string, [number, number]> = {
  translate: [1, 2],
  translatex: [1, 1],
  translatey: [1, 1],
  scale: [1, 2],
  scalex: [1, 1],
  scaley: [1, 1],
  rotate: [1, 1],
  rotatez: [1, 1],
  skew: [1, 2],
  skewx: [1, 1],
  skewy: [1, 1],
  matrix: [6, 6],
};

function numberArg(token: string): number | null {
  const m = /^(-?\d*\.?\d+)$/u.exec(token.trim());
  if (m === null) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function lengthArg(token: string): number | null {
  const m = /^(-?\d*\.?\d+)(px|%)?$/u.exec(token.trim());
  if (m === null) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function angleArg(token: string): number | null {
  const t = token.trim();
  if (/[a-z]/iu.test(t)) return angleToDeg(t);
  return numberArg(t);
}

/** Read a numeric argument for a given 
function name, or null when unknown. */

function argConverter(name: string): ((token: string) => number | null) | null {
  if (name === 'translate' || name === 'translatex' || name === 'translatey') return lengthArg;
  if (name === 'scale' || name === 'scalex' || name === 'scaley') return numberArg;
  if (name === 'matrix') return numberArg;
  if (
    name === 'rotate' ||
    name === 'rotatez' ||
    name === 'skew' ||
    name === 'skewx' ||
    name === 'skewy'
  ) {
    return angleArg;
  }
  return null;
} /** Build the 4x4 matrix for a single parsed 2D transform function. */

function funcToMatrix(f: TransformFunc): number[] {
  const a = f.args;
  switch (f.name) {
    case 'translate':
      return matTranslate(a[0] ?? 0, a[1] ?? 0);
    case 'translatex':
      return matTranslate(a[0] ?? 0, 0);
    case 'translatey':
      return matTranslate(0, a[0] ?? 0);
    case 'scale':
      return matScale(a[0] ?? 1, a[1] ?? a[0] ?? 1);
    case 'scalex':
      return matScale(a[0] ?? 1, 1);
    case 'scaley':
      return matScale(1, a[0] ?? 1);
    case 'rotate':
    case 'rotatez':
      return matRotate(a[0] ?? 0);
    case 'skew':
      return matSkew(a[0] ?? 0, a[1] ?? 0);
    case 'skewx':
      return matSkew(a[0] ?? 0, 0);
    case 'skewy':
      return matSkew(0, a[0] ?? 0);
    case 'matrix':
      return matMatrix2d(a);
    default:
      return identity4();
  }
}

/** matrix(a, b, c, d, e, f) -> column-major 4x4. */

function matMatrix2d(v: number[]): number[] {
  const a = v[0] ?? 0;
  const b = v[1] ?? 0;
  const c = v[2] ?? 0;
  const d = v[3] ?? 0;
  const e = v[4] ?? 0;
  const f = v[5] ?? 0;
  return [a, b, 0, 0, c, d, 0, 0, 0, 0, 1, 0, e, f, 0, 1];
}
function emptyModel(source: string, round: number): Model {
  return {
    source,
    functions: [],
    findings: [],
    is3D: false,
    matrix: null,
    det2: null,
    invertible: true,
    decomp: null,
    round,
  };
}

function det2Of(m: number[]): number {
  return m[0]! * m[5]! - m[4]! * m[1]!;
}

function buildModel(text: string, round: number): Model {
  const model = emptyModel(text, round);
  const trimmed = text.trim();
  if (trimmed === '') {
    model.findings.push({ severity: 'error', kind: 'empty', detail: 'No transform was given.' });
    return model;
  }
  if (!parensBalanced(trimmed)) {
    model.findings.push({
      severity: 'error',
      kind: 'syntax',
      detail: 'Unbalanced parentheses in the transform value.',
    });
    return model;
  }

  const rawFuncs = splitTransformList(trimmed);
  if (rawFuncs.length > MAX_FUNCS) {
    model.findings.push({
      severity: 'error',
      kind: 'too-many',
      detail: `More than ${MAX_FUNCS} functions.`,
    });
    return model;
  }

  const parsed: TransformFunc[] = [];
  for (const raw of rawFuncs) {
    const f = parseFunction(raw, model.findings);
    if (f !== null) parsed.push(f);
  }
  model.functions = parsed;
  model.is3D = model.findings.some((x) => x.kind === 'unsupported-3d');
  if (model.findings.some((x) => x.severity === 'error')) return model;

  let m = identity4();
  for (const f of parsed) m = mul4(m, funcToMatrix(f));
  model.matrix = m;
  model.det2 = det2Of(m);
  model.invertible = Math.abs(model.det2) > 1e-12;
  model.decomp = decompose2d(m);
  return model;
}
function functionsTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Function', 'Arguments', 'Kind'];
  const rows = m.functions.map((f) => {
    const args = f.args.map((a, i) => {
      const isAngle =
        (f.name === 'rotate' ||
          f.name === 'rotatez' ||
          f.name === 'skew' ||
          f.name === 'skewx' ||
          f.name === 'skewy') &&
        i === 0;
      return isAngle ? `${a}deg` : String(a);
    });
    return [f.name, args.join(', '), f.is2D ? '2D' : '3D'];
  });
  return { headers, rows };
}
function findingsTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Severity', 'Kind', 'Detail'];
  const rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
  if (rows.length === 0) rows.push(['info', 'ok', 'No findings.']);
  return { headers, rows };
}

function matrixTable(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Property', 'Value'];
  const rows: string[][] = [];
  if (m.matrix === null) {
    rows.push(['Matrix', '(no matrix)']);
    return { headers, rows };
  }
  rows.push(['matrix()', asMatrix2d(m.matrix, m.round)]);
  rows.push(['Determinant', fmt(m.det2 ?? 0, m.round)]);
  rows.push(['Invertible', m.invertible ? 'yes' : 'no']);
  const d = m.decomp;
  if (d !== null) {
    rows.push(['Translate', `${fmt(d.translate.x, m.round)}, ${fmt(d.translate.y, m.round)}`]);
    rows.push(['Rotate', `${fmt(d.rotateDeg, m.round)}deg`]);
    rows.push(['Scale', `${fmt(d.scale.x, m.round)}, ${fmt(d.scale.y, m.round)}`]);
    rows.push(['SkewX', `${fmt(d.skewX, m.round)}deg`]);
    rows.push(['Mirrored', d.mirrored ? 'yes' : 'no']);
  }
  return { headers, rows };
}
function runModel(m: Model): string {
  const errors = m.findings.filter((x) => x.severity === 'error').length;
  const warns = m.findings.filter((x) => x.severity === 'warn').length;
  const lines = [`Functions: ${m.functions.length}`, `Errors: ${errors}`, `Warnings: ${warns}`];
  if (m.matrix !== null) {
    lines.push(`matrix(): ${asMatrix2d(m.matrix, m.round)}`);
    lines.push(`Determinant: ${fmt(m.det2 ?? 0, m.round)}`);
    lines.push(`Invertible: ${m.invertible ? 'yes' : 'no'}`);
  }
  return lines.join('\n');
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    let text = input.text ?? '';
    if (file !== undefined) {
      if (file.size > MAX_BYTES) {
        throw new ToolError(
          `File is larger than ${MAX_BYTES} bytes.`,
          'Provide a shorter transform value.',
        );
      }
      text = await file.text();
    }
    const round = Number.isFinite(Number(options.round))
      ? Math.max(0, Math.min(10, Math.round(Number(options.round))))
      : 4;
    const m = buildModel(text, round);
    const view = String(options.format ?? 'summary');

    let report: FileRunResult['report'];
    if (view === 'functions') {
      report = { output: JSON.stringify(functionsTable(m)), render: 'table' };
    } else if (view === 'matrix') {
      report = { output: JSON.stringify(matrixTable(m)), render: 'table' };
    } else if (view === 'findings') {
      report = { output: JSON.stringify(findingsTable(m)), render: 'table' };
    } else {
      report = { output: runModel(m), language: 'text' };
    }
    const notes: string[] = [];
    if (m.findings.some((x) => x.severity === 'error'))
      notes.push('Some functions could not be parsed; see Findings.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
