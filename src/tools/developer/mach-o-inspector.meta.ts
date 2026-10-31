import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'mach-o-inspector',
  name: 'Mach-O Binary Inspector',
  category: 'developer',
  summary:
    'Parse an Apple Mach-O binary on-device: 32/64-bit, CPU, file type, flags, load commands, segments and deps.',
  description:
    'Open a macOS/iOS executable, dynamic library, bundle, kernel extension or object file and read its Mach-O structure directly: 32- or 64-bit, big or little endian (byte-swapped magic), target CPU and subtype (x86_64, arm64, and others), the Mach-O file type (MH_EXECUTE, MH_DYLIB, MH_OBJECT, MH_BUNDLE, MH_DYLINKER, and others), and the header flags. It then walks every load command in order - segments (LC_SEGMENT/LC_SEGMENT_64 with name, address, size, protections, and section count), symbol tables, UUID, version info, and the runtime dependencies (LC_LOAD_DYLIB / LC_LOAD_DYLINKER) - decoding the common commands into readable rows. A build-info view pulls the platform, minimum OS and SDK versions from the version commands. The bytes never leave your browser.',
  keywords: [
    'mach-o',
    'macho',
    'binary',
    'executable',
    'apple',
    'macos',
    'ios',
    'dylib',
    'load commands',
    'segments',
    'otool',
    'x86_64',
    'arm64',
    'fat',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept:
    '.o,.dylib,.dSYM,.bin,application/octet-stream,application/x-mach-binary,application/x-executable',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'commands', label: 'Load commands' },
        { value: 'segments', label: 'Segments' },
        { value: 'dependencies', label: 'Dependencies' },
        { value: 'build', label: 'Build info' },
      ],
    },
    {
      key: 'maxRows',
      label: 'Max rows listed',
      type: 'number',
      default: 200,
      min: 0,
    },
  ],
  examples: [{ title: 'Check the architecture and deployment target of a binary' }],
  related: [
    'elf-binary-inspector',
    'wasm-inspector',
    'class-inspector',
    'binary-file-signature',
    'file-metadata',
  ],
  status: 'stable',
};
