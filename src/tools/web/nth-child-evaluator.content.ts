/**
 * Editorial content for the nth-child-evaluator tool page.
 *
 * Kept out of `nth-child-evaluator.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it evaluates',
      body: 'Paste a CSS selector like ":nth-child(2n+1)" or ":nth-of-type(-n+3)" and the tool parses the An+B microsyntax from the CSS Values spec into its (A, B) coefficients, covering the keywords even and odd as well as forms like n, 2n, -n+3, 0n+5 and a bare integer such as 3. It validates the grammar and reports parse errors, so you know immediately whether the selector is well formed.',
    },
    {
      heading: 'Seeing which children match',
      body: 'For any count of children N it lists the matching indices — the children selected by the formula — checks whether a specific 1-based index matches, and shows the first several matches. That makes it easy to confirm that :nth-child(3n+1) selects the 1st, 4th, 7th, … children, or that :nth-of-type(-n+3) selects just the first three of a kind.',
    },
    {
      heading: 'An+B in plain terms',
      body: 'The A is the cycle length and B is the offset: indices B, A+B, 2A+B, … are selected, stopping when the list runs out. even and odd are the common special cases, and a bare integer like 5 selects exactly the 5th child. Understanding the two coefficients is all you need to predict the selection without building a test list.',
    },
    {
      heading: 'Running on-device',
      body: 'Everything is parsed and evaluated entirely in this tab, so the selector is never sent anywhere and the tool works fully offline. You can vary the children count and a single test index to explore the same formula against different list sizes.',
    },
  ],
  faq: [
    {
      q: 'What is the difference between :nth-child and :nth-of-type?',
      a: ':nth-child counts all sibling children, while :nth-of-type counts only siblings of the same element type. The tool evaluates the same An+B coefficients for either pseudo-class, so you can compare how the two select against the same list.',
    },
    {
      q: 'What do the A and B in An+B mean?',
      a: 'A is the cycle length and B is the offset: the formula selects indices B, A+B, 2A+B and so on, stopping at the last child. even is 2n, odd is 2n+1, and a bare integer such as 3 is just the constant 3.',
    },
    {
      q: 'Can I test a specific index?',
      a: 'Yes. The index option takes a single 1-based child index and the tool reports whether that child is selected by the formula, alongside the full list of matches for the current children count.',
    },
    {
      q: 'Is the selector sent anywhere?',
      a: 'No. The selector is parsed and evaluated entirely on-device; nothing is transmitted and the tool works fully offline.',
    },
  ],
} as const;
