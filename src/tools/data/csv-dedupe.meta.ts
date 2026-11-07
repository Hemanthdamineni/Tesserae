import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'csv-dedupe',
  name: 'CSV Duplicate Remover',
  category: 'data',
  summary: 'Remove duplicate rows from a CSV on-device, respecting quotes and embedded delimiters.',
  description:
    'Paste a CSV and remove or inspect duplicate rows without uploading it. The tool parses the CSV with proper quote handling, so commas inside quoted fields and escaped quotes are read correctly. It reports how many rows are duplicates, which ones, and a preview of the deduplicated result. You can dedupe by the whole row or by a chosen set of columns, so a record that differs only in a timestamp can still be collapsed. The summary view gives the original, distinct and removed row counts, the duplicates view lists the repeated rows, and the result view shows the first occurrence of every distinct row.',
  keywords: [
    'csv',
    'dedupe',
    'duplicate',
    'remove duplicates',
    'unique',
    'rows',
    'columns',
    'spreadsheet',
    'clean',
    'data',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  acceptsText: true,
  options: [
    {
      key: 'mode',
      label: 'Action',
      type: 'select',
      default: 'dedupe',
      choices: [
        { value: 'dedupe', label: 'Report and preview' },
        { value: 'by-column', label: 'Dedupe by column' },
      ],
    },
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'duplicates', label: 'Duplicates' },
        { value: 'result', label: 'Result' },
      ],
    },
  ],
  examples: [{ title: 'Remove duplicate rows from a CSV' }],
  related: ['csv-diff', 'csv-sanitize', 'csv-profiler', 'dedupe-lines'],
  status: 'stable',
};
