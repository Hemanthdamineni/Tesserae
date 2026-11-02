/**
 * Editorial content for the xcf-inspector tool page.
 *
 * Kept out of `xcf-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The XCF header',
      body: 'A GIMP XCF file starts with the nine bytes "gimp xcf ", followed by a version string, then the canvas width and height and a base type byte that says whether the image is RGB, grayscale or indexed. The inspector verifies the magic, reports the version it found, and decodes those header fields without loading the image or decompressing any layer. The value here is a quick structural check before opening a large project in an editor.',
    },
    {
      heading: 'The property list',
      body: 'After the header comes a property list: typed entries terminated by a zero type. The inspector walks the list, decoding the properties it knows, including the compression scheme (RLE or fractal) and the horizontal and vertical resolution, and reports the type, size and value of every entry. Unknown properties are still listed with their raw type and size, so a newer GIMP file does not produce a misleading empty report.',
    },
    {
      heading: 'Layers, channels and masks',
      body: 'Layer, channel and mask properties each carry the structure that follows. The inspector counts them and says how many the file declares, which is a useful sanity check when a project is unexpectedly large or when a file was saved from a script. It does not decode pixel data or the layer hierarchy itself; that would require implementing the XCF layer format, which is beyond a header reader.',
    },
    {
      heading: 'Problems it flags',
      body: 'The tool warns when the magic is missing, when the version is not one it understands, and when a property block runs past the end of the file. A file that is too short to hold a header is rejected with an explicit error. Files up to 512 MB are supported, the parse runs in the tab, and the file is never uploaded or modified.',
    },
  ],
  faq: [
    {
      q: 'Can the inspector open or convert the image?',
      a: 'No. It reads the header and property list only. Rendering a GIMP project requires the full layer format and its compression, so use GIMP or a converter for that.',
    },
    {
      q: 'Does it show how many layers a file has?',
      a: 'Yes. Layer, channel and mask properties are counted and reported in the summary, which is enough to compare a file against what you expected to save.',
    },
    {
      q: 'What does compression RLE or fractal mean?',
      a: 'It is the scheme GIMP used for the image data, not a container compression. The inspector reports which one the property list declares so you know how the pixels are stored.',
    },
    {
      q: 'Why does it say the version is unsupported?',
      a: 'XCF has changed over GIMP releases. The inspector understands the common header layouts and says so when the version string does not match one it can parse, rather than guessing at offsets.',
    },
  ],
} as const;
