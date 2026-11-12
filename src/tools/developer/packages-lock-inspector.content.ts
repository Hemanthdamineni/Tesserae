/**
 * Editorial content for the packages-lock-inspector tool page.
 *
 * Kept out of ``packages-lock-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is a package-lock.json?',
      a: 'It is the dependency-resolution snapshot npm writes alongside a project: it records every resolved package, its version, integrity hash and which other packages require it, so installs are reproducible.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the total package count, the lockfile version, flags an entry whose resolved or integrity field is missing, and warns about a package that appears at several different versions.',
    },
    {
      q: 'Is the lockfile uploaded?',
      a: 'No. The JSON is parsed in your browser only, so a lockfile from a private registry or monorepo never leaves your machine.',
    },
  ],
} as const;
