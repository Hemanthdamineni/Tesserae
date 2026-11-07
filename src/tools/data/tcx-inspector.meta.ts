import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'tcx-inspector',
  name: 'TCX Activity Inspector',
  category: 'data',
  summary: 'Read a Garmin TCX activity file on-device: laps, trackpoints, heart rate and cadence.',
  description:
    'Drop in a TCX (Training Center XML) activity file from a Garmin device or fitness app and inspect it without uploading it. The tool parses the XML to report the number of activities, laps and trackpoints, and summarizes heart rate (minimum, maximum and average) and cadence across the track, plus total distance and duration from the lap data. It flags a malformed file when the XML does not parse, when there is no TrainingCenterDatabase root, or when there are no laps or trackpoints. The summary view gives the headline activity numbers and the laps view lists each lap with its distance and duration.',
  keywords: [
    'tcx',
    'garmin',
    'training center',
    'activity',
    'workout',
    'laps',
    'trackpoints',
    'heart rate',
    'cadence',
    'fit',
    'inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'laps', label: 'Laps' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a TCX activity file' }],
  related: ['gpx-track-stats', 'latlon-inspector', 'csv-to-ics', 'xml-format'],
  status: 'stable',
};
