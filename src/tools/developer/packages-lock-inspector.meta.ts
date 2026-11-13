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
  examples: [
    {
      title: 'A small package-lock.json',
      input:
        '{\n  "name": "demo",\n  "version": "1.0.0",\n  "lockfileVersion": 3,\n  "requires": true,\n  "packages": {\n    "": { "name": "demo", "version": "1.0.0", "dependencies": { "left-pad": "^1.3.0" } },\n    "node_modules/left-pad": { "version": "1.3.0", "resolved": "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz", "integrity": "sha512-xyz==" }\n  }\n}',
    },
    {
      title: 'A package with no integrity hash',
      input:
        '{\n  "name": "demo",\n  "version": "1.0.0",\n  "lockfileVersion": 3,\n  "requires": true,\n  "packages": {\n    "": { "name": "demo", "version": "1.0.0", "dependencies": { "thing": "^2.0.0" } },\n    "node_modules/thing": { "version": "2.0.0", "resolved": "https://registry.npmjs.org/thing/-/thing-2.0.0.tgz" }\n  }\n}',
    },
    {
      title: 'A duplicated version of a package',
      input:
        '{\n  "name": "demo",\n  "version": "1.0.0",\n  "lockfileVersion": 3,\n  "requires": true,\n  "packages": {\n    "": { "name": "demo", "version": "1.0.0", "dependencies": { "util": "1.0.0", "dep": "2.0.0" } },\n    "node_modules/util": { "version": "1.0.0" },\n    "node_modules/other/node_modules/util": { "version": "2.0.0" }\n  }\n}',
    },
  ],
  related: ['semver', 'json-schema-check', 'yaml-lint', 'dockerfile-generator'],
  status: 'stable',
};
