/**
 * Editorial content for the tga-inspector tool page.
 *
 * Kept out of ``tga-inspector.meta.ts`` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a Truevision Targa (TGA) image and the tool reads the 18-byte header, reporting the image ID length, color map type, and image type — uncompressed or RLE, and whether it is colormapped, truecolor, or grayscale. It also reports the color map spec (first entry, length, bits per entry), the X/Y origin and width and height, the pixel depth, and the image descriptor (alpha channel bits and the pixel origin, top-left or bottom-left). Everything runs on-device with no upload.',
    },
    {
      heading: 'Offset, origin and footer',
      body: 'The data offset tells you where pixel data actually begins, and the origin bits in the descriptor say whether the first row is at the top or bottom of the image. The tool also detects whether a TRUEVISION-XFILE footer signature is present, which marks a TGA that carries a developer area and extension data.',
    },
    {
      heading: 'The problems it flags',
      body: 'The inspector catches the classic faults: a truncated header, an unsupported image type, a color map spec that overruns the file, and a data offset past the end of the file. That makes it a fast way to diagnose a TGA that fails to open or that was cut short.',
    },
  ],
  faq: [
    {
      q: 'Is my image uploaded?',
      a: 'No. The TGA header and footer are parsed entirely on-device in this tab, with no network calls.',
    },
    {
      q: 'What is the image type field?',
      a: 'It says whether the pixel data is uncompressed or run-length encoded (RLE) and how the pixels are stored — colormapped, truecolor, or grayscale. The tool translates the numeric field into that description.',
    },
    {
      q: 'What does the origin tell me?',
      a: "The image descriptor's origin bits state whether the first row of data is the top or bottom of the image. Targas can store rows in either order, and the tool reports which one a file uses.",
    },
    {
      q: 'What is the TRUEVISION-XFILE footer?',
      a: 'It is an optional footer signature that marks a Targa carrying a developer area and extension data. The tool checks for it and reports whether it is present.',
    },
  ],
} as const;
