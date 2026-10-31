/**
 * Editorial content for the css-transform-inspector tool page.
 *
 * Kept out of `css-transform-inspector.meta.ts` so the eager client registry
 * never ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Paste a CSS transform value such as "translate(10px, 20px) scale(2) rotate(45deg)" and the tool parses the transform function list, composes every step into a single 2D affine matrix or 3D 4x4 matrix, and reports the result in CSS matrix()/matrix3d() form. It then decomposes the matrix back into translate, rotate, scale and skew components so you can see the net effect even when functions are chained and the order of operations is not obvious.',
    },
    {
      heading: 'Why a single matrix matters',
      body: 'CSS applies transforms left to right, so translate(10px,20px) scale(2) and scale(2) translate(10px,20px) are different end results. Composing the chain into one matrix removes the guesswork: the functions view lists each step in order, and the matrix view shows the one combined transformation that the browser will actually apply.',
    },
    {
      heading: 'Invertibility and the determinant',
      body: 'The tool reports whether the transform is invertible. A determinant of zero means the matrix collapses space — it cannot be undone — as with scale(1, 0), which flattens the y axis. Non-invertible transforms are a common source of subtle bugs, so the findings view calls them out explicitly.',
    },
    {
      heading: 'Errors and 3D detection',
      body: 'The parser flags syntax problems such as unbalanced parentheses, a wrong argument count, an unknown function or an unparseable number, and it checks whether a 3D transform is actually a 2D one. The decimals option controls how many places the reported numbers are rounded. Everything runs on-device, so the transform never leaves this tab.',
    },
  ],
  faq: [
    {
      q: 'What does "not invertible" mean?',
      a: 'A transform with a determinant of zero collapses space along at least one axis — for example scale(1, 0) flattens the y axis. Such a transform cannot be undone, which is why the tool flags it as not invertible.',
    },
    {
      q: 'Does order matter between transform functions?',
      a: 'Yes. CSS composes transforms left to right, so translate(10px, 20px) scale(2) and scale(2) translate(10px, 20px) produce different final matrices. The tool composes the whole chain into one matrix so you can see the actual combined effect.',
    },
    {
      q: 'What is the difference between matrix() and matrix3d()?',
      a: 'matrix() is a 2D affine matrix with six values, while matrix3d() is a full 4x4 matrix with sixteen. The tool reports a 2D result in matrix() form, and a 3D one in matrix3d() form, and it also detects a 3D transform that is actually 2D.',
    },
    {
      q: 'Is the transform sent anywhere?',
      a: 'No. The transform is parsed, composed and decomposed entirely on-device; nothing is transmitted and the tool works fully offline.',
    },
  ],
} as const;
