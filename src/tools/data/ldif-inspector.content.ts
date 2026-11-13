/**
 * Editorial content for the ldif-inspector tool page.
 *
 * Kept out of ``ldif-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is LDIF?',
      a: 'LDAP Data Interchange Format is the plain-text format used to represent LDAP directory entries and change operations: one or more attribute lines per entry, separated by a blank line, optionally with a distinguished name (dn) line first.',
    },
    {
      q: 'What does the inspector check?',
      a: 'It reports the entry and attribute counts, flags entries with a duplicate or missing dn, detects attribute lines with missing colons, and warns about lines that are neither attributes nor valid continuations.',
    },
    {
      q: 'Do I need an LDAP server to use this?',
      a: 'No. The tool works purely on the pasted text, so you can review an LDIF before an import or spot a formatting error without touching a directory service.',
    },
  ],
} as const;
