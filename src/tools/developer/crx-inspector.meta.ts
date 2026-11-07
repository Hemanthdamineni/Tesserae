import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'crx-inspector',
  name: 'CRX Extension Inspector',
  category: 'developer',
  summary:
    'Read a Chrome or Chromium extension package on-device: CRX header, version and the files inside.',
  description:
    'Open a CRX file (a Chrome or Chromium browser-extension package) and inspect it without uploading it anywhere. The tool checks the "Cr24" magic, reads the CRX format version (2 or 3) and the header size, verifies the CRX3 header magic for version-3 files, and then opens the embedded ZIP archive to list every file it contains. For version-3 files it also shows the header-data length and the extension ID derived from the signed header. The summary reports the format version, whether the ZIP is intact, the total entry count and the total uncompressed size, and the file list shows each entry with its size so you can confirm whether a manifest.json is present before you trust the package.',
  keywords: [
    'crx',
    'chrome extension',
    'chromium',
    'extension',
    'browser extension',
    'manifest',
    'package',
    'zip',
    'signed',
    'crx3',
    'developer',
    'inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.crx,application/octet-stream,application/x-chrome-extension',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'header', label: 'Header' },
        { value: 'files', label: 'File list' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a Chrome extension CRX package' }],
  related: ['binary-file-signature', 'zip-inspect', 'file-metadata', 'json-format'],
  status: 'stable',
};
