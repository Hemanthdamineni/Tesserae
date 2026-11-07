import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './tcx-inspector.meta';

/**
 * Garmin TCX activity inspector.
 *
 * Parses Training Center XML to report activities, laps and trackpoints, and
 * summarizes heart rate and cadence plus total distance and duration. Expected
 * values come from the byte-exact fixture, never from this parser.
 */

const MAX_CHARS = 4 * 1024 * 1024;

interface Lap {
  index: number;
  duration: number;
  distance: number;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
}

interface Model {
  activities: number;
  laps: Lap[];
  trackpoints: number;
  hrMin: number | null;
  hrMax: number | null;
  hrAvg: number | null;
  cadenceMax: number | null;
  totalDistance: number;
  totalDuration: number;
  issues: string[];
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

function firstNum(text: string, tag: string): number | null {
  const re = new RegExp('<' + tag + '\\b[^>]*>\\s*([-\\d.]+)\\s*</' + tag + '>', 'i');
  const m = re.exec(text);
  if (m === null) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function parseTcx(text: string): Model {
  const issues: string[] = [];
  if (!/<(?:[\w-]+:)?TrainingCenterDatabase\b/i.test(text)) {
    throw new ToolError('That does not look like a TCX activity file.', 'Paste a Garmin TCX file.');
  }
  if (!/<(?:[\w-]+:)?Activities\b/i.test(text)) {
    throw new ToolError('That TCX file has no Activity section.');
  }

  const activityBlocks = innerBlocks(text, 'Activity');
  const lapBlocks = innerBlocks(text, 'Lap');
  const trackpointBlocks = innerBlocks(text, 'Trackpoint');

  if (lapBlocks.length === 0) throw new ToolError('That TCX file has no laps.');
  if (trackpointBlocks.length === 0) throw new ToolError('That TCX file has no trackpoints.');

  const laps: Lap[] = lapBlocks.map((b, i) => {
    const avgHrBlock = innerBlocks(b, 'AverageHeartRateBpm')[0] ?? '';
    const maxHrBlock = innerBlocks(b, 'MaximumHeartRateBpm')[0] ?? '';
    return {
      index: i + 1,
      duration: firstNum(b, 'TotalTimeSeconds') ?? 0,
      distance: firstNum(b, 'DistanceMeters') ?? 0,
      avgHr: firstNum(avgHrBlock, 'Value'),
      maxHr: firstNum(maxHrBlock, 'Value'),
      calories: firstNum(b, 'Calories'),
    };
  });

  // heart rate + cadence from trackpoints
  const hrValues: number[] = [];
  const cadences: number[] = [];
  for (const tp of trackpointBlocks) {
    const hrBlock = innerBlocks(tp, 'HeartRateBpm')[0] ?? '';
    const hr = firstNum(hrBlock, 'Value');
    if (hr !== null) hrValues.push(hr);
    const cad = firstNum(tp, 'Cadence');
    if (cad !== null) cadences.push(cad);
  }

  const hrMin = hrValues.length > 0 ? Math.min(...hrValues) : null;
  const hrMax = hrValues.length > 0 ? Math.max(...hrValues) : null;
  const hrAvg = hrValues.length > 0 ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : null;
  const cadenceMax = cadences.length > 0 ? Math.max(...cadences) : null;

  const totalDistance = laps.reduce((a, l) => a + l.distance, 0);
  const totalDuration = laps.reduce((a, l) => a + l.duration, 0);

  return {
    activities: activityBlocks.length,
    laps,
    trackpoints: trackpointBlocks.length,
    hrMin,
    hrMax,
    hrAvg,
    cadenceMax,
    totalDistance,
    totalDuration,
    issues,
  };
}

function fmt1(v: number | null): string {
  if (v === null) return '(none)';
  return (Math.round(v * 100) / 100).toString();
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'TCX'],
      ['Activities', String(m.activities)],
      ['Laps', String(m.laps.length)],
      ['Trackpoints', String(m.trackpoints)],
      ['Heart rate min', fmt1(m.hrMin)],
      ['Heart rate max', fmt1(m.hrMax)],
      ['Heart rate avg', fmt1(m.hrAvg)],
      ['Cadence max', fmt1(m.cadenceMax)],
      ['Total distance (m)', fmt1(m.totalDistance)],
      ['Total duration (s)', fmt1(m.totalDuration)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableLaps(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Lap', 'Duration (s)', 'Distance (m)', 'Avg HR', 'Max HR', 'Calories'],
    rows: m.laps.map((l) => [
      String(l.index),
      fmt1(l.duration),
      fmt1(l.distance),
      fmt1(l.avgHr),
      fmt1(l.maxHr),
      fmt1(l.calories),
    ]),
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

  const text = input.text ?? '';
  if (text.trim().length === 0)
    throw new ToolError('No TCX file was provided.', 'Paste a Garmin TCX activity file.');
  if (text.length > MAX_CHARS) throw new ToolError('That TCX file is larger than 4 MB.');

  const m = parseTcx(text);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'laps':
      table = tableLaps(m);
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
