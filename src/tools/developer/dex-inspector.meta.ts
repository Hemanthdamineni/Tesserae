import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'dex-inspector',
  name: 'DEX File Inspector',
  category: 'developer',
  summary:
    'Parse an Android Dalvik .dex binary on-device: header, checksum and signature, and the string, type and class tables.',
  description:
    'Drop in an Android app executable (a classes.dex file) and see how the Dalvik bytecode is laid out. The tool validates the eight-byte "dex" magic and version tag, verifies the Adler-32 checksum and the SHA-1 signature over the file, reports the file and header sizes and the endian tag, and reads every one of the header table counters. It then decodes the string ID table into the actual MUTF-8 strings the bytecode references, resolves the type ID table through the string descriptors (Lclass; and primitive names), and reports the proto, field, method and class definition counts. It decodes the MUTF-8 encoding (including the 0xC0 0x80 NUL form) and flags the classic structural problems: a bad magic or version, a checksum or signature mismatch, a header size that is not 0x70, an unknown endian tag, and a table that overruns the declared file size. Everything runs on-device.',
  keywords: [
    'dex',
    'dalvik',
    'android',
    'classes.dex',
    'bytecode',
    'smali',
    'checksum',
    'adler32',
    'sha1',
    'mutf8',
    'string table',
    'type table',
    'parser',
    'decoder',
    'reverse engineering',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.dex,application/x-dex,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'strings', label: 'Strings' },
        { value: 'types', label: 'Types' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect a classes.dex file', options: {} },
    { title: 'List the string table of a DEX' },
    { title: 'Resolve type descriptors' },
  ],
  related: [
    'class-inspector',
    'elf-binary-inspector',
    'wasm-inspector',
    'mach-o-inspector',
    'hash-identifier',
  ],
  status: 'stable',
};
