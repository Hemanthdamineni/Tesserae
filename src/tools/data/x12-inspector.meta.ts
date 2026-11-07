import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'x12-inspector',
  name: 'X12 EDI Inspector',
  category: 'data',
  summary:
    'Read an ANSI X12 EDI document on-device: segments, ISA/GS/ST envelopes, control numbers and issues.',
  description:
    'Paste or drop an ANSI X12 EDI interchange (a purchase order, an invoice, a shipping notice, a healthcare claim) and inspect it without uploading it. The inspector splits the document into segments on the tilde terminator and elements on the asterisk, then reports the interchange, functional-group and transaction-set envelopes: the ISA control number, the GS group count, the ST transaction-set identifier and its control number, the number of segments in each transaction, and the total element count. It flags structural problems: a segment with no tilde terminator, a transaction set whose ST and SE control numbers do not match, a GS/GE or ISA/IEA control-number mismatch, and a first segment that is not an ISA. The summary view gives the headline counts and the transactions view lists each ST set so a malformed interchange can be found before it is rejected by a trading partner.',
  keywords: [
    'x12',
    'edi',
    'interchange',
    'functional group',
    'transaction set',
    'isa',
    'gs',
    'st',
    'segment',
    '850',
    'invoice',
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
        { value: 'transactions', label: 'Transactions' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Inspect an X12 EDI interchange' }],
  related: ['ics-validator', 'bibtex-validator', 'json-schema-check', 'csv-profiler'],
  status: 'stable',
};
