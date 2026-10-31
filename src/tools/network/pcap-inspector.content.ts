/**
 * Editorial content for the pcap-inspector tool page.
 *
 * Kept out of `pcap-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'The inspector reads a classic libpcap/tcpdump capture (.pcap) and reports the structure of the file itself. It detects the byte-order magic (little-endian or big-endian), the format version, the snapshot length, and the data-link type, translating that type into its common name such as Ethernet, raw IP, 802.11, Linux cooked capture or loopback. It then walks every packet record, reporting each one’s timestamp (seconds and microseconds), its captured length and its original length.',
    },
    {
      heading: 'Reading packet records',
      body: 'Each packet in a .pcap file is a short record: a timestamp, the number of bytes actually captured, and the number of bytes in the original packet on the wire. The two lengths differ when the capture was truncated to the snapshot length. Comparing them tells you whether any packets were cut short, which matters for forensics and for knowing how complete your analysis can be.',
    },
    {
      heading: 'What the link type tells you',
      body: 'The global header stores a single data-link type for the whole file, and that one value determines how every packet’s payload should be decoded. A capture can be Ethernet, raw IP, 802.11 wireless, Linux “cooked” capture (used by some tunnels and tap devices), or loopback. The tool prints the numeric type alongside its common name so you know the framing each packet uses before you start interpreting bytes.',
    },
    {
      heading: 'Malformed and truncated files',
      body: 'The inspector flags the classic problems: a bad magic, an unsupported version, a record header or packet that overruns the end of the file, and a captured length larger than the original length. A bad magic usually means the file is not really a .pcap (or is a .pcapng instead), and an overrunning record means the capture is truncated or corrupt.',
    },
    {
      heading: 'On-device and offline',
      body: 'Everything runs on-device: the file never leaves your browser and no network request is made, so you can inspect sensitive captures entirely offline. The three views — packet records, a summary, and the findings list — let you flip between raw detail and a condensed verdict.',
    },
  ],
  faq: [
    {
      q: 'Is this the same format Wireshark and tcpdump use?',
      a: 'Yes. .pcap is the classic libpcap/tcpdump save format, so captures written by tcpdump and older Wireshark saves are read here directly. Modern Wireshark defaults to the successor format, .pcapng, which is handled by the separate PCAPNG Inspector.',
    },
    {
      q: 'Why are captured and original length different?',
      a: 'The captured length is how many bytes were actually written to the file, while the original length is the full size of the packet on the wire. When the capture was limited by the snapshot length, packets are cut short and the original length is larger. The tool flags a captured length larger than the original length, which is always an error.',
    },
    {
      q: 'Can a capture mix more than one data-link type?',
      a: 'A classic .pcap file carries a single data-link type in its global header, so all packets share that framing. If you need per-interface or per-packet link types, that is a feature of the newer .pcapng format, not .pcap.',
    },
    {
      q: 'Does it decode the payload inside each packet?',
      a: 'No. The inspector reports the capture structure — header, link type, and per-packet records — rather than decoding IP or TCP inside each frame. That keeps the tool focused on validating and understanding the capture file itself.',
    },
  ],
} as const;
