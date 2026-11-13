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
  examples: [
    {
      title: 'A single purchase-order interchange',
      input:
        'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260108*1200*U*00401*000000001*0*P*~\nGS*PO*SENDER*RECEIVER*20261108*1200*1*X*004010\nST*850*0001\nBEG*00*SA*PO-1001**20261108\nSE*3*0001\nGE*1*1\nIEA*1*000000001',
    },
    {
      title: 'An empty functional group',
      input:
        'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260108*1200*U*00401*000000002*0*P*~\nGS*PO*SENDER*RECEIVER*20261108*1200*1*X*004010\nGE*-social*1\nIEA*1*000000002',
    },
    {
      title: 'A custom element separator',
      input:
        'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260108*1200*U*00401*000000003*0*P*>||\nGS*PO*SENDER*RECEIVER*20261108*1200*1*X*004010>|1\nST*850*0001>|1\nBEG*00*SA*PO-1002**20261108>|1\nSE*3*0001>|1\nGE*1*1>|1\nIEA*1*000000003>|1',
    },
  ],
  related: ['ics-validator', 'bibtex-validator', 'json-schema-check', 'csv-profiler'],
  status: 'stable',
};
