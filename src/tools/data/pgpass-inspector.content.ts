/**
 * Editorial content for the pgpass-inspector tool page.
 *
 * Kept out of ``pgpass-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is a .pgpass file?',
      a: 'It is the password file libpq reads when connecting to PostgreSQL without a password prompt. Each line holds hostname, port, database, username and password, each field separated by a colon, with an optional leading host or line comment.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the number of credential entries, flags lines with the wrong number of fields or an empty password where one is not permitted, and notes the use of the * wildcard in host, port or database.',
    },
    {
      q: 'Does the inspector display my passwords?',
      a: 'It reports the structure, not the secrets. The password fields are masked so a .pgpass shown on screen or shared as evidence never exposes credentials.',
    },
  ],
} as const;
