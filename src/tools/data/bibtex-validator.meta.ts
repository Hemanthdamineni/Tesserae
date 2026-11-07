import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'bibtex-validator',
  name: 'BibTeX Validator',
  category: 'data',
  summary:
    'Validate a BibTeX bibliography on-device: entries, mandatory fields, duplicate keys and syntax problems.',
  description:
    'Paste or drop a BibTeX bibliography (.bib) file and check it without uploading anything. The validator parses each @type{key, field = {value}, ...} entry, counts entries and field usage, and reports structural problems: a missing or malformed entry key, a field with no closing brace, a duplicated citation key, a mandatory field missing for that entry type (author and title for books and articles, editor for edited volumes), and a field value left empty. The summary view shows the entry and field counts, the entries view lists each key with its type and field count, and the issues view explains every problem so you can fix a bibliography before compiling a document with it.',
  keywords: [
    'bibtex',
    'bibliography',
    'citation',
    'references',
    'latex',
    'validate',
    'entry',
    'key',
    'field',
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
        { value: 'entries', label: 'Entry list' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Validate a BibTeX bibliography' }],
  related: ['json-schema-check', 'json-format', 'xml-format', 'dotenv'],
  status: 'stable',
};
