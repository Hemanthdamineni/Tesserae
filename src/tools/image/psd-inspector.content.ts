/**
 * Editorial content for the psd-inspector tool page.
 *
 * Kept out of ``psd-inspector.meta.ts`` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a Photoshop document (.psd or .psb) and the tool inspects its layered image structure. It verifies the 8BPS signature and the file version (1 for PSD, 2 for the large PSB format), then reports the channel count, image width and height, bit depth, and the color mode — translating the mode number into its common name such as Bitmap, Grayscale, Indexed, RGB, CMYK, Multichannel, Duotone or Lab. Nothing is uploaded; parsing runs entirely on-device.',
    },
    {
      heading: 'The four sections',
      body: 'After the header a PSD is a sequence of four length-prefixed sections. The tool reads the sizes of the color mode data, the image resources, the layer and mask information, and the image data, and reports the compression method used to store the flattened pixels — Raw, RLE, Zip, or Zip with prediction — so you can see at a glance how the visible composite is packed.',
    },
    {
      heading: 'The problems it flags',
      body: 'The inspector calls out the classic faults: a bad or missing 8BPS signature, an unexpected version, a non-zero reserved field, and section sizes that overrun the file. That makes it useful for diagnosing a PSD that other software refuses to open, or one that has been truncated in transfer.',
    },
  ],
  faq: [
    {
      q: 'Is my document uploaded?',
      a: 'No. The PSD header and sections are parsed entirely on-device in this tab, with no network calls and no upload.',
    },
    {
      q: 'What is the difference between PSD and PSB?',
      a: 'Both share the 8BPS signature; the difference is the version field — 1 is a standard PSD, 2 is the large-document PSB format. The tool reports which one a file declares.',
    },
    {
      q: 'What does the color mode tell me?',
      a: 'The mode number is mapped to its common name (Bitmap, Grayscale, Indexed, RGB, CMYK, Multichannel, Duotone or Lab), and the channel count and bit depth alongside it describe how each pixel is stored.',
    },
    {
      q: 'Why does the compression method matter?',
      a: 'The image data section stores the flattened pixels using one of several methods — Raw, RLE, Zip, or Zip with prediction. Knowing which one is used explains the file size and why some readers may struggle with it.',
    },
  ],
} as const;
