import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'packages-lock-inspector',
  name: 'Packages Lock Inspector',
  category: 'developer',
  summary: 'Inspect an npm package-lock.json on-device: version, packages, resolved and integrity.',
  description:
    'Paste an npm package-lock.json file and inspect it without uploading it. The tool reads the lockfile version and the name and version of the root package, and reports the total number of packages, the number that are installed under node_modules, the top-level dependencies declared by the root, and the package count without a resolved URL or without an integrity hash. It flags a malformed archive, an unexpected lockfile version, and any package missing its resolved URL or its integrity hash, so a broken or incomplete lockfile can be found before an install. The summary view gives the counts, the packages view lists every entry, and the issues view lists structural problems.',
  keywords: [
    'package-lock',
    'npm',
    'lockfile',
    'packages',
    'dependencies',
    'integrity',
    'resolved',
    'node_modules',
    'inspector',
    'registry',
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
        { value: 'packages', label: 'Packages' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a package-lock.json file' }],
  related: ['semver', 'json-schema-check', 'yaml-lint', 'dockerfile-generator'],
  status: 'stable',
};
