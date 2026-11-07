import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-yaml',
  name: 'JSON to YAML',
  category: 'data',
  summary: 'Convert JSON to YAML on your device, with a 2- or 4-space indent.',
  description:
    'Parse a JSON document and re-serialise it as YAML. Invalid JSON is reported with a hint. Everything runs locally — nothing is uploaded.',
  keywords: [
    'json to yaml',
    'json2yaml',
    'convert json to yaml',
    'yaml',
    'json',
    'data format',
    'serialize',
    'serialise',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'indent',
      label: 'Indent',
      type: 'select',
      default: '2',
      choices: [
        { value: '2', label: '2 spaces' },
        { value: '4', label: '4 spaces' },
      ],
    },
  ],
  examples: [
    {
      title: 'Object to YAML',
      input: '{ "name": "Tesserae", "tags": ["a", "b"] }',
    },
    {
      title: 'Nested object, 4-space indent',
      input: '{ "server": { "host": "localhost", "port": 8080 } }',
      options: { indent: '4' },
    },
    {
      title: 'Array of records',
      input: '[{"id":1,"name":"a"},{"id":2,"name":"b"}]',
    },
  ],
  related: ['yaml-to-json', 'json-to-csv', 'csv-to-json'],
  credits: [{ name: 'yaml', url: 'https://github.com/eemeli/yaml', license: 'ISC' }],
  status: 'stable',
};
