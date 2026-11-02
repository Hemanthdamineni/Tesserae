/**
 * Editorial content for the webm-inspector tool page.
 *
 * Kept out of `webm-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'EBML, the format under WebM',
      body: 'WebM and Matroska are EBML documents: a tree of elements where each element begins with a variable-length ID and a variable-length size, followed by either child elements or a payload. The inspector decodes both fields, verifies that every element fits inside its parent, and walks the tree to a bounded depth. Because the sizes are variable-length integers, a single misread byte shifts the rest of the parse, so the structural checks matter more here than in fixed-header formats.',
    },
    {
      heading: 'Header and DocType',
      body: 'The EBML header declares the DocType (webm or matroska), the DocTypeVersion and the DocTypeReadVersion, along with the EBML version and the maximum ID and size lengths. The inspector reports those values and confirms the header element is present, which distinguishes a real Matroska file from a file that merely uses the .webm extension. Container software often writes additional header elements, and the header view lists them all.',
    },
    {
      heading: 'The Segment and its children',
      body: 'Most of the file lives inside the Segment element. The inspector locates it and descends into the Info block, where TimestampScale, Duration and the writing application are defined, so you can read the time base the timestamps use and the tool that produced the file. The element tree view prints every element with its depth, numeric ID, human-readable name and size, which is the fastest way to see whether a file contains the tracks and clusters you expect.',
    },
    {
      heading: 'Warnings and limits',
      body: 'The tool rejects a file with no EBML header, and warns when an element ID or size cannot be decoded, when an element overruns its parent, and when an unknown top-level element appears. Files up to 512 MB are supported and every byte is decoded locally. Nothing is re-muxed, so the original file is never modified.',
    },
  ],
  faq: [
    {
      q: 'What is the difference between WebM and Matroska?',
      a: 'They share the same EBML container. WebM is a restricted profile with defined codecs, while Matroska (.mkv) is broader. The DocType in the EBML header, which the inspector reports, is what distinguishes them.',
    },
    {
      q: 'Does it list the tracks and codecs?',
      a: 'The element tree exposes the track entries and their element IDs and sizes. Reading codec details from the track payload is a deeper parse, so the inspector focuses on structure and the header values.',
    },
    {
      q: 'Why does the inspector care about element sizes?',
      a: 'Every EBML element declares its own length. If a size is wrong, every following element is misaligned. The inspector checks each element against its parent boundary and reports an overrun instead of producing nonsense.',
    },
    {
      q: 'Can I inspect a large .mkv without loading it all?',
      a: 'The tool accepts files up to 512 MB and reads them in the tab. Very large remuxes should be trimmed first; the header and top-level tree are small, but the browser still needs the file bytes.',
    },
  ],
} as const;
