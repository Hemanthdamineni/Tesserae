/**
 * Editorial content for the eml-inspector tool page.
 *
 * Kept out of `eml-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'The inspector parses one saved email message (.eml, .msg export, or a single message pulled from a mail client) and shows its full structure. It reads the RFC 5322 header block at the top of the file — From, To, Cc, Subject, Date and the other common headers — then walks the MIME body, splitting a multipart message into its parts and reporting each one’s content type, transfer encoding, file name when present, and decoded body size.',
    },
    {
      heading: 'Headers and the MIME tree',
      body: 'An email is a header block followed by a blank line and the body. When the Content-Type is multipart, the body itself is cut into sections by a boundary string, and each section has its own headers and content. The tool detects that boundary parameter, splits the body accordingly, and presents the resulting MIME tree, so you can see how an HTML part, a plain-text fallback and attachments are packaged into a single message.',
    },
    {
      heading: 'Decoded content, including attachments',
      body: 'Base64 and quoted-printable parts are decoded on-device so you can read what the message actually contains rather than the transfer encoding, and plain single-part messages are shown directly. File names found on parts tell you which are attachments and what they would be called if saved.',
    },
    {
      heading: 'Problems it flags',
      body: 'The inspector reports the classic malformations: a file with no header/body separator, a multipart message missing its closing boundary, an unterminated boundary line, base64 with broken padding, a header with no colon, and an unparseable date. These are the failure modes that make a message render differently — or not at all — in another mail client.',
    },
    {
      heading: 'On-device and offline',
      body: 'Everything runs on-device: the message never leaves your browser and no network request is made, so you can open private or sensitive mail offline. The overview, headers and MIME parts views let you move between the summary and the underlying structure.',
    },
  ],
  faq: [
    {
      q: 'Does opening the message fetch remote images or track pixels?',
      a: 'No. The tool parses and decodes the message locally; it does not render HTML or load any remote content, so nothing in the email can phone home. Everything stays on-device with no network access.',
    },
    {
      q: 'Why can a message have more than one body part?',
      a: 'Multipart messages bundle several representations in one file — typically a plain-text alternative, an HTML body, and any attachments. Each part is separated by a boundary string declared in the Content-Type header, and the tool lists every part with its type and decoded size.',
    },
    {
      q: 'What is quoted-printable?',
      a: 'It is a transfer encoding that keeps text mostly readable while escaping bytes that would break the mail transport, such as non-ASCII characters. The inspector decodes quoted-printable (and base64) parts on-device so the reported body size reflects the real content.',
    },
    {
      q: 'Which files can I drop in?',
      a: 'Single saved messages: .eml files, .msg exports, or one message extracted from a mail client. A whole mailbox archive holding many messages is a different job and is handled by the mbox archive analyzer.',
    },
  ],
} as const;
