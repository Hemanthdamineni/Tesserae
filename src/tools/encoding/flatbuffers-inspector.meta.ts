import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'flatbuffers-inspector',
  name: 'FlatBuffers Inspector',
  category: 'encoding',
  summary:
    'Read a FlatBuffers binary message on-device: root offset, file identifier, vtable and field table.',
  description:
    'Drop or paste a FlatBuffers serialized binary message and inspect its structure without uploading it. The tool reads the 32-bit root table offset, detects an optional four-character file identifier, and walks the root table and its vtable to report the vtable and table sizes, the number of table fields, and each field offset so the shape of the message is visible. It flags structural problems: a root offset that points outside the buffer, a vtable offset that points before the start, an oversized vtable, or a buffer too short to hold even the root offset. The summary view gives the root offset, identifier, vtable size, table size and field count, and the fields view lists each detected field with its offset.',
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.bin,.flatbuffer,application/octet-stream',
  keywords: [
    'flatbuffers',
    'serialization',
    'google',
    'binary',
    'schema',
    'vtable',
    'root table',
    'message',
    'inspector',
    'data',
    'buffer',
  ],
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'fields', label: 'Field list' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a FlatBuffers binary message' }],
  related: ['protobuf-decoder', 'msgpack-decoder', 'bson-decoder', 'cbor-decoder'],
  status: 'stable',
};
