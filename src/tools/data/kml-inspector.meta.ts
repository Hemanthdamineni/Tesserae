import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'kml-inspector',
  name: 'KML Placemark Inspector',
  category: 'data',
  summary:
    'Read a KML map file on-device: placemarks, points, lines, polygons, folders and styles.',
  description:
    'Drop in a KML file from Google Earth or any mapping tool and inspect it without uploading it. The tool parses the XML to count the placemarks and to break them down by geometry: points, line strings and polygons. It also counts folders, styles and coordinate tuples, and lists each placemark with its name and geometry type. It flags a malformed file when the XML does not parse, when there is no kml root element, or when no placemark is present. Your map data never leaves the device.',
  keywords: [
    'kml',
    'kmz',
    'google earth',
    'map',
    'placemark',
    'point',
    'polygon',
    'coordinates',
    'gis',
    'geo',
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
        { value: 'placemarks', label: 'Placemarks' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a KML map file' }],
  related: ['gpx-track-stats', 'tcx-inspector', 'geojson-validator', 'latlon-inspector'],
  status: 'stable',
};
