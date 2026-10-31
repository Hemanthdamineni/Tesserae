/**
 * Editorial content for the ico-inspector tool page.
 *
 * Kept out of `ico-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a Windows icon file (.ico) and the tool verifies the 6-byte header (the reserved field, the type marker that must be 1, and the image count), then walks every 16-byte directory entry, reporting the image width and height, palette colour count, colour planes, bit depth, embedded data size and file offset, and the embedded image format. It detects whether each image is a PNG (8-byte signature) or a classic BMP/DIB bitmap (BM signature plus AND and XOR masks). Everything runs on-device.',
    },
    {
      heading: 'A directory of images',
      body: 'An ICO is a small directory followed by the images themselves. The 6-byte header counts how many images are present, and each 16-byte directory entry records where one image lives, how big it is, its colour depth and whether it carries a palette. Reading those entries is what lets the tool list every size and depth a favicon or program icon bundles.',
    },
    {
      heading: 'PNG or classic DIB',
      body: 'Modern ICO files often embed PNG images, recognised by their 8-byte signature, while older ones embed classic BMP/DIB bitmaps that add AND and XOR masks for transparency. The tool detects which format each entry holds, which matters because PNG-in-ICO is not supported on every platform.',
    },
    {
      heading: 'Catching a corrupt icon',
      body: 'The tool flags a reserved header field that is not zero, a type that is not 1, a truncated header or directory, an entry whose data overruns the file, and a directory offset past the end of the data. An icon that fails to render or shows garbage usually trips one of these checks.',
    },
  ],
  faq: [
    {
      q: 'What does the type marker of 1 mean?',
      a: 'The header field holds the icon type. A value of 1 marks a Windows icon (.ico); 2 would be a cursor (.cur), which this tool does not parse. When the type is not 1, the file is not a plain ICO and is flagged accordingly.',
    },
    {
      q: 'Why does one ICO hold several images?',
      a: 'An icon file bundles multiple images so the OS can pick the right size and colour depth for each display context — a 16×16 taskbar icon, a 32×32 window iconaine and a 256×256 large icon. The directory entries are those variants, and each is listed with its dimensions and bit depth.',
    },
    {
      q: 'Is my icon uploaded anywhere?',
      a: 'No. The header, directory and embedded-image signatures are parsed on-device, so an ICO can be inspected offline with nothing leaving the browser.',
    },
  ],
} as const;
