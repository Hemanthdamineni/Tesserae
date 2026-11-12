/**
 * Editorial content for the procfile-validator tool page.
 *
 * Kept out of ``procfile-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is a Procfile?',
      a: 'It is a text file that declares the process types a web app runs, one per line, in the form process_type: command, such as web: node server.js. It is used by Heroku and foreman-style process managers.',
    },
    {
      q: 'What does the validator report?',
      a: 'It reports the declared process types, flags a line with no colon or no command after it, and warns about duplicate process types or an empty file that defines no process at all.',
    },
    {
      q: 'Do I need a runtime to run this?',
      a: 'No. The file is validated purely as text, so you can check a Procfile before it is committed or before a deploy that depends on it.',
    },
  ],
} as const;
