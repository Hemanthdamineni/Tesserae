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
  examples: [
    {
      title: 'A short running activity',
      input:
        '<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">\n  <Activities>\n    <Activity Sport="Running">\n      <Id>2026-11-08T09:00:00Z</Id>\n      <Lap StartTime="2026-11-08T09:00:00Z">\n        <TotalTimeSeconds>1200</TotalTimeSeconds>\n        <DistanceMeters>4000</DistanceMeters>\n        <Track>\n          <Trackpoint>\n            <Time>2026-11-08T09:00:00Z</Time>\n            <Position><LatitudeDegrees>40.7128</LatitudeDegrees><LongitudeDegrees>-74.0060</LongitudeDegrees></Position>\n            <DistanceMeters>0</DistanceMeters>\n          </Trackpoint>\n          <Trackpoint>\n            <Time>2026-11-08T09:20:00Z</Time>\n            <Position><LatitudeDegrees>40.7129</LatitudeDegrees><LongitudeDegrees>-74.0059</LongitudeDegrees></Position>\n            <DistanceMeters>4000</DistanceMeters>\n          </Trackpoint>\n        </Track>\n      </Lap>\n    </Activity>\n  </Activities>\n</TrainingCenterDatabase>',
    },
    {
      title: 'A trackpoint with no time',
      input:
        '<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">\n  <Activities>\n    <Activity Sport="Running">\n      <Id>2026-11-08T09:00:00Z</Id>\n      <Lap StartTime="2026-11-08T09:00:00Z">\n        <Track>\n          <Trackpoint>\n            <Position><LatitudeDegrees>40.7128</LatitudeDegrees><LongitudeDegrees>-74.0060</LongitudeDegrees></Position>\n          </Trackpoint>\n        </Track>\n      </Lap>\n    </Activity>\n  </Activities>\n</TrainingCenterDatabase>',
    },
    {
      title: 'A latitude out of range',
      input:
        '<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">\n  <Activities>\n    <Activity Sport="Running">\n      <Id>2026-11-08T09:00:00Z</Id>\n      <Lap StartTime="2026-11-08T09:00:00Z">\n        <Track>\n          <Trackpoint>\n            <Time>2026-11-08T09:00:00Z</Time>\n            <Position><LatitudeDegrees>99.5</LatitudeDegrees><LongitudeDegrees>-74.0060</LongitudeDegrees></Position>\n          </Trackpoint>\n        </Track>\n      </Lap>\n    </Activity>\n  </Activities>\n</TrainingCenterDatabase>',
    },
  ],
  related: ['gpx-track-stats', 'latlon-inspector', 'csv-to-ics', 'xml-format'],
  status: 'stable',
};
