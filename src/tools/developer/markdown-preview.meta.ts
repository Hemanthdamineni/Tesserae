import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'markdown-preview',
  name: 'Markdown Preview',
  category: 'developer',
  summary:
    'Live split-pane Markdown editor with GFM, highlighted code, HTML export and print to PDF.',
  description:
    'Write Markdown on the left and watch it render on the right as you type. GitHub Flavored Markdown, slugged heading anchors, syntax-highlighted code blocks, a one-click HTML export and a print dialog that saves to PDF. Everything happens in this tab — nothing is uploaded.',
  keywords: [
    'markdown',
    'md',
    'markdown preview',
    'live preview',
    'markdown editor',
    'write markdown',
    'gfm',
    'github flavored markdown',
    'syntax highlighting',
    'markdown to pdf',
    'markdown to html',
    'readme preview',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  // The split-pane editor cannot be expressed by the generic workbench, so the
  // tool opts into a dedicated panel — the same route `pdf-sign` takes. The
  // options below drive that panel; `run()` reads the same Markdown switches
  // so the tool stays usable without the UI.
  panel: 'markdown',
  options: [
    {
      key: 'gfm',
      label: 'GitHub Flavored Markdown',
      type: 'boolean',
      default: true,
      help: 'Enable tables, strikethrough, task lists and autolinks.',
    },
    {
      key: 'breaks',
      label: 'Convert single line breaks to <br>',
      type: 'boolean',
      default: false,
      help: 'Treat every newline inside a paragraph as a hard break.',
    },
    {
      key: 'headerIds',
      label: 'Add id="" to headings',
      type: 'boolean',
      default: true,
      help: 'Give every heading a slugified id so it can be linked to.',
    },
    {
      key: 'highlight',
      label: 'Syntax-highlight code blocks',
      type: 'boolean',
      default: true,
      help: 'Load the highlighter on demand. Turn it off to keep the page light.',
    },
    {
      key: 'codeTheme',
      label: 'Code theme',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Match the page theme' },
        { value: 'github-light', label: 'GitHub Light' },
        { value: 'github-dark', label: 'GitHub Dark' },
        { value: 'nord', label: 'Nord' },
        { value: 'dracula', label: 'Dracula' },
      ],
      showWhen: { key: 'highlight', value: true },
      help: 'The colour scheme used for highlighted code blocks.',
    },
    {
      key: 'theme',
      label: 'Preview theme',
      type: 'select',
      default: 'light',
      choices: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ],
      help: 'The colours of the rendered preview and of the exported file.',
    },
  ],
  examples: [
    {
      title: 'README',
      input:
        '# Tesserae\n\nA **privacy-first** collection of browser utilities — every tool runs in this tab.\n\n## Install\n\n```bash\nnpm install tesserae\n```\n\n## Usage\n\n```js\nimport { render } from "tesserae/markdown";\n\nconsole.log(render("# Hello"));\n```\n\n## Checklist\n\n- [x] Parse the Markdown\n- [x] Render the preview\n- [ ] Ship it\n\n| Feature        | Status |\n| -------------- | ------ |\n| Tables         | ✅     |\n| Strikethrough  | ✅     |\n| Task lists     | ✅     |\n',
    },
    {
      title: 'Heading and paragraph',
      input:
        '# Getting started\n\nWrite **Markdown** on the left and the preview follows along on the right.\n',
    },
    {
      title: 'GFM table',
      input:
        '| Feature | Status |\n| --- | --- |\n| Tables | ✅ |\n| Strikethrough | ✅ |\n| Task lists | ✅ |\n',
      options: { gfm: true },
    },
    {
      title: 'Code block',
      input: '```ts\nconst greeting: string = "hello";\nconsole.log(greeting);\n```\n',
    },
    {
      title: 'Task list',
      input: '- [x] Split-pane editor\n- [x] Syntax highlighting\n- [ ] Export to HTML\n',
      options: { gfm: true },
    },
  ],
  related: ['markdown-to-html', 'markdown-toc', 'markdown-table', 'html-to-markdown'],
  credits: [
    { name: 'marked', url: 'https://github.com/markedjs/marked', license: 'MIT' },
    { name: 'shiki', url: 'https://github.com/shikijs/shiki', license: 'MIT' },
  ],
  status: 'beta',
};
