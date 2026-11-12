/**
 * Editorial content for the exr-inspector tool page.
 *
 * Kept out of ``exr-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is an OpenEXR image?',
      a: 'OpenEXR is a high-dynamic-range image format used in film and photography. A file begins with a magic number, a version and a header of channel, attribute and data-window records before the pixel data.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the display and data windows, the channel names and their pixel types, and flags a header with a channel count that does not match the data or a data window with invalid bounds.',
    },
    {
      q: 'Do I need a viewer installed?',
      a: 'No. The header is parsed on-device without decoding pixels, so an EXR can be checked on a machine that has no image application for the format.',
    },
  ],
} as const;
