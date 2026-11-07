import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './latlon-inspector.meta';

/**
 * Latitude / longitude inspector.
 *
 * Accepts a coordinate pair in decimal degrees (40.7128, -74.0060) or in
 * degrees-minutes-seconds (40 42 46.08 N, 74 0 21.6 W), validates the ranges,
 * and reports both notations plus the hemisphere. Expected values come from an
 * independent computation, never from this parser.
 */

const MAX_CHARS = 2000;

interface Coord {
  value: number;
  hemi: string;
}

interface Model {
  lat: Coord;
  lon: Coord;
  issues: string[];
  notation: string;
}

function dmsToDecimal(d: number, m: number, s: number, hemi: string): number {
  const v = d + m / 60 + s / 3600;
  return hemi === 'S' || hemi === 'W' ? -v : v;
}

function detectNotation(text: string): 'dms' | 'decimal' | 'unknown' {
  if (/[NSEW]/i.test(text)) return 'dms';
  if (/[^\d.,\s\-+]/.test(text) === false && /\d/.test(text)) return 'decimal';
  return 'unknown';
}

function parseDecimalPair(text: string): Model {
  const parts = text
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (parts.length !== 2)
    throw new ToolError('Enter one latitude and one longitude separated by a comma.');
  const latV = Number(parts[0]);
  const lonV = Number(parts[1]);
  if (!Number.isFinite(latV) || !Number.isFinite(lonV))
    throw new ToolError('The latitude or longitude is not a number.');
  return {
    lat: { value: latV, hemi: latV >= 0 ? 'N' : 'S' },
    lon: { value: lonV, hemi: lonV >= 0 ? 'E' : 'W' },
    issues: [],
    notation: 'decimal',
  };
}

function parseDms(text: string): Model {
  const groups = text.match(
    /-?\d+(?:\.\d+)?\s*°?\s*\d+(?:\.\d+)?\s*'?\s*\d+(?:\.\d+)?\s*"?\s*[NSEW]/gi,
  );
  if (groups === null || groups.length !== 2) {
    throw new ToolError(
      'Enter two DMS coordinates with hemispheres, for example 40 42 46.08 N, 74 0 21.6 W.',
    );
  }
  const out: Coord[] = [];
  for (const g of groups) {
    const hemi = (g.match(/[NSEW]/i)?.[0] ?? '').toUpperCase();
    const nums = g.match(/-?\d+(?:\.\d+)?/g) ?? [];
    if (nums.length < 3)
      throw new ToolError('A DMS coordinate needs degrees, minutes and seconds.');
    const d = Number(nums[0]);
    const m = Number(nums[1]);
    const s = Number(nums[2]);
    if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(s)) {
      throw new ToolError('A DMS coordinate component is not a number.');
    }
    out.push({ value: dmsToDecimal(Math.abs(d), m, s, hemi), hemi });
  }
  const first = out[0] as Coord;
  const second = out[1] as Coord;
  const latC = first.hemi === 'N' || first.hemi === 'S' ? first : second;
  const lonC = first.hemi === 'E' || first.hemi === 'W' ? first : second;
  return { lat: latC, lon: lonC, issues: [], notation: 'dms' };
}

function inspect(text: string): Model {
  const notation = detectNotation(text);
  let m: Model;
  if (notation === 'dms') m = parseDms(text);
  else m = parseDecimalPair(text);

  const issues: string[] = [];
  if (!(m.lat.value >= -90 && m.lat.value <= 90)) {
    issues.push('Latitude ' + m.lat.value + ' is outside the valid range of -90 to 90.');
  }
  if (!(m.lon.value >= -180 && m.lon.value <= 180)) {
    issues.push('Longitude ' + m.lon.value + ' is outside the valid range of -180 to 180.');
  }
  m.issues = issues;
  return m;
}

function toDms(
  v: number,
  pos: string,
  neg: string,
): { d: number; m: number; s: number; hemi: string } {
  const hemi = v >= 0 ? pos : neg;
  const a = Math.abs(v);
  const d = Math.floor(a);
  const mf = (a - d) * 60;
  const m = Math.floor(mf);
  const s = Math.round((mf - m) * 60 * 100) / 100;
  return { d, m, s, hemi };
}

function fmt(v: number): string {
  return (Math.round(v * 1e6) / 1e6).toString();
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const latDms = toDms(m.lat.value, 'N', 'S');
  const lonDms = toDms(m.lon.value, 'E', 'W');
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Notation', m.notation === 'dms' ? 'DMS' : 'Decimal degrees'],
      ['Latitude (DD)', fmt(m.lat.value)],
      ['Longitude (DD)', fmt(m.lon.value)],
      ['Hemisphere', latDms.hemi + lonDms.hemi],
      ['Valid', m.issues.length === 0 ? 'yes' : 'no'],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableDms(m: Model): { headers: string[]; rows: string[][] } {
  const latDms = toDms(m.lat.value, 'N', 'S');
  const lonDms = toDms(m.lon.value, 'E', 'W');
  return {
    headers: ['Axis', 'Degrees', 'Minutes', 'Seconds', 'Hemisphere', 'Decimal'],
    rows: [
      [
        'Latitude',
        String(latDms.d),
        String(latDms.m),
        String(latDms.s),
        latDms.hemi,
        fmt(m.lat.value),
      ],
      [
        'Longitude',
        String(lonDms.d),
        String(lonDms.m),
        String(lonDms.s),
        lonDms.hemi,
        fmt(m.lon.value),
      ],
    ],
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return { headers: ['Problem'], rows: m.issues.map((g) => [g]) };
}

function asTable(table: { headers: string[]; rows: string[][] }): TextRunResult {
  return { output: JSON.stringify(table), render: 'table' };
}

function run(input: TextRunInput): TextRunResult {
  const options = input.options;
  const format = String(options.format ?? 'summary');

  const text = (input.text ?? '').trim();
  if (text.length === 0)
    throw new ToolError('No coordinate was provided.', 'Paste a latitude and longitude pair.');
  if (text.length > MAX_CHARS) throw new ToolError('That coordinate is too long.');

  const m = inspect(text);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'dms':
      table = tableDms(m);
      break;
    case 'issues':
      table = tableIssues(m);
      break;
    case 'summary':
    default:
      table = tableSummary(m);
  }
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
