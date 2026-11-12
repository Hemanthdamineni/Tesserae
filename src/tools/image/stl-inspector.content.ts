/**
 * Editorial content for the stl-inspector tool page.
 *
 * Kept out of ``stl-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is an STL file?',
      a: 'STL describes a 3D surface as a triangle mesh. It exists in a binary form with an 80-byte header and a triangle count, and an ASCII form of facet blocks with vertices.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the format (binary or ASCII), the triangle count, and the bounding box, and flags a binary file whose declared count does not match the remaining bytes or a triangle with a degenerate or reversed normal.',
    },
    {
      q: 'Is the model uploaded?',
      a: 'No. The mesh is parsed in your browser only, so a proprietary or unreleased model file never leaves your machine.',
    },
  ],
} as const;
