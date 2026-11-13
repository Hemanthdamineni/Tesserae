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
  examples: [
    {
      title: 'Two placemarks and a folder',
      input:
        '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Stops</name>\n    <Placemark>\n      <name>First</name>\n      <Point><coordinates>-73.99,40.73,0</coordinates></Point>\n    </Placemark>\n    <Folder>\n      <name>North</name>\n      <Placemark>\n        <name>Second</name>\n        <Point><coordinates>-74.01,40.71,0</coordinates></Point>\n      </Placemark>\n    </Folder>\n  </Document>\n</kml>',
    },
    {
      title: 'A coordinate out of range',
      input:
        '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Placemark>\n    <name>Bad lat</name>\n    <Point><coordinates>-73.99,95.0,0</coordinates></Point>\n  </Placemark>\n</kml>',
    },
    {
      title: 'An unclosed placemark',
      input:
        '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Placemark>\n    <name>Broken</name>\n    <Point><coordinates>-73.99,40.73,0</coordinates></Point>\n</kml>',
    },
  ],
  related: ['gpx-track-stats', 'tcx-inspector', 'geojson-validator', 'latlon-inspector'],
  status: 'stable',
};
