import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'whois-inspector',
  name: 'Whois Inspector',
  category: 'network',
  summary: 'Inspect a WHOIS record on-device: registrar, dates, name servers, statuses and org.',
  description:
    'Paste a WHOIS domain record and inspect it without uploading it. The tool reads the common WHOIS fields and reports the domain name, registrar, creation date, expiry date, the name servers, the domain statuses, and the registrant organization, counting repeated fields. It flags a record with no domain name, no creation date, or no registrar, a record that reports no match or not found, and a line whose field name is unknown. The summary view gives the counts, the record view lists every field, and the issues view lists structural problems.',
  keywords: [
    'whois',
    'domain',
    'registrar',
    'name server',
    'expiry',
    'creation',
    'status',
    'rdap',
    'inspector',
    'network',
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
        { value: 'record', label: 'Record' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [
    {
      title: 'Inspect a WHOIS record',
      input: [
        'Domain Name: EXAMPLE.COM',
        'Registrar: Example Registrar LLC',
        'Creation Date: 2000-01-01T05:00:00Z',
        'Registry Expiry Date: 2027-01-01T05:00:00Z',
        'Name Server: NS1.EXAMPLE.COM',
        'Name Server: NS2.EXAMPLE.COM',
      ].join('\n'),
    },
    {
      title: 'Flag a no-match response',
      input: 'No match found for this domain.',
    },
    {
      title: 'Flag a record with missing fields',
      input: ['Domain Name: BARE.COM', 'Status: clientTransferProhibited'].join('\n'),
    },
  ],
  related: ['ip-address-inspector', 'cidr-calculator', 'punycode', 'x509-certificate-inspector'],
  status: 'stable',
};
