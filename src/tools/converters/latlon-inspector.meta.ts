import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'latlon-inspector',
  name: 'Latitude / Longitude Inspector',
  category: 'converters',
  summary:
    'Parse a latitude and longitude on-device: decimal and DMS forms, hemisphere, range checks.',
  description:
    'Paste a coordinate in decimal degrees (40.7128, -74.0060) or in degrees-minutes-seconds (40°42\'46.08"N 74°0\'21.6"W) and read it without uploading it. The tool detects which notation was used, parses the latitude and longitude, and reports both the decimal-degree form and the DMS form together with the hemisphere. It checks that the latitude is within -90 to 90 degrees and the longitude within -180 to 180 degrees, and flags malformed input such as a missing hemisphere, an out-of-range value, or a component that is not a number.',
  keywords: [
    'latitude',
    'longitude',
    'latlon',
    'coordinates',
    'dms',
    'decimal degrees',
    'gps',
    'geo',
    'hemisphere',
    'convert',
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
        { value: 'dms', label: 'DMS breakdown' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [
    {
      title: 'A decimal coordinate pair',
      input: '40.7128,-74.0060',
    },
    {
      title: 'A degrees-minutes-seconds pair',
      input: '40 42 51.7 N, 74 0 21.5 W',
    },
    {
      title: 'A latitude out of range',
      input: '95.0,-74.0060',
    },
  ],
  related: ['geojson-validator', 'ip-address-inspector', 'file-metadata', 'url-parse'],
  status: 'stable',
};
