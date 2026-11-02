import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'protobuf-decoder',
  name: 'Protobuf Decoder',
  category: 'encoding',
  summary:
    'Decode a Protocol Buffers binary message on-device into readable JSON with a per-field type breakdown.',
  description:
    'Turn Protocol Buffers wire format back into something you can read. Drop in a .pb or .bin file or paste a hex or base64 dump and see the decoded value as JSON, plus a compact breakdown that lists each field number, wire type and decoded value. The tool reads the protobuf wire format end to end: the varint base-128 field key, and values as varint, 64-bit, 32-bit, and length-delimited (strings, bytes and embedded messages). It walks groups, decodes embedded messages recursively with a capped depth, and counts fields by wire type. The tool flags a truncated key or value, an overrunning length-delimited block, an unsupported wire type, and trailing bytes after the message. Everything runs on-device.',
  keywords: [
    'protobuf',
    'protobuf decoder',
    'protocol buffers',
    'wire format',
    'grpc',
    'varint',
    'decode protobuf',
    'protobuf to json',
    'binary',
    'field',
    'wire type',
    'encoding',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.pb,.bin,application/octet-stream,application/x-protobuf',
  acceptsText: true,
  options: [
    {
      key: 'inputFormat',
      label: 'Pasted text format',
      type: 'select',
      choices: [
        { value: 'auto', label: 'Detect automatically' },
        { value: 'hex', label: 'Hexadecimal' },
        { value: 'base64', label: 'Base64' },
      ],
      default: 'auto',
    },
    {
      key: 'view',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'json', label: 'Decoded value' },
        { value: 'fields', label: 'Field breakdown' },
      ],
      default: 'json',
    },
  ],
  examples: [
    { title: 'A varint and a string', input: '0896011203616263' },
    { title: 'A 64-bit fixed value', input: '19000000000000f03f' },
    { title: 'A length-delimited byte string', input: '2202aabb' },
  ],
  related: ['cbor-decoder', 'msgpack-decoder', 'json-format', 'hex', 'base64'],
  status: 'stable',
};
