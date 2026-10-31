/**
 * Editorial content for the tiff-inspector tool page.
 *
 * Kept out of ``tiff-inspector.meta.ts`` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a TIFF image (.tiff or .tif) and the tool detects the byte order — little-endian II or big-endian MM — verifies the 42 magic, then walks every entry in the Image File Directory (IFD), reporting its tag number and name, type (BYTE, ASCII, SHORT, LONG, RATIONAL), count, and decoded value. Parsing is entirely on-device; nothing is uploaded.',
    },
    {
      heading: 'Reading the high-value tags',
      body: 'The tool translates the important tags into their meaning: width and height, bits per sample, compression method (none, LZW, PackBits, Deflate, JPEG), photometric interpretation (WhiteIsZero, BlackIsZero, RGB, Palette, CMYK), samples per pixel, strip offsets and byte counts, resolution and its unit, and the software tag. It also follows inline values versus out-of-line offsets, so a tag whose data lives elsewhere in the file is still decoded correctly.',
    },
    {
      heading: 'The problems it flags',
      body: 'The inspector catches the classic faults: a bad byte order or magic, an IFD offset outside the file, and a truncated entry. That is useful for diagnosing a TIFF produced by an unusual writer or damaged in transfer, where the directory pointers no longer resolve.',
    },
  ],
  faq: [
    {
      q: 'Is my image uploaded?',
      a: 'No. The TIFF header and IFD entries are parsed entirely on-device in this tab, with no network calls.',
    },
    {
      q: 'What is the byte order field?',
      a: 'The first two bytes are "II" for little-endian or "MM" for big-endian, and the tool reports which one a file uses, then interprets the 42 magic and all IFD values accordingly.',
    },
    {
      q: 'What is an IFD?',
      a: 'The Image File Directory is the list of tag entries that describe an image — dimensions, compression, photometric interpretation, resolution, and more. The tool walks every entry and decodes its type, count, and value.',
    },
    {
      q: 'Why do inline values vs offsets matter?',
      a: 'Small tag values are stored directly in the directory entry; larger ones live at an offset elsewhere in the file. The tool follows those offsets so multi-value and long tags decode correctly rather than appearing as a raw pointer.',
    },
  ],
} as const;
