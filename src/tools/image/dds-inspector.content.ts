/**
 * Editorial content for the dds-inspector tool page.
 *
 * Kept out of `dds-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a DirectDraw Surface (.dds) file and the tool validates the DDS magic, then reads the DDS_HEADER: its size, the header flags, the height and width, the pitch or linear size, the volume depth, the mipmap count and the caps flags. The DDS_PIXELFORMAT is decoded next, translating the four-character code into its common meaning — DXT1, DXT3, DXT5, BC4U, BC5S, or a raw RGB/RGBA layout with its bit masks. Everything runs on-device.',
    },
    {
      heading: 'What a DDS header carries',
      body: 'Beyond the pixel dimensions, a DDS header records how the texture is meant to be used: the header flags say whether width, height, pitch, depth and mipmaps are meaningful; the volume depth matters for 3D textures; and the mipmap count says how many levels of pre-filtered detail are included. The pixel format block then names the encoding, which determines both the on-disk size and how a GPU decompresses the data.',
    },
    {
      heading: 'Why block-compressed formats matter',
      body: 'Most GPU textures are not plain RGB pixels but block-compressed formats such as DXT1, DXT3, DXT5 or the newer BC4/BC5 variants. They trade a little quality for far smaller memory and bandwidth, which is why a texture is often smaller than width × height × 4 bytes would imply. The tool decodes the fourCC into that format so you can see whether a texture is a common block format or a bespoke raw layout.',
    },
    {
      heading: 'Catching a corrupt texture',
      body: 'The tool computes the expected payload length from the declared dimensions and format and compares it with the header, then flags a bad magic, a truncated header, a pixel format size mismatch, an unknown fourCC and a payload that disagrees with the header. A texture that fails to load in a game engine usually trips one of these checks.',
    },
  ],
  faq: [
    {
      q: 'What is a mipmap count?',
      a: 'Mipmaps are progressively smaller pre-filtered copies of the texture used for level-of-detail rendering. The mipmap count field says how many of these levels the file contains; a value of 1 typically means just the base image with no smaller levels.',
    },
    {
      q: 'What do the fourCC codes DXT1, DXT3, DXT5 mean?',
      a: 'They are the four-character codes for common block-compressed formats. DXT1 stores 4 bits per pixel with no alpha, DXT3 and DXT5 store 8 bits per pixel with explicit and interpolated alpha respectively, and BC4/BC5 are single- and two-channel variants. The tool translates the raw code into these meanings.',
    },
    {
      q: 'Is my texture sent anywhere?',
      a: 'No. The header and pixel format are parsed entirely on-device, so a DDS file can be inspected offline with nothing leaving the browser.',
    },
    {
      q: 'Why does the payload length sometimes disagree with the file?',
      a: 'The tool derives the expected length from the dimensions, format and mipmap count and compares it with the declared pitch or linear size. A mismatch is a strong sign of a truncated file, a corrupted header, or a fourCC that was misread.',
    },
  ],
} as const;
