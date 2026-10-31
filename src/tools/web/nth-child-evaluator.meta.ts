import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'nth-child-evaluator',
  name: ':nth-child An+B Evaluator',
  category: 'web',
  summary:
    'Parse CSS An+B (:nth-child, :nth-of-type) microsyntax, validate it, and list which child indices it matches.',
  description:
    'Paste a CSS selector like ":nth-child(2n+1)" or ":nth-of-type(-n+3)" and see exactly which child indices it selects. The tool parses the An+B microsyntax from the CSS Values spec into its (A, B) coefficients, covering the keywords even and odd as well as forms like n, 2n, -n+3, 0n+5 and a bare integer such as 3. It validates the grammar and reports parse errors, then for any count of children N it lists the matching indices (the children selected by the formula), checks whether a specific 1-based index matches, and shows the first several matches. This is useful when you want to know, for example, that :nth-child(3n+1) selects the 1st, 4th, 7th, ... children, or that :nth-of-type(-n+3) selects just the first three of a kind. Everything runs on-device.',
  keywords: [
    'css',
    'nth-child',
    'nth-of-type',
    'an+b',
    'anb',
    'microsyntax',
    'selector',
    'even',
    'odd',
    'css selector',
    'child index',
    'pseudo-class',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: true,
  accept: '.css,.txt,.html,text/plain,text/css',
  options: [
    {
      key: 'children',
      label: 'Children count',
      type: 'number',
      default: 10,
      min: 0,
      max: 1000,
    },
    {
      key: 'index',
      label: 'Test index',
      type: 'number',
      default: 0,
      min: 0,
      max: 100000,
    },
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'matches',
      choices: [
        { value: 'matches', label: 'Matches' },
        { value: 'parse', label: 'Parse' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [
    {
      title: 'Every third child starting at the first',
      input: ':nth-child(3n+1)',
      options: { children: 12, format: 'matches' },
    },
    {
      title: 'The first three of each kind',
      input: ':nth-of-type(-n+3)',
      options: { children: 8, format: 'matches' },
    },
    {
      title: 'Odd children',
      input: ':nth-child(odd)',
      options: { children: 10, format: 'matches' },
    },
  ],
  related: ['css-units', 'css-grid', 'regex-explainer'],
  status: 'stable',
};
