import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'axml-inspector',
  name: 'AXML Inspector',
  category: 'developer',
  summary:
    'Parse an Android binary XML (.axml) on-device: its chunk tree, string pool, elements, and attribute counts.',
  description:
    'Drop in an Android binary XML file (.axml), the format Android uses to store AndroidManifest.xml and layout resources inside APK files, and inspect its chunk-based structure. The tool verifies the RES_XML_TYPE header, walks the string pool chunk to decode the resource strings (UTF-16 length-prefixed), and then walks every top-level XML chunk: namespace start and end blocks, element start and end nodes, and CDATA. For each element it reports the element name, namespace reference, line number, attribute count, and the namespace start/end pairing. The tool flags the classic problems: an unknown chunk type, a chunk whose size overruns the end of the file, a header size that does not match the chunk type, an element start with fewer attributes than its declared count, a string pool index out of range, and a file that does not end at the declared size. Everything runs on-device.',
  keywords: [
    'axml',
    'android binary xml',
    'xml',
    'manifest',
    'apk',
    'android',
    'binary',
    'chunk',
    'string pool',
    'element',
    'namespace',
    'resource',
    'layout',
    'parser',
    'decoder',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.axml,application/xml,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'chunks', label: 'Chunks' },
        { value: 'strings', label: 'Strings' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect an Android binary XML file', options: {} },
    { title: 'List the strings in an AXML string pool' },
    { title: 'Walk the element chunks of an Android manifest' },
  ],
  related: [
    'dex-inspector',
    'xml-format',
    'class-inspector',
    'elf-binary-inspector',
    'wasm-inspector',
  ],
  status: 'stable',
};
