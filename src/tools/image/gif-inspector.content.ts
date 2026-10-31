/**
 * Editorial content for the gif-inspector tool page.
 *
 * Kept out of `gif-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a GIF and the tool reads the header (GIF87a or GIF89a) and the Logical Screen Descriptor, reporting canvas width and height, background colour, pixel aspect ratio, and whether a Global Color Table is present with its size and bit resolution. It then walks every block: image descriptors with their left/top offsets, width, height, local colour table and interlacing flags; Graphic Control Extensions with disposal method, delay time and transparency index; Application Extensions such as the NETSCAPE looping block; Comment and Plain Text extensions; and the trailer. Each frame is reported block by block with byte offsets.',
    },
    {
      heading: 'How an animation is assembled',
      body: 'A GIF animation is a stack of blocks rather than a single movie. The Logical Screen sets the canvas, a Global Color Table supplies default colours, and each image block redraws part of it with optional local colours. Graphic Control Extensions between frames set the delay and disposal, while the NETSCAPE Application Extension in the header controls looping. Reading these blocks in order is how the tool shows the real structure of an animated GIF.',
    },
    {
      heading: 'Interlacing and transparency',
      body: 'Two details explain many GIF quirks. An interlaced image descriptor marks an image stored in four passes so it can appear progressively while downloading. A transparency index in a Graphic Control Extension marks one palette entry as see-through, which is how GIFs get their characteristic hard-edged transparent corners rather than smooth alpha. The tool surfaces both flags so they are easy to spot.',
    },
    {
      heading: 'Catching a broken GIF',
      body: 'The tool flags the classic structural problems: a missing or wrong GIF magic, blocks that overrun the declared file size, and malformed extensions. When an image or animation plays incorrectly, one of these is usually the cause.',
    },
  ],
  faq: [
    {
      q: 'What is the difference between GIF87a and GIF89a?',
      a: 'GIF87a is the original format; GIF89a added extensions including Graphic Control, Comment and Application blocks. That is why the NETSCAPE looping block and transparency only appear in 89a files. The tool reads both headers and reports which one a file uses.',
    },
    {
      q: 'Why does a GIF have hard transparent edges?',
      a: 'GIF transparency works by marking a single palette index as transparent, so there is no partial blending. The transparency index in the Graphic Control Extension names which colour is see-through, which is why edges look jagged compared with formats that support alpha blending.',
    },
    {
      q: 'How does looping get set?',
      a: 'Looping comes from the NETSCAPE Application Extension block in the header. The tool lists it as an Application Extension so you can see the loop count and the byte offset where it lives.',
    },
    {
      q: 'Is my GIF uploaded anywhere?',
      a: 'No. The header and every block are parsed on-device, so a GIF can be inspected offline with nothing leaving the browser.',
    },
  ],
} as const;
