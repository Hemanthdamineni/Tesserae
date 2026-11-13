import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'ldif-inspector',
  name: 'LDIF Inspector',
  category: 'data',
  summary: 'Inspect an LDIF directory file on-device: entries, DNs, attributes and syntax errors.',
  description:
    'Paste an LDIF (LDAP Data Interchange Format) file and inspect it without uploading it. The tool reads each entry, reports its distinguished name (DN), counts the attribute lines, and lists the distinct attribute types that appear. It flags an entry with no DN, a line without a colon separator, a continuation line with no attribute before it, and a base64 value that will not decode, so a directory import can be checked before it is run. The summary view gives the counts, the entries view lists every entry with its attributes, and the issues view lists structural problems.',
  keywords: [
    'ldif',
    'ldap',
    'directory',
    'dn',
    'distinguished name',
    'attribute',
    'entry',
    'import',
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
        { value: 'entries', label: 'Entries' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [
    {
      title: 'Two directory entries',
      input:
        'dn: uid=alice,ou=people,dc=example,dc=com\nuid: alice\nobjectClass: inetOrgPerson\ncn: Alice Adams\nsn: Adams\nmail: alice@example.com\n\ndn: uid=bob,ou=people,dc=example,dc=com\nuid: bob\nobjectClass: inetOrgPerson\ncn: Bob Brown\nsn: Brown\nmail: bob@example.com',
    },
    {
      title: 'An entry with a missing dn',
      input:
        'uid: carol\nobjectClass: inetOrgPerson\ncn: Carol Cruz\nsn: Cruz\nmail: carol@example.com',
    },
    {
      title: 'An attribute line with no colon',
      input:
        'dn: uid=dave,ou=people,dc=example,dc=com\ncn Dave Davis\nsn: Davis\nobjectClass: inetOrgPerson',
    },
  ],
  related: ['x509-certificate-inspector', 'vcf-inspector', 'ics-validator', 'properties-convert'],
  status: 'stable',
};
