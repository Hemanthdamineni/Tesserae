import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'vcf-inspector',
  name: 'vCard (VCF) Inspector',
  category: 'data',
  summary:
    'Read a vCard contact file on-device: cards, fields, parameters, addresses and structural issues.',
  description:
    'Paste or drop a vCard (.vcf) contact file from any address book and inspect it without uploading it. The tool counts the VCARD entries, lists each card field with its parameters (such as TYPE=CELL on a phone number or TYPE=HOME on an address), and reports structural problems: a card missing its VERSION or FN (the formatted name), a BEGIN:VCARD with no matching END:VCARD, a field line with no colon, or a duplicate FN across cards. The summary view shows the card and field counts, the cards view lists each contact with its key fields, and the issues view explains every problem so a contact export can be repaired before it is imported.',
  keywords: [
    'vcf',
    'vcard',
    'contact',
    'address book',
    'fn',
    'tel',
    'email',
    'adr',
    'uid',
    'inspect',
    'validate',
    'people',
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
        { value: 'cards', label: 'Card list' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a vCard contact file' }],
  related: ['ics-validator', 'vcard', 'bibtex-validator', 'csv-to-ics'],
  status: 'stable',
};
