/**
 * Editorial content for the codeowners-validator tool page.
 *
 * Kept out of ``codeowners-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is a CODEOWNERS file?',
      a: 'It is a plain-text file that maps path patterns to the users or teams who own them)Skip a slash or empty line is ignored and a line beginning with # is a comment, while the rest is a path pattern followed by one or more owners.',
    },
    {
      q: 'What does the validator report?',
      a: 'It reports the number of rules, flags a pattern with no owner, warns about a pattern that matches nothing in a typical tree, and lists the owners mentioned more than once so a file stays tidy.',
    },
    {
      q: 'Do I need GitHub to use this?',
      a: 'No. The syntax it checks is the GitHub flavour, but the file itself is parsed on-device, so you can review or lint a CODEOWNERS before it is committed to any platform.',
    },
  ],
} as const;
