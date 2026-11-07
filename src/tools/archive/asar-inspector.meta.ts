import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'asar-inspector',
  name: 'ASAR Archive Inspector',
  category: 'archive',
  summary:
    'Read an Electron ASAR archive on-device: header size, the file tree encoded in the pickle header, sizes and offsets.',
  description:
    'Open an ASAR archive (the package format used by Electron apps, produced by the electron asar tool) and inspect its file list without uploading it. The tool reads the 32-bit header length, unpacks the pickle-encoded JSON header that stores the whole tree, and reports every file with its logical path, uncompressed size and byte offset into the data region, plus the total number of files and the total unpacked size. Nested folders are shown flattened so you can see the full layout at a glance. Everything is parsed on-device.',
  keywords: [
    'asar',
    'electron',
    'archive',
    'app',
    'package',
    'pickle',
    'json',
    'file tree',
    'offset',
    'inspector',
    'browser',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.asar,application/octet-stream',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'files', label: 'File list' },
        { value: 'header', label: 'Header' },
      ],
    },
  ],
  examples: [{ title: 'Inspect an Electron ASAR package' }],
  related: ['zip-inspect', 'tar-inspector', 'compressed-file-inspector', 'binary-file-signature'],
  status: 'stable',
};
