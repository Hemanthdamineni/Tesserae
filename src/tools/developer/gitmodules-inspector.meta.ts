import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'gitmodules-inspector',
  name: 'Gitmodules Inspector',
  category: 'developer',
  summary: 'Inspect a .gitmodules file on-device: submodules, paths, URLs and branch settings.',
  description:
    'Paste a .gitmodules file and inspect it without uploading it. The tool reads each submodule section and reports the declared path, the remote URL, and any branch setting, and whether the path matches the submodule name from its section header. It flags a section with no path, a section with no URL, a section header with no matching closing name, and a malformed submodule line, so a broken submodule declaration can be found before git complains about it. The summary view gives the counts, the submodules view lists every entry, and the issues view lists structural problems.',
  keywords: [
    'gitmodules',
    'submodule',
    'git',
    'path',
    'url',
    'branch',
    'repository',
    'inspector',
    'developer',
    'config',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'submodules', label: 'Submodules' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a .gitmodules file' }],
  related: ['gitignore', 'dockerfile-generator', 'codeowners-validator', 'editorconfig'],
  status: 'stable',
};
