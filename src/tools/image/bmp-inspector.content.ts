/**
 * Editorial content for the bmp-inspector tool page.
 *
 * Kept out of `bmp-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a Windows bitmap (.bmp) and the tool verifies the BM signature, then parses the BITMAPFILEHEADER for the file size, reserved fields and the pixel-data offset, and the BITMAPINFOHEADER (DIB header) for dimensions, planes, bits per pixel, compression method, image size, horizontal and vertical resolution and colour count. The compression field is decoded into its human name — none, RLE8, RLE4, bitfields, JPEG, PNG or alpha bitfields — and, for indexed images up to 8 bits per pixel, the colour palette size and entry count are reported.',
    },
    {
      heading: 'What the headers tell you',
      body: 'A BMP is two nested structures. The BITMAPFILEHEADER at the start records the total file size, two reserved fields that should be zero, and the offset where the pixel data begins. Right after it, the BITMAPINFOHEADER (a DIB header) holds the real geometry: pixel width and height, the number of colour planes (normally 1), the bits per pixel, and the compression method. Together they let you confirm whether a file is a plain uncompressed bitmap, an RLE-compressed one, or something with explicit bit masks, and whether a colour palette is present.',
    },
    {
      heading: 'Why a viewer and this inspector disagree',
      body: 'Images that look wrong in an editor usually have a structural problem this tool surfaces: a bad or missing BM signature, a pixel-data offset that falls outside the file, an image size declared in the header that does not match the actual bytes, or a colour palette that is larger than the file allows. When a BMP opens or renders oddly, checking these fields shows which declared value and which real file state diverge.',
    },
    {
      heading: 'Private and offline',
      body: 'The whole parse runs on-device in this tab. The file bytes are read locally for the header and palette fields and nothing is uploaded; you can inspect a bitmap even with the network turned off.',
    },
  ],
  faq: [
    {
      q: 'What does "bits per pixel" tell me?',
      a: 'It is the colour depth of the bitmap. Typical values are 1, 4, 8, 16, 24 and 32. Indexed images at 8 bits per pixel or fewer use a colour palette, which is why the tool reports palette size and entry count only for those depths; 24-bit and 32-bit bitmaps carry RGB or RGBA data directly.',
    },
    {
      q: 'What are the compression names it shows?',
      a: 'The tool maps the compression field to the standard BI_ values: 0 is none (BI_RGB), 1 is RLE8, 2 is RLE4, 3 is bitfields, and 4, 5 and 6 are the rarer JPEG, PNG and alpha bitfields encodings. That field explains why some BMPs are much smaller than an equal-size uncompressed one.',
    },
    {
      q: 'Is my file uploaded anywhere?',
      a: 'No. Parsing happens entirely on-device, so a BMP can be inspected offline with nothing leaving the browser. If you see a size or offset discrepancy, it reflects the actual file bytes, not a transmission issue.',
    },
    {
      q: 'Why do the reported resolution values matter?',
      a: 'The header stores horizontal and vertical resolution in pixels per metre. They do not change the pixel dimensions, but they are what a printer or viewer uses to decide physical size, which is why an image can look the wrong physical size even when its width and height in pixels are correct.',
    },
  ],
} as const;
