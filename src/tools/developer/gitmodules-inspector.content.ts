/**
 * Editorial content for the gitmodules-inspector tool page.
 *
 * Kept out of ``gitmodules-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is a .gitmodules file?',
      a: 'It is the file that records the submodules of a Git repository. Each submodule is a block that names the path and the URL it is cloned from, with optional branch, ignore and shallow options.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It lists every submodule with its path and URL, flags a submodule whose URL is a git: or http: scheme rather than https: or ssh, and warns about a path that is absolute or escapes the repository.',
    },
    {
      q: 'Does it read my repository config?',
      a: 'No. The tool works on the pasted file only, so a private submodule URL or a path to an internal server is never resolved or transmitted.',
    },
  ],
} as const;
