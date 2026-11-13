/**
 * Editorial content for the x12-inspector tool page.
 *
 * Kept out of ``x12-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is an X12 EDI interchange?',
      a: 'ANSI X12 is the EDI standard used in supply chain, healthcare and logistics. An interchange begins with an ISA segment, continues with GS functional-group segments and their transaction sets, and ends with IEA and ISA trailer segments.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the interchange, group and transaction counts, the sender and receiver from ISA05/ISA06, and flags unbalanced segments or a segment count that does not match the number of lines that follow.',
    },
    {
      q: 'Are the element delimiters handled automatically?',
      a: 'Yes. The inspector reads the element and component separators declared in ISA16, so a file using a custom delimiter is still parsed and validated correctly.',
    },
  ],
} as const;
