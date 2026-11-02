import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'bson-decoder',
  name: 'BSON Decoder',
  category: 'encoding',
  summary:
    'Decode a BSON (MongoDB) binary document on-device into readable JSON with a per-type breakdown.',
  description:
    'Turn BSON back into something you can read. Drop in a .bson or .bin file or paste a hex or base64 dump and see the decoded document as JSON, plus a compact breakdown that counts the elements by type. The tool reads the BSON element system end to end: the little-endian document length, null-terminated element names, and values of type double, string, embedded document, array, binary, ObjectId, boolean, datetime, null, regex, JavaScript code, code-with-scope, int32, timestamp, int64, decimal128, and the min and max keys. It decodes nested documents and arrays recursively with a capped depth and prints ObjectIds and datetimes in readable forms. The tool flags a truncated document or element, a non-terminated name, an unsupported type byte, and trailing bytes. Everything runs on-device.',
  keywords: [
    'bson',
    'bson decoder',
    'mongodb',
    'binary json',
    'decode bson',
    'bson to json',
    'objectid',
    'document',
    'int32',
    'int64',
    'datetime',
    'array',
    'binary',
    'encoding',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.bson,.bin,application/octet-stream,application/bson',
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
        { value: 'types', label: 'Type breakdown' },
      ],
      default: 'json',
    },
  ],
  examples: [
    {
      title: 'A document with a string and an int32',
      input: '16000000026e616d6500050000007465737400106e000500000000',
    },
    { title: 'A true boolean', input: '0a000000086f6b000100' },
    { title: 'A double value', input: '11000000017069001f85eb51b81e094000' },
  ],
  related: ['cbor-decoder', 'msgpack-decoder', 'protobuf-decoder', 'json-format', 'base64'],
  status: 'stable',
};
