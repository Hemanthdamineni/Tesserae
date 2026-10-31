/**
 * Editorial content for the icns-inspector tool page.
 *
 * Kept out of `icns-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in an Apple Icon Image (.icns) file and the tool validates the ICNS magic and total file length, then walks every icon resource chunk, reporting its four-character type code, byte offset, declared length and data size. The resource type is decoded into its common meaning: icp4 and ic10 are PNG icons at 16 and 32 points, ic07 through ic13 are PNG icons at larger sizes, icp5 and icp6 are 512 and 1024 point PNG icons, ics4 and ics5 are 16 and 32 point JPEG 2000 icons, and ic04 through ic12 are 16 through 1024 point JPEG 2000 icons. Everything runs on-device.',
    },
    {
      heading: 'One file, many sizes',
      body: 'An ICNS is a container, not a single picture: the file bundles several icon resources so macOS can pick the right size for each context. Each chunk carries a four-character type that encodes both the intended size and the compression, which is why a single .icns can hold many visually identical icons at different resolutions.',
    },
    {
      heading: 'PNG versus JPEG 2000 chunks',
      body: 'Apple moved between two encodings over the years. Newer chunks like icp4, icp5 and icp6 store PNG data with full alpha, while the older ics4, ics5 and ic04–ic12 chunks store JPEG 2000 data. The tool decodes the type code so you can tell which compression each resource uses without opening it.',
    },
    {
      heading: 'Catching a broken icon set',
      body: 'The tool flags a missing magic, a length that disagrees with the real file size, a chunk that overruns the file, and a trailing partial chunk header. An icon that fails to install or renders as a generic file usually trips one of these checks.',
    },
  ],
  faq: [
    {
      q: 'What do the icp4, ic07, ics4 type codes mean?',
      a: 'They are the four-character codes Apple uses to name icon resources. A leading pattern like icp (PNG) or ics (JPEG 2000) identifies the compression, and the following number encodes the size in points — icp4 is 16 point PNG, icp5 is 512 point PNG, ics4 is 16 point JPEG 2000, and so on. The tool maps each code to that meaning.',
    },
    {
      q: 'Why are there several icons of the same design?',
      a: 'An ICNS bundles multiple resources so the OS can choose an appropriately sized version for menus, docks, desktops and Retina displays. Each chunk is one of those variants, so listing the chunks shows every size present in the set.',
    },
    {
      q: 'Is my icon uploaded anywhere?',
      a: 'No. The magic, length and every chunk header are parsed on-device, so an ICNS can be inspected offline with nothing leaving the browser.',
    },
  ],
} as const;
