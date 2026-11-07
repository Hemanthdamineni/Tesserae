import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'iif-inspector',
  name: 'QuickBooks IIF Inspector',
  category: 'data',
  summary:
    'Read a QuickBooks IIF data file on-device: sections, records, fields and structural issues.',
  description:
    'Paste or drop a QuickBooks IIF (tab-separated) data file and inspect it without uploading it. The inspector splits the file into header rows and data rows, identifies the record sections (TRNS transactions, SPL splits, ACCNT accounts, CUST customers and the rest), and reports how many records each section holds and which fields its header row defines. It flags structural problems: a data row whose field count does not match its section header, a section marker with no corresponding end marker, an END marker with no matching section, and a row with no tab at all. The summary view gives the section and record counts and the records view lists each section with its fields and count.',
  keywords: [
    'iif',
    'quickbooks',
    'import',
    'intuit',
    'accounting',
    'transaction',
    'split',
    'customer',
    'tab-separated',
    'inspector',
    'data',
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
        { value: 'records', label: 'Record list' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a QuickBooks IIF data file' }],
  related: ['csv-to-ics', 'x12-inspector', 'bibtex-validator', 'json-schema-check'],
  status: 'stable',
};
