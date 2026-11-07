import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'code-minify',
  name: 'Code Minifier',
  category: 'developer',
  summary:
    'Minify JavaScript, TypeScript, CSS, HTML and JSON in your browser, and see exactly how many bytes you saved.',
  description:
    'Paste code and get it minified by Terser, csso and html-minifier-terser — all inside this tab. Choose a language or let the tool detect one, pick how aggressive the compression should be, and watch the byte count drop. The minifiers are downloaded from this site the first time you use them, and nothing you paste ever leaves your device.',
  keywords: [
    'minify',
    'minifier',
    'minify code',
    'compress code',
    'javascript minifier',
    'typescript minifier',
    'css minifier',
    'html minifier',
    'json minifier',
    'terser',
    'reduce file size',
    'code compressor',
    'uglify',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'language',
      label: 'Language',
      type: 'select',
      default: 'auto',
      help: 'Auto-detect reads the input and picks a minifier, or choose one yourself.',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'javascript', label: 'JavaScript' },
        { value: 'typescript', label: 'TypeScript' },
        { value: 'css', label: 'CSS' },
        { value: 'html', label: 'HTML' },
        { value: 'json', label: 'JSON' },
      ],
    },
    {
      key: 'preset',
      label: 'Compression',
      type: 'select',
      default: 'safe',
      help: 'Safe keeps names and structure. Aggressive squeezes harder but may rename top-level code or drop unused declarations.',
      choices: [
        { value: 'safe', label: 'Safe' },
        { value: 'aggressive', label: 'Aggressive' },
      ],
    },
  ],
  examples: [
    {
      title: 'JavaScript',
      input:
        'function greet(name) {\n  const message = "Hello, " + name + "!";\n  return message;\n}\n\ngreet("world");',
    },
    {
      title: 'TypeScript',
      input:
        'interface User {\n  id: number;\n  name: string;\n}\n\nconst greet = (user: User): string => `Hi ${user.name}`;',
      options: { language: 'typescript' },
    },
    {
      title: 'CSS',
      input: 'body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  color: #222;\n}',
      options: { language: 'css' },
    },
    {
      title: 'HTML',
      input:
        '<!doctype html>\n<html>\n  <head>\n    <title>Hello</title>\n  </head>\n  <body>\n    <!-- a comment -->\n    <h1 class="title">Hello</h1>\n  </body>\n</html>',
      options: { language: 'html' },
    },
    {
      title: 'JSON',
      input:
        '{\n  "name": "tesserae",\n  "tags": ["browser", "offline", "private"],\n  "stars": 42\n}',
      options: { language: 'json' },
    },
  ],
  related: ['code-beautify', 'css-minifier', 'json-format', 'html-validator'],
  credits: [
    { name: 'Terser', url: 'https://github.com/terser/terser', license: 'BSD-2-Clause' },
    { name: 'Sucrase', url: 'https://github.com/alangpierce/sucrase', license: 'MIT' },
    { name: 'csso', url: 'https://github.com/css/csso', license: 'MIT' },
    {
      name: 'html-minifier-terser',
      url: 'https://github.com/kangax/html-minifier',
      license: 'MIT',
    },
  ],
  status: 'beta',
};
