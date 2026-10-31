import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'jpeg-inspector',
  name: 'JPEG Segment Inspector',
  category: 'image',
  summary:
    'Walk a JPEG as a marker stream: every segment offset, type and length, plus frame, quantisation and Huffman details.',
  description:
    'Drop in a JPEG and see it as the decoder sees it: a stream of 0xFF markers. The tool lists every segment in order with its byte offset, marker code and name, and declared length, and decodes the important ones on-device. It reads the SOF frame header (precision, image width and height, component count and each sampling ratio plus quantisation table selector), every DQT quantisation table, every DHT Huffman table (class, id, number of codes per length), the SOS scan header (component DC/AC Huffman selectors, spectral selection and successive approximation), and a DRI restart interval. It decodes a JFIF APP0 (version, units, pixel density) and reports APP1 Exif, APP2 ICC and text comments. It flags the classic structural problems: a missing SOI at the start or a missing EOI, a wrong 0xFF00 byte-stuffed sequence, a truncated or overrunning segment, and a 16-bit precision it cannot fully summarise. Everything runs locally.',
  keywords: [
    'jpeg',
    'jpg',
    'marker',
    'segment',
    'sof',
    'dqt',
    'dht',
    'sos',
    'app0',
    'app1',
    'jfif',
    'exif',
    'icc',
    'quantisation',
    'huffman',
    'frame header',
    'structure',
    'parser',
    'decoder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.jpg,.jpeg,.jpe,.jfif,image/jpeg,image/jpg',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'segments',
      choices: [
        { value: 'segments', label: 'Segment table' },
        { value: 'summary', label: 'Summary' },
        { value: 'tables', label: 'Quant + Huffman' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect a JPEG file', options: {} },
    { title: 'Check the frame header of a JPEG' },
    { title: 'List Huffman and quantisation tables' },
  ],
  related: [
    'image-metadata',
    'png-chunk-inspector',
    'image-strip-metadata',
    'image-convert',
    'webp-inspector',
    'gif-inspector',
  ],
  status: 'stable',
};
