/**
 * Editorial content for the delta-e tool page.
 *
 * Kept out of `delta-e.meta.ts` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it measures',
      body: 'Paste two colors, one per line (hex, rgb(), hsl(), or a common CSS color name), and the tool reports how perceptually different they look. Each color is converted to CIE Lab through the D65 sRGB pipeline, then the gap is measured with three standard formulae: CIEDE2000 (the current CIE recommendation and the closest match to human vision), CIE76 (plain Euclidean distance in Lab, which overstates small differences), and CIE94. The output also shows the Lab, LCh and XYZ components of both colors so you can see why two near-identical hues land the way they do.',
    },
    {
      heading: 'Reading the number',
      body: 'The result comes with a plain-language reading of the difference: below about 1 is imperceptible, around 2.3 is the just-noticeable difference, 5 to 10 is clearly visible, and larger values are dramatically different. That scale is what makes the tool useful for picking genuinely distinct brand or UI colors instead of a pair that only differs in the original RGB space while looking almost the same to a human eye.',
    },
    {
      heading: 'Why three formulae',
      body: 'The colour-difference problem has no single answer, so the tool computes all three standards and lets you choose one with the metric option. CIE76 is the simplest and the least accurate for saturated colors; CIE94 adds weighting for graphic arts; CIEDE2000 refines hue and lightness weighting further and is the current recommendation. Comparing the three numbers at once is a quick way to see how much the choice of formula changes the verdict.',
    },
    {
      heading: 'Running on-device',
      body: 'Everything is computed entirely in this tab: colors are parsed and the Lab, LCh and XYZ pipelines run locally, nothing is uploaded, and the tool works fully offline. The text field accepts up to 100,000 characters of free text, and color-like tokens are pulled out in order, so you can paste a paragraph and compare the colors it mentions.',
    },
  ],
  faq: [
    {
      q: 'Which color formats are accepted?',
      a: 'Each line can be a hex value, an rgb() or hsl() function, or a common CSS color name. The free-text mode also pulls color-like tokens out of whatever you paste, in order, and compares the first two it finds.',
    },
    {
      q: 'What does a ΔE of 1 mean?',
      a: 'Under CIEDE2000, a difference below about 1 is generally imperceptible, and around 2.3 is the just-noticeable difference. Values from 5 to 10 are clearly visible, and larger values are dramatically different.',
    },
    {
      q: 'Why do two colors that look alike in RGB report a large ΔE?',
      a: 'RGB distance does not match human perception. The tool converts both colors to CIE Lab through the D65 sRGB pipeline and measures there, so two colors that differ only slightly in a way the eye notices will score accordingly.',
    },
    {
      q: 'Is the color data sent anywhere?',
      a: 'No. The colors are parsed and compared entirely on-device, the tool makes no network requests, and it works fully offline.',
    },
  ],
} as const;
