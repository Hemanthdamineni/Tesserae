/**
 * Editorial content for the protobuf-decoder tool page.
 *
 * Kept out of `protobuf-decoder.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Reading the wire format without a schema',
      body: 'Protocol Buffers messages are a sequence of fields, each starting with a varint key that packs the field number and the wire type. The wire type says whether the value that follows is a varint, a fixed 64-bit or 32-bit value, or a length-delimited block. Because the field names live in the .proto file rather than the bytes, the decoder shows field numbers and values, which is still enough to inspect a payload captured from gRPC or a message queue.',
    },
    {
      heading: 'What the decoder handles',
      body: 'It decodes varints, 64-bit and 32-bit fixed values, and length-delimited fields. A length-delimited block that itself parses as a message is shown as an embedded message, and groups are walked with their start and end markers. The result is printed as JSON keyed by field number, with strings shown as text and binary payloads left as byte sequences so nothing is silently mangled.',
    },
    {
      heading: 'The field breakdown',
      body: 'A second view lists each field number, its wire type and its decoded value. That table is the fastest way to see which field numbers a message actually uses and whether a repeated field was encoded packed or as separate entries. When a payload fails to decode in your application, a field appearing twice with different wire types is a common cause, and it is obvious here.',
    },
    {
      heading: 'Where it stops',
      body: 'Without the schema the decoder cannot tell an enum from an integer, or a nested message from an arbitrary byte string; it makes the most reasonable structural guess and leaves the raw bytes visible. It flags a truncated key or value, a length-delimited field that overruns the input, an unsupported wire type and trailing bytes after the message. Input is capped at 16 MB and 100000 fields, and everything runs on-device.',
    },
  ],
  faq: [
    {
      q: 'Can it show the real field names?',
      a: 'No. Field names and types are defined in the .proto schema, which is not stored in the encoded message. The decoder shows field numbers, wire types and values, and you can match them against your schema.',
    },
    {
      q: 'How does it decide a block is an embedded message?',
      a: 'A length-delimited field is re-parsed as a message when its bytes form a plausible sequence of fields. If that fails, the bytes are shown as a string or a byte sequence instead of forcing a structure.',
    },
    {
      q: 'Does it support packed repeated fields?',
      a: 'Yes. A packed repeated field is decoded as a list of values, and the field breakdown shows the wire type it used, so packed and unpacked encodings are distinguishable.',
    },
    {
      q: 'What input formats are accepted?',
      a: 'A .pb or .bin file, or pasted text in hexadecimal or base64. Detection is automatic by default, and the limits are 16 MB of input and 100000 decoded fields.',
    },
  ],
} as const;
