import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'pe-inspector',
  name: 'PE Inspector',
  category: 'developer',
  summary:
    'Parse a Windows PE/COFF binary on-device: machine, subsystems, sections, imports and hardening flags.',
  description:
    'Open a Windows executable, DLL or object file and read its Portable Executable structure directly: the DOS header and its pointer to the PE signature, the COFF file header (machine, number of sections, timestamp, characteristics), and the optional header with the entry point, image base, section and file alignment, image size, subsystem (console, GUI, native) and DLL characteristics. It also lists every section in the section table with its virtual address, raw size and memory flags and decodes the import table to show the DLLs a binary loads and the imported functions. The tool reports key hardening-relevant flags such as whether dynamic base (ASLR), NX compatibility and control-flow-guard are set. Works on any PE file; the bytes never leave your browser.',
  keywords: [
    'pe',
    'portable executable',
    'coff',
    'windows',
    'exe',
    'dll',
    'dumpbin',
    'machine',
    'subsystem',
    'sections',
    'imports',
    'data directory',
    'aslr',
    'dynamic base',
    'nx',
    'control flow guard',
    'binary',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.exe,.dll,.obj,.sys,.bin,application/octet-stream,application/x-dosexec',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'headers', label: 'Headers' },
        { value: 'sections', label: 'Sections' },
        { value: 'imports', label: 'Imports' },
      ],
    },
    {
      key: 'maxRows',
      label: 'Max rows listed',
      type: 'number',
      default: 100,
      min: 0,
    },
  ],
  examples: [{ title: 'Inspect a Windows executable' }],
  related: [
    'elf-binary-inspector',
    'mach-o-inspector',
    'wasm-inspector',
    'binary-file-signature',
    'file-metadata',
  ],
  status: 'stable',
};
