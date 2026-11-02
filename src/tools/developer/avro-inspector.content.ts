/**
 * Editorial content for the avro-inspector tool page.
 *
 * Kept out of `avro-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The object-container layout',
      body: 'An Avro object-container file starts with the four-byte Obj magic and version byte, followed by a metadata map and a 16-byte sync marker. After that come data blocks, each holding a record count, a byte size, the encoded records and a repeated copy of the sync marker. The inspector parses that structure end to end and reports the offset and size of every block it finds.',
    },
    {
      heading: 'Schema and codec',
      body: 'The metadata map is where Avro stores avro.schema and avro.codec. The inspector reads the writer schema as JSON and shows it in its own view, and reports the declared codec, which is normally null, deflate or snappy. Seeing the schema first is useful when a file fails to load elsewhere: the schema is the contract the records were written against, and a mismatch with your reader is the usual cause.',
    },
    {
      heading: 'Sync markers and record counts',
      body: 'Every data block ends with the same 16-byte sync marker that follows the header. The inspector compares each block trailing marker against the header marker and reports whether it matches, which catches a truncated or spliced file. The total record count is the sum of the per-block counts, so you can confirm how many rows a file declares before spending time decoding it.',
    },
    {
      heading: 'What it does not do',
      body: 'The inspector reads block headers but does not decompress deflate or snappy payloads and does not decode individual records. That would require applying the schema to every value, and the point of this tool is a fast structural audit. If a block overruns the file, the magic is missing, or the sync marker does not match, the tool says so rather than returning a partial table.',
    },
  ],
  faq: [
    {
      q: 'Does the inspector decode the records?',
      a: 'No. It reports the schema, codec, block sizes and record counts, but it does not apply the schema to the compressed payloads. Use it to audit a file, then read the rows with a full Avro reader.',
    },
    {
      q: 'Which codecs can it recognise?',
      a: 'It reports the codec string stored in the file metadata, including null, deflate and snappy. Recognising the name is not the same as decompressing the block, which this tool deliberately leaves alone.',
    },
    {
      q: 'Why do the sync markers matter?',
      a: 'They let an Avro reader find the next block after a seek or a partial write. If a block trailing marker differs from the header marker, the file was probably truncated or concatenated incorrectly, and the inspector flags it.',
    },
    {
      q: 'How large a file can I inspect?',
      a: 'Up to 256 MB, with the block table capped at 5000 rows so the report stays readable for very large files.',
    },
  ],
} as const;
