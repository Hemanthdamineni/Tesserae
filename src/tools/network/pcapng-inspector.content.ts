/**
 * Editorial content for the pcapng-inspector tool page.
 *
 * Kept out of `pcapng-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'The inspector parses a PCAP Next Generation capture (.pcapng, the default Wireshark save format) and walks its block structure. Unlike the older .pcap format, a pcapng file is a sequence of variable-length blocks, each carrying a type, a total length and a trailing copy of that length. The tool reports every block’s byte offset, block type, declared length and name, so you can see exactly how the capture is assembled.',
    },
    {
      heading: 'The blocks you will meet',
      body: 'A pcapng file typically starts with a Section Header Block, followed by one or more Interface Description Blocks and then the packet data. The tool decodes the Interface Description Block into its data-link type and snap length, the Enhanced Packet Block into its interface id, timestamp, and captured and original lengths, and the Interface Statistics Block. It also detects the byte-order magic in the Section Header Block, the format major and minor version, and the section length.',
    },
    {
      heading: 'Why pcapng replaced pcap',
      body: 'The newer format exists because classic .pcap stores a single global link type, while modern captures mix interfaces, and network hardware produces nanosecond timestamps and per-packet metadata. pcapng’s blocks let one file describe multiple interfaces and richer packet records. Knowing which blocks appear and in what order is the first step to understanding any modern capture.',
    },
    {
      heading: 'Structural problems it flags',
      body: 'The inspector reports the classic problems: a bad block type, a block length that overruns the file, a length smaller than the 12-byte header, an odd block missing its pad byte, an inconsistent trailing length, and a file that does not start with a Section Header Block. These checks quickly separate a well-formed capture from a truncated or corrupt one.',
    },
    {
      heading: 'On-device and offline',
      body: 'Everything runs on-device: the file is parsed entirely in your browser with no network access, so you can inspect sensitive captures offline. The block table, summary and packets views let you move between raw structure and a condensed read of the capture.',
    },
  ],
  faq: [
    {
      q: 'Can it read classic .pcap files too?',
      a: 'Yes — the tool accepts both .pcapng and .pcap files. The classic single-header format is also covered in detail by the separate PCAP Capture Inspector, while this tool focuses on the block-based structure of the newer format.',
    },
    {
      q: 'What is a Section Header Block?',
      a: 'It is the block that begins a pcapng section. It holds the byte-order magic, the format major and minor version, and the section length. A valid capture must start with one, and the tool flags any file that does not.',
    },
    {
      q: 'Why does each block repeat its length at the end?',
      a: 'Every pcapng block stores its total length both right after its type and again as a trailing copy. The trailing copy lets a parser confirm it read the block boundary correctly; the tool checks that the two lengths agree and reports an inconsistent trailing length when they do not.',
    },
    {
      q: 'Does it decode the packets inside each block?',
      a: 'It reads the Enhanced Packet Block metadata — interface id, timestamp, and captured versus original lengths — but it is focused on the block structure of the file rather than decoding the payload of every packet.',
    },
  ],
} as const;
