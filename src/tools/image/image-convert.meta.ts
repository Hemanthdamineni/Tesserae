import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-convert',
  name: 'Convert Image Format',
  category: 'image',
  summary: 'Convert images between PNG, JPEG, WebP, AVIF and BMP in your browser.',
  description:
    'Convert an image to another common format using local browser canvas encoding. The file stays on your device.',
  keywords: ['image converter', 'convert image', 'png to jpg', 'webp converter'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'to',
      label: 'Target format',
      type: 'select',
      default: 'webp',
      choices: ['png', 'jpeg', 'webp', 'avif', 'bmp'].map((value) => ({
        value,
        label: value.toUpperCase(),
      })),
    },
    {
      key: 'quality',
      label: 'Quality (%)',
      type: 'range',
      default: 90,
      min: 10,
      help: 'Used by JPEG, WebP and AVIF. PNG ignores it.',
    },
    {
      key: 'background',
      label: 'Background for JPEG',
      type: 'text',
      default: '#ffffff',
      placeholder: '#ffffff',
      help: 'JPEG has no transparency, so transparent areas are filled with this colour.',
    },
  ],
  examples: [
    { title: 'Convert to WebP' },
    { title: 'PNG to JPEG on a white background', options: { to: 'jpeg', quality: 85 } },
    { title: 'Smaller AVIF copies', options: { to: 'avif', quality: 90 } },
  ],
  related: ['image-compress', 'svg-to-png'],
  status: 'stable',
  updated: '2026-10-16',
};
