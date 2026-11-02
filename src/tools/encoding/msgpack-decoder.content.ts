/**
 * Editorial content for the msgpack-decoder tool page.
 *
 * Kept out of `msgpack-decoder.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How MessagePack encodes a value',
      body: 'MessagePack is a compact binary serialisation where the first byte of a value encodes both its type and, for small numbers and short strings, its size. A positive fixint packs a small integer into a single byte, a fixstr holds up to 31 characters, and fixarray and fixmap hold up to 15 elements. Larger values switch to explicit uint, int, float, str, bin, array and map type bytes with a length prefix.',
    },
    {
      heading: 'Decoding into readable JSON',
      body: 'The decoder reads that type system end to end, including the full integer and float widths, string and binary families, arrays and maps, and the nil and boolean literals. It prints a pretty JSON document so the structure is immediately readable, and it handles nesting recursively with a depth cap so deeply nested input is rejected cleanly instead of exhausting the stack.',
    },
    {
      heading: 'The type breakdown',
      body: 'The second view counts values by type: integers, floats, strings, binaries, arrays, maps, booleans, nulls and extension values. The counts are handy for checking a producer: if a field arrives as a float where you expected an integer, or an extension type appears where a plain string should be, the breakdown shows it before you write a single line of decoding code.',
    },
    {
      heading: 'Warnings and limits',
      body: 'Input may be a file or pasted hex or base64. The decoder warns about trailing bytes after a complete top-level value, truncated data, unsupported extension types and excessive nesting. Input is capped at 16 MB and nesting at a fixed depth. Everything is decoded locally in the tab, so a message copied from a broker log never leaves the machine.',
    },
  ],
  faq: [
    {
      q: 'Does it preserve MessagePack extension types?',
      a: 'Extensions are recognised and reported as extension values, but a bare extension has no meaning without its registered type code. The decoder shows what it can and flags the type rather than inventing a value.',
    },
    {
      q: 'Can I decode a base64 payload from a log line?',
      a: 'Yes. Paste it and choose automatic detection, hexadecimal or base64. The decoder strips whitespace and decodes the text before parsing the MessagePack bytes.',
    },
    {
      q: 'Why does it complain about trailing bytes?',
      a: 'MessagePack has no stream terminator. After one complete value the decoder expects the input to end, so leftover bytes usually mean two messages were concatenated or a length prefix was included by mistake.',
    },
    {
      q: 'Is there a size limit?',
      a: 'The pasted or uploaded input is capped at 16 MB, and nesting is limited so a malformed message cannot recurse without bound.',
    },
  ],
} as const;
