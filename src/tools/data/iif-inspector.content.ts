/**
 * Editorial content for the iif-inspector tool page.
 *
 * Kept out of ``iif-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is an IIF file?',
      a: 'Intuit Interchange Format (IIF) is the tab-delimited text format QuickBooks uses to import and export chart-of-accounts, transactions and list data. Each line begins with an exclamation-mark header like !TRNS or !SPL followed by columns.',
    },
    {
      q: 'What can the inspector tell me?',
      a: 'It reports the transaction and split record counts, the header types present, and common problems such as a split whose total does not match its parent transaction or rows that are not tab-delimited.',
    },
    {
      q: 'Is my accounting data kept private?',
      a: 'Yes. The file is parsed on your device and never uploaded, so account numbers, names and balances in the IIF stay in your browser.',
    },
  ],
} as const;
