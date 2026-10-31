import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'eml-inspector',
  name: 'EML Message Inspector',
  category: 'text',
  summary:
    'Parse a single .eml email on-device: the RFC 5322 headers, MIME tree and boundaries, and each decoded part.',
  description:
    'Drop in one saved email message (.eml, .msg export, or a single message pulled from a mail client) and see its full structure. The tool reads the RFC 5322 header block at the top of the file and reports the From, To, Cc, Subject, Date and the other common headers, then walks the MIME body: it detects the boundary parameter of a multipart content type, splits the body into its parts, and for each part reports its own content type, transfer encoding, file name when present, and the decoded body size. Base64 and quoted-printable parts are decoded on-device so you can see what the message actually contains, and plain single-part messages are shown directly. The tool flags the classic problems: a file with no header/body separator, a multipart message missing its closing boundary, an unterminated boundary line, base64 with broken padding, a header with no colon, and an unparseable date. Everything runs on-device.',
  keywords: [
    'eml',
    'email',
    'message',
    'rfc 5322',
    'rfc 822',
    'mime',
    'header',
    'multipart',
    'boundary',
    'base64',
    'quoted-printable',
    'attachment',
    'content-type',
    'content-disposition',
    'parser',
    'decoder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: true,
  accept: '.eml,.msg,message/rfc822,text/plain',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'overview',
      choices: [
        { value: 'overview', label: 'Overview' },
        { value: 'headers', label: 'Headers' },
        { value: 'parts', label: 'MIME parts' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect an .eml email message', options: {} },
    { title: 'Read the MIME parts and attachments of an email' },
    { title: 'Show the headers of an .eml file' },
  ],
  related: ['mbox-archive-analyzer', 'email-header-analyzer', 'base64', 'data-uri', 'mime-lookup'],
  status: 'stable',
};
