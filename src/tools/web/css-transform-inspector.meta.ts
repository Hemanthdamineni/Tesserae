import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'css-transform-inspector',
  name: 'CSS Transform Inspector',
  category: 'web',
  summary:
    'Parse a CSS transform, compose it into one matrix, and report the decomposition, determinant and invertibility.',
  description:
    'Paste a CSS transform value such as "translate(10px, 20px) scale(2) rotate(45deg)" and see exactly what it does. The tool parses the transform function list, composes every step into a single 2D affine matrix or 3D 4x4 matrix, and reports the result in CSS matrix()/matrix3d() form. It then decomposes the matrix back into translate, rotate, scale, and skew components so you can see the net effect even when functions are chained, and it tells you whether the transform is invertible (determinant zero means the transform collapses space and cannot be undone). It flags syntax problems such as unbalanced parentheses, a wrong argument count, an unknown function, or an unparseable number, and it checks whether a 3D transform is actually a 2D one. Everything runs on-device.',
  keywords: [
    'css transform',
    'transform',
    'matrix',
    'matrix3d',
    'translate',
    'rotate',
    'scale',
    'skew',
    'affine',
    'css matrix',
    'transform decomposition',
    'determinant',
    'invertible',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: true,
  accept: '.css,.txt,.html,.svg,text/plain,text/css',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'functions', label: 'Functions' },
        { value: 'matrix', label: 'Matrix' },
        { value: 'findings', label: 'Findings' },
      ],
    },
    {
      key: 'round',
      label: 'Decimals',
      type: 'number',
      default: 4,
      min: 0,
      max: 10,
    },
  ],
  examples: [
    {
      title: 'A transform chain where order matters',
      input: 'translate(10px, 20px) scale(2)',
      options: { format: 'matrix' },
    },
    {
      title: 'Rotation combined with a non-uniform scale',
      input: 'rotate(90deg) scale(2, 3)',
      options: { format: 'matrix' },
    },
    {
      title: 'A transform that collapses space',
      input: 'scale(1, 0)',
      options: { format: 'findings' },
    },
  ],
  related: ['matrix-calculator', 'css-units', 'gradient-css'],
  status: 'stable',
};
