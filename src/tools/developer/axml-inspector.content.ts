/**
 * Editorial content for the axml-inspector tool page.
 *
 * Kept out of ``axml-inspector.meta.ts`` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop an Android binary XML file (.axml) into the workbench — the format Android uses to store AndroidManifest.xml and layout resources inside APK files — and inspect its chunk-based structure. The tool verifies the RES_XML_TYPE header, walks the string pool chunk to decode the resource strings (UTF-16 length-prefixed), and then walks every top-level XML chunk: namespace start and end blocks, element start and end nodes, and CDATA.',
    },
    {
      heading: 'Elements and namespaces',
      body: 'For each element the tool reports the element name, namespace reference, line number, attribute count, and the namespace start/end pairing. That turns a dense binary tree into a readable structure where you can follow how a manifest or layout is nested and where each namespace opens and closes.',
    },
    {
      heading: 'The chunk tree and string pool',
      body: 'AXML is a sequence of size-prefixed chunks. The inspector walks the string pool chunk first — decoding the UTF-16 length-prefixed resource strings — then the top-level XML chunks that reference it. The chunks and strings views slice the same file for whichever level of detail you want.',
    },
    {
      heading: 'Structural problems are flagged',
      body: 'The tool flags the classic AXML problems: an unknown chunk type, a chunk whose size overruns the end of the file, a header size that does not match the chunk type, and an element start with fewer attributes than its declared count. A malformed or hand-edited binary XML file is reported rather than misread.',
    },
  ],
  faq: [
    {
      q: 'Is my .axml file uploaded anywhere?',
      a: 'No. The AXML file is parsed entirely on-device in your browser,Skip with no network access,Skip so a binary XML from an APK never leaves your machine.',
    },
    {
      q: 'What is AXML?',
      a: 'AXML is Android binary XML, the compact binary representation Android uses for AndroidManifest.xml and layout resources inside APK files. It stores the same information as text XML in a chunked, indexable form.',
    },
    {
      q: 'What does the string pool view show?',
      a: 'The string pool chunk holds the UTF-16 length-prefixed resource strings the XML references by index. The tool decodes them, so you can read the literal names and text used in the manifest or layout.',
    },
    {
      q: 'What structural problems does it flag?',
      a: 'It flags an unknown chunk type, a chunk whose size overruns the end of the file, a header size that does not match the chunk type, and an element start with fewer attributes than it declares.',
    },
  ],
} as const;
