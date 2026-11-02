/**
 * Editorial content for the aiff-inspector tool page.
 *
 * Kept out of `aiff-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the AIFF container holds',
      body: 'AIFF is an IFF format: a big-endian FORM container wrapping a sequence of sub-chunks such as COMM, SSND, NAME, AUTH and ANNO. The inspector verifies the FORM marker and the AIFF or AIFC form type, then walks the chunks in file order, honouring the IFF rule that every chunk is padded to an even byte boundary. The chunk map reports each identifier with its offset and size, so you can see exactly how the file is laid out without extracting or playing anything.',
    },
    {
      heading: 'Reading the audio parameters',
      body: 'The COMM chunk is decoded into the channel count, sample frame count, sample size and sample rate. AIFF stores that rate as an 80-bit IEEE 754 extended float rather than an integer, and the tool converts it back to a decimal value. The SSND chunk is located and reported with its byte offset and block size, which tells you where the uncompressed PCM data begins. A summary view condenses all of this into one table.',
    },
    {
      heading: 'Metadata chunks',
      body: 'NAME, AUTH and ANNO hold the title, author and free-form annotation as plain text, and the inspector surfaces them in the summary notes when present. AIFC files add a compression type identifier, so a compressed AIFC and a plain AIFF can be told apart by their form type and chunks rather than by guessing from the extension. The audio itself is never decoded.',
    },
    {
      heading: 'Problems it flags',
      body: 'The inspector warns when the FORM size claims more bytes than the file contains, when a chunk overruns the end of the file, when COMM is missing so the audio parameters are unknown, and when SSND is absent so no sound data can be found. A file that is too short to hold a header, or whose first four bytes are not FORM, is rejected with a specific error instead of a partial parse.',
    },
  ],
  faq: [
    {
      q: 'Does the inspector play or convert the audio?',
      a: 'No. It reads the container and the metadata chunks only. The PCM data inside SSND is located and measured but never decoded, so a large file is inspected quickly and nothing is uploaded.',
    },
    {
      q: 'Why is the sample rate stored as an extended float?',
      a: 'The AIFF specification predates the common use of integer sample rates and stores the rate in the 80-bit IEEE 754 extended format. The tool decodes that representation and prints the resulting rate in hertz.',
    },
    {
      q: 'Can it tell an AIFF from an AIFC file?',
      a: 'Yes. The form type at the start of the FORM container is either AIFF or AIFC, and the inspector reports which one it found. AIFC files may also carry a compression type that plain AIFF files do not.',
    },
    {
      q: 'How large a file can I inspect?',
      a: 'Up to 512 MB. Only the headers and chunk table are read, so the parse stays fast even for long uncompressed recordings.',
    },
  ],
} as const;
