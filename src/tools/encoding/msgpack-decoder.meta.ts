import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'msgpack-decoder',
  name: 'MessagePack Decoder',
  category: 'encoding',
  summary:
    'Decode a MessagePack binary message on-device into readable JSON with a type breakdown of every value.',
  description:
    'Paste or upload a MessagePack-encoded byte sequence and decode it into readable JSON on-device. The tool reads the MessagePack type system end to end: positive and negative fixint, uint8 through uint64 and int8 through int64, float32 and float64, fixstr and str8/16/32, bin8/16/32, fixarray and array16/32, fixmap and map16/32, nil, true, false, and the extension family. It produces a pretty-printed JSON document and a compact type breakdown that counts the integers, floats, strings, binaries, arrays, maps and extension values. The tool flags a trailing byte after a complete top-level value, a truncated input, an unsupported extension, and a nesting depth that is too deep. Everything runs on-device.',
  keywords: [
    'msgpack',
    'messagepack',
    'binary',
    'serialize',
    'serialization',
    'decode',
    'decoder',
    'json',
    'type',
    'fixint',
    'fixmap',
    'fixarray',
    'float64',
    'ext',
    'binary data',
    'encoding',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.msgpack,.bin,application/octet-stream,application/msgpack',
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
    { title: 'A small map', input: '87a46e616d65a474657374a5636f756e7403' },
    { title: 'A true boolean', input: 'c3' },
    { title: 'A float64 value', input: 'cb3fe0000000000000' },
  ],
  related: ['cbor-decoder', 'json-format', 'text-to-binary', 'base64', 'hex'],
  status: 'stable',
};
