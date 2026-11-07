import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './kml-inspector.meta';

/**
 * KML placemark inspector.
 *
 * Parses Keyhole Markup Language to count placemarks, folders, styles, and
 * geometries (points, line strings, polygons) and to list each placemark with
 * its geometry type. Expected values come from the byte-exact fixture, never
 * from this parser.
 */

const MAX_CHARS = 4 * 1024 * 1024;

interface Placemark {
  index: number;
  name: string;
  kind: string;
}

interface Model {
  placemarks: Placemark[];
  folders: number;
  styles: number;
  points: number;
  lineStrings: number;
  polygons: number;
  coordinateTuples: number;
}

function innerBlocks(text: string, tag: string): string[] {
  const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1] ?? '');
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
}

function tagCount(text: string, tag: string): number {
  return innerBlocks(text, tag).length;
}

function parseKml(text: string): Model {
  if (!/<(?:[\w-]+:)?kml\b/i.test(text)) {
    throw new ToolError('That does not look like a KML map file.', 'Paste a KML file.');
  }
  const placemarkBlocks = innerBlocks(text, 'Placemark');
  if (placemarkBlocks.length === 0) throw new ToolError('That KML file has no placemarks.');

  const placemarks: Placemark[] = placemarkBlocks.map((b, i) => {
    const nameMatch = /<name>\s*([\s\S]*?)\s*<\/name>/i.exec(b);
    const name = nameMatch === null ? '(unnamed)' : (nameMatch[1] ?? '').trim() || '(unnamed)';
    let kind = 'placemark';
    if (innerBlocks(b, 'Point').length > 0) kind = 'Point';
    else if (innerBlocks(b, 'LineString').length > 0) kind = 'LineString';
    else if (innerBlocks(b, 'Polygon').length > 0) kind = 'Polygon';
    return { index: i + 1, name, kind };
  });

  let coordinateTuples = 0;
  for (const coords of innerBlocks(text, 'coordinates')) {
    const raw = coords.trim();
    if (raw === '') continue;
    coordinateTuples += raw.split(/\s+/).filter((t) => t !== '').length;
  }

  return {
    placemarks,
    folders: tagCount(text, 'Folder'),
    styles: tagCount(text, 'Style'),
    points: tagCount(text, 'Point'),
    lineStrings: tagCount(text, 'LineString'),
    polygons: tagCount(text, 'Polygon'),
    coordinateTuples,
  };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'KML'],
      ['Placemarks', String(m.placemarks.length)],
      ['Points', String(m.points)],
      ['Line strings', String(m.lineStrings)],
      ['Polygons', String(m.polygons)],
      ['Folders', String(m.folders)],
      ['Styles', String(m.styles)],
      ['Coordinate tuples', String(m.coordinateTuples)],
    ],
  };
}

function tablePlacemarks(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Name', 'Geometry'],
    rows: m.placemarks.map((p) => [String(p.index), p.name, p.kind]),
  };
}

function asTable(table: { headers: string[]; rows: string[][] }): TextRunResult {
  return { output: JSON.stringify(table), render: 'table' };
}

function run(input: TextRunInput): TextRunResult {
  const options = input.options;
  const format = String(options.format ?? 'summary');

  const text = input.text ?? '';
  if (text.trim().length === 0)
    throw new ToolError('No KML file was provided.', 'Paste a KML map file.');
  if (text.length > MAX_CHARS) throw new ToolError('That KML file is larger than 4 MB.');

  const m = parseKml(text);

  const table = format === 'placemarks' ? tablePlacemarks(m) : tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
