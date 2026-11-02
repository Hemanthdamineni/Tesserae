import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'avro-inspector',
  name: 'Avro Inspector',
  category: 'developer',
  summary:
    'Read an Apache Avro object-container file on-device: magic, schema, codec, sync markers and data blocks.',
  description:
    'Open an Apache Avro object-container file (.avro) and inspect its binary structure directly: the Obj magic, the embedded JSON writer schema, the compression codec (null, deflate, snappy), the 16-byte sync marker, and the sequence of data blocks with their record counts, block sizes and how many sync markers match. The tool parses the Avro file-metadata map and the block list end to end, so you can see what schema and codec a file actually declares before you try to read it. It flags a missing magic, an unknown codec, a block that overruns the file, and a mismatched sync marker. Everything runs on-device.',
  keywords: [
    'avro',
    'apache avro',
    'object container file',
    'ocf',
    'schema',
    'codec',
    'deflate',
    'snappy',
    'sync marker',
    'big data',
    'hadoop',
    'serialization',
    'inspector',
    'parser',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.avro,application/octet-stream,application/avro',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'schema', label: 'Schema' },
        { value: 'blocks', label: 'Data blocks' },
      ],
    },
    {
      key: 'maxRows',
      label: 'Max rows listed',
      type: 'number',
      default: 100,
      min: 0,
    },
  ],
  examples: [{ title: 'Inspect an Avro data file' }],
  related: [
    'binary-file-signature',
    'cbor-decoder',
    'msgpack-decoder',
    'protobuf-decoder',
    'file-metadata',
  ],
  status: 'stable',
};
