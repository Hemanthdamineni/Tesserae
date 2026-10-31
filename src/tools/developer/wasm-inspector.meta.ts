import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'wasm-inspector',
  name: 'WASM Module Inspector',
  category: 'developer',
  summary:
    'Decode a WebAssembly .wasm binary: version, section tree with sizes, imports/exports, and structure checks.',
  description:
    'Drop in a compiled WebAssembly module (.wasm) and inspect its binary structure. The tool verifies the 0x00 61 73 6D magic and version, then walks every section in order: type, import, function, table, memory, global, export, start, element, code, data, datacount, and custom sections. For each it reports the byte offset, the numeric section id, the name, and the declared size read as a variable-length LEB128 integer, and it decodes the high-value payloads: the import section (module, field, kind), the export section (name and kind), and custom name sections. It counts functions, memories, imports and exports surviving in each section, and flags common problems: a bad magic or unsupported version, a section id that appears out of order, a section that overruns the end of the file, and a truncated or trailing-garbage module. Everything runs on-device.',
  keywords: [
    'wasm',
    'webassembly',
    'module',
    'section',
    'leb128',
    'type',
    'import',
    'export',
    'code',
    'memory',
    'custom',
    'inspect',
    'binary',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.wasm,application/wasm,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'sections',
      choices: [
        { value: 'sections', label: 'Section list' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a WebAssembly module', options: {} }],
  related: ['elf-binary-inspector', 'file-signature', 'hash-identifier', 'objectid'],
  status: 'stable',
};
