/**
 * Editorial content for the bibtex-validator tool page.
 *
 * Kept out of ``bibtex-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'How do I get my bibliography into BibTeX form?',
      a: 'Export a .bib file from a reference manager such as Zotero, JabRef or BibDesk, or paste the @article/@book/@inproceedings entries directly into the workbench. The validator parses the pasted text and reports missing braces, stray commas, duplicate citation keys and unknown entry types.',
    },
    {
      q: 'Which fields does the validator check?',
      a: 'It checks the required fields for each standard entry type (author, title, year, and the type-specific ones like journal or booktitle), plus the structural rules of the .bib grammar: balanced braces, comma-separated fields, and a unique key for every entry.',
    },
    {
      q: 'Is my bibliography uploaded anywhere?',
      a: 'No. The pasted text is parsed entirely in your browser tab, so a private manuscript reference list never leaves your machine and the tool works offline.',
    },
  ],
} as const;
