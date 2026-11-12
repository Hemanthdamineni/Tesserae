/**
 * Editorial content for the netrc-inspector tool page.
 *
 * Kept out of ``netrc-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is a .netrc file?',
      a: 'It is a Unix credentials file used by curl, ftp and other network tools. Each machine block lists the host, and the login and password credentials to use with it, with an optional default machine block.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the machine entries, flags a line with the wrong number of tokens, and warns about a default machine that is not last or a machine block with no password.',
    },
    {
      q: 'Are my credentials shown?',
      a: 'The inspector reports the structure and masks the password fields, so a .netrc pasted as evidence or reviewed on screen never exposes a stored secret.',
    },
  ],
} as const;
