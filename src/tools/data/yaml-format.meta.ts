import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'yaml-format',
  name: 'YAML Formatter & Validator',
  category: 'data',
  summary: 'Format and validate YAML locally, preserving comments and document streams.',
  description:
    'Parse YAML 1.2 documents and re-emit them with consistent indentation. Comments, anchors, aliases and multi-document streams are handled by the yaml parser. Syntax errors and duplicate keys are reported without producing partial output.',
  keywords: [
    'yaml formatter',
    'yaml beautifier',
    'yaml validator',
    'format yaml',
    'pretty print yaml',
    'yml formatter',
    'yaml prettifier',
    'yaml',
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
    { title: 'Format mapping', input: 'name: Tesserae\ntags: [a,b]\n' },
    { title: 'Nested data', input: 'service:\n    enabled: true\n    ports: [8080, 8081]\n' },
    { title: 'Multi-document stream', input: '---\nname: first\n---\nname: second\n' },
  ],
  related: ['yaml-to-json', 'json-to-yaml', 'xml-format'],
  credits: [{ name: 'yaml', url: 'https://github.com/eemeli/yaml', license: 'ISC' }],
  status: 'stable',
};
