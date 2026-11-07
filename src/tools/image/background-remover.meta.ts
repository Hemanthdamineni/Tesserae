import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'background-remover',
  name: 'Remove Background',
  category: 'image',
  summary: 'Cut a subject out of a photo with an on-device AI matting model (MODNet).',
  description:
    'Isolate the subject of a portrait or photo with MODNet, an on-device portrait-matting model. On the first run the model weights are fetched from the Hugging Face Hub and cached in your browser. The runtime assets are served by this site. Your images never leave your device.',
  keywords: [
    'remove background',
    'background remover',
    'cutout',
    'transparent png',
    'portrait matting',
    'subject extraction',
    'ai background removal',
  ],
  // The Hub serves the reviewed model weights. ONNX runtime assets are served
  // from this static site, so GitHub Pages remains the only app origin.
  // No user image is sent to either source.
  privacy: {
    processing: 'on-device',
    network: ['huggingface.co'],
    offline: false,
  },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'background',
      label: 'Background result',
      type: 'select',
      default: 'transparent',
      choices: [
        { value: 'transparent', label: 'Transparent (PNG alpha)' },
        { value: 'solid', label: 'Solid colour' },
      ],
      help: 'Replace the removed background with transparency, or fill it with a flat colour.',
    },
    {
      key: 'backgroundColour',
      label: 'Background colour',
      type: 'text',
      default: '#ffffff',
      showWhen: { key: 'background', value: 'solid' },
      help: 'A hex colour such as #ffffff. Uses the current value when filled.',
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'png',
      choices: [
        { value: 'png', label: 'PNG' },
        { value: 'webp', label: 'WebP' },
      ],
      help: 'PNG keeps a clean alpha channel. WebP is smaller but harder to edit elsewhere.',
    },
    {
      key: 'quality',
      label: 'Quality (%)',
      type: 'range',
      default: 90,
      min: 10,
      showWhen: { key: 'format', value: 'webp' },
    },
    {
      key: 'threshold',
      label: 'Matte threshold (%)',
      type: 'range',
      default: 0,
      min: 0,
      help: '0 keeps MODNet’s soft, feathered edges. Higher values snap soft edge pixels to fully transparent or fully opaque for a crisper cut-out.',
    },
  ],
  examples: [
    { title: 'Cut out a portrait' },
    {
      title: 'Portrait on a white card',
      options: { background: 'solid', backgroundColour: '#ffffff' },
    },
    { title: 'Cut out, saved as WebP', options: { format: 'webp' } },
  ],
  credits: [
    {
      name: 'MODNet (Xenova/modnet)',
      url: 'https://huggingface.co/Xenova/modnet',
      license: 'Apache-2.0',
    },
    {
      name: '@huggingface/transformers',
      url: 'https://github.com/huggingface/transformers.js',
      license: 'Apache-2.0',
    },
    {
      name: 'onnxruntime-web',
      url: 'https://github.com/microsoft/onnxruntime',
      license: 'MIT',
    },
  ],
  related: ['image-compress', 'image-convert', 'image-resize'],
  status: 'beta',
  updated: '2026-10-24',
};
