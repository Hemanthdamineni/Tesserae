import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'cpio-inspector',
  name: 'cpio Archive Inspector',
  category: 'developer',
  summary:
    'Read a cpio archive on-device: format magic, entries, names, sizes, modes and metadata.',
  description:
    'Open a cpio archive (a Unix archive format used by initramfs and RPM packages) and inspect its structure without uploading it. The tool detects newc SVR4 "070701" and old ASCII odc "070707", then walks every entry and reports its inode, mode, ownership, link count, modification time, file size, name and type. The summary lists the format, entry count, total uncompressed size and whether the archive ends with "TRAILER!!!". Everything is parsed on-device.',
  keywords: [
    'cpio',
    'archive',
    'unix',
    'initramfs',
    'initrd',
    'rpm',
    'svr4',
    'newc',
    'ascii',
    'entry',
    'file mode',
    'metadata',
    'inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.cpio,application/x-cpio,application/octet-stream',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'entries', label: 'Entry list' },
        { value: 'header', label: 'Header' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a cpio archive' }],
  related: ['tar-inspector', 'zip-inspect', 'binary-file-signature', 'file-metadata'],
  status: 'stable',
};
