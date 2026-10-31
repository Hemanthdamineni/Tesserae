import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'pcapng-inspector',
  name: 'PCAPNG Inspector',
  category: 'network',
  summary:
    'Parse a PCAP Next Generation capture: block type, length and offset, plus section, interface, packet and stats blocks.',
  description:
    'Drop in a modern packet capture file (.pcapng, the default Wireshark save format) and inspect its block structure. Unlike the older .pcap format, a pcapng file is a sequence of variable-length blocks, each with a type, a total length and a trailing copy of that length. The tool detects the byte-order magic in the Section Header Block (little-endian or big-endian), the format major and minor version and the section length, then walks every block reporting its byte offset, block type, declared length and block name. It decodes the Interface Description Block (data-link type and snap length), the Enhanced Packet Block (interface id, timestamp, captured and original length) and the Interface Statistics Block. It flags the classic problems: a bad block type, a block length that overruns the file, a length smaller than the 12-byte header, an odd block missing its pad byte, an inconsistent trailing length, and a file that does not start with a Section Header Block. Everything runs on-device.',
  keywords: [
    'pcapng',
    'pcap-ng',
    'pcap next generation',
    'packet capture',
    'wireshark',
    'libpcap',
    'shb',
    'idb',
    'epb',
    'isb',
    'enhanced packet block',
    'section header block',
    'interface',
    'snapshot',
    'datalink',
    'block',
    'parser',
    'decoder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.pcapng,.pcap,.pcapng,application/vnd.tcpdump.pcap,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'blocks',
      choices: [
        { value: 'blocks', label: 'Block table' },
        { value: 'summary', label: 'Summary' },
        { value: 'packets', label: 'Packets' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect a pcapng capture', options: {} },
    { title: 'List every block in a capture' },
    { title: 'Read the packet details of a pcapng' },
  ],
  related: [
    'pcap-inspector',
    'ip-address-inspector',
    'mac-address',
    'hex',
    'binary-file-signature',
  ],
  status: 'stable',
};
