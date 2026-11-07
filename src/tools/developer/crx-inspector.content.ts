import type { ToolContent } from '../../lib/content';

export const content: ToolContent = {
  article: [
    {
      heading: 'How a CRX is laid out',
      body: 'A Chrome extension package begins with the Cr24 magic and a versioned header, followed by a ZIP payload. CRX2 stores a public-key and signature header; CRX3 wraps signed header data before the ZIP. This inspector reads those container boundaries and never needs to install or execute the extension.',
    },
    {
      heading: 'What you can verify',
      body: 'The summary reports the CRX version, header size, CRX3 marker, ZIP integrity, entry count, uncompressed size and whether manifest.json is present. The header view exposes offsets and the derived extension ID where the signed header has the expected shape. The file view lists the ZIP central-directory entries.',
    },
    {
      heading: 'Limits and safety',
      body: 'The browser parser accepts CRX files up to 64 MB and caps the displayed file list. It treats the package as bytes only: it does not unpack, install, execute scripts or contact the extension publisher. A missing magic, unsupported version or missing ZIP payload fails before a report is produced. This makes it useful for a first-pass inspection before opening a package in a browser profile.',
    },
  ],
  faq: [
    {
      q: 'Does this install the extension?',
      a: 'No. The file is inspected as data in your browser and is never installed or executed.',
    },
    {
      q: 'Are CRX2 and CRX3 supported?',
      a: 'Yes. The inspector recognises CRX2 and CRX3 headers, validates the CRX3 marker, and then reads the embedded ZIP central directory.',
    },
    {
      q: 'Is the extension uploaded?',
      a: 'No. CRX parsing runs on-device with no network requests, so the package stays in your browser tab.',
    },
  ],
};
