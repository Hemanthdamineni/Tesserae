import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'tar-inspector',
  name: 'TAR Inspector',
  category: 'developer',
  summary:
    'Read a POSIX tar archive on-device: list every entry, its type, size, mode, owner and checksum validity.',
  description:
    'Drop in a tar archive (.tar, or a tarball) and inspect its header blocks without extracting anything. The tool reads the 512-byte USTAR/POSIX headers in sequence, reporting each entry name, file type (regular, directory, symlink, hard link, device, FIFO), size, mode, uid, gid, owner and group names, and modification time. It verifies the octal checksum of every header, flags a corrupt or zero-length entry, and detects the two zero blocks that terminate the archive. The views list the full entry manifest or a compact summary with the archive format, entry count and total data size. This pairs with the existing create and extract tools by letting you audit an archive first. Everything runs on-device.',
  keywords: [
    'tar',
    'archive',
    'ustar',
    'posix',
    'gzip',
    'entry',
    'header',
    'checksum',
    'manifest',
    'file',
    'directory',
    'symlink',
    'archive format',
    'inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.tar,.tgz,.tar.gz,video/octet-stream,application/x-tar,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'entries', label: 'Entries' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect a tar archive', options: {} },
    { title: 'List every entry in a tarball' },
    { title: 'Verify the header checksums of a tar' },
  ],
  related: ['tar-create', 'tar-extract', 'zip-extract', 'compressed-file-inspector', 'file-hash'],
  status: 'stable',
};
