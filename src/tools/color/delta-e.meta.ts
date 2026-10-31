import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'delta-e',
  name: 'Color Difference (ΔE)',
  category: 'color',
  summary:
    'Measure how far apart two colors look with the perceptual CIEDE2000, CIE76 and CIE94 colour-difference formulae.',
  description:
    'Enter two colors, one per line (hex, rgb(), hsl(), or a common CSS color name), and see how perceptually different they look. Each color is converted to CIE Lab through the D65 sRGB pipeline, then the gap is measured with three standard formulae: CIEDE2000 (the current CIE recommendation and the closest match to human vision), CIE76 (plain Euclidean distance in Lab, which overstates small differences), and CIE94. The result includes the Lab, LCh and XYZ components of both colors plus a plain-language reading of the difference: below about 1 is imperceptible, around 2.3 is the just-noticeable difference, 5 to 10 is clearly visible, and larger values are dramatically different. Useful for picking genuinely distinct brand or UI colors instead of near-identical ones. Everything runs on-device.',
  keywords: [
    'color',
    'delta e',
    'color difference',
    'ciede2000',
    'cie2000',
    'cie76',
    'cie94',
    'lab',
    'lch',
    'perceptual',
    'color distance',
    'color science',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'differences', label: 'All formulae' },
        { value: 'colors', label: 'Lab components' },
        { value: 'findings', label: 'Findings' },
      ],
    },
    {
      key: 'metric',
      label: 'Formula',
      type: 'select',
      default: 'all',
      choices: [
        { value: 'all', label: 'All three' },
        { value: 'de2000', label: 'CIEDE2000 only' },
        { value: 'de76', label: 'CIE76 only' },
        { value: 'de94', label: 'CIE94 only' },
      ],
    },
    {
      key: 'color1',
      label: 'Color 1',
      type: 'text',
      default: '',
      placeholder: '#ff0000 (used when the text is empty)',
    },
    {
      key: 'color2',
      label: 'Color 2',
      type: 'text',
      default: '',
      placeholder: '#0000ff (used when the text is empty)',
    },
  ],
  examples: [
    { title: 'Red versus blue', input: '#ff0000\n#0000ff' },
    { title: 'Two near-identical grays', input: '#fefefe\n#fcfcfc' },
    { title: 'Named CSS colors', input: 'tomato\nforestgreen' },
  ],
  related: ['color-convert', 'color-contrast', 'color-blend'],
  status: 'stable',
};
