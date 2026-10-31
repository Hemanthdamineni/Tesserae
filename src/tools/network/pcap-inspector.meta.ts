import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'pcap-inspector',
  name: 'PCAP Capture Inspector',
  category: 'network',
  summary:
    'Inspect a PCAP packet capture: global header, byte order, version, link type, and per-packet records.',
  description:
    'Drop in a tcpdump/libpcap capture file (.pcap) and inspect its structure. The tool detects the byte order (little-endian or big-endian magic) and the file format version, reports the snapshot length and the data-link type (Ethernet, raw IP, 802.11, Linux cooked capture, loopback), then walks every packet record reporting its timestamp (seconds and microseconds), the captured length, and the original length. It translates the data-link type into its common name, flags a bad magic, an unsupported version, a record header or packet that overruns the file, and a captured length larger than the original length. Everything runs on-device.',
  keywords: [
    'pcap',
    'capture',
    'tcpdump',
    'libpcap',
    'packet',
    'ethernet',
    'link type',
    'network',
    'snapshot',
    'timestamp',
    'forensics',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.pcap,application/vnd.tcpdump.pcap,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'records',
      choices: [
        { value: 'records', label: 'Packet records' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a PCAP capture file', options: {} }],
  related: ['file-signature', 'elf-binary-inspector', 'warc-archive-inspector', 'bmp-inspector'],
  status: 'stable',
};
