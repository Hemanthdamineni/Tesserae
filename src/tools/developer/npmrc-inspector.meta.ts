import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'npmrc-inspector',
  name: 'Npmrc Inspector',
  category: 'developer',
  summary: 'Inspect an .npmrc file on-device: registry, scoped registries, auth tokens and flags.',
  description:
    'Paste an .npmrc npm configuration file and inspect it without uploading it. The tool reads each key and value, and reports the default registry, every scoped registry, the auth token entries, and the boolean flags that are set. It flags a line with no equals sign, an empty key, an empty value, a duplicate key, and an auth token entry, so an npm config can be reviewed before it is committed. Auth token values are never printed, only that a token is configured. The summary view gives the counts, the settings view lists every key, and the issues view lists structural problems.',
  keywords: [
    'npmrc',
    'npm',
    'registry',
    'authToken',
    'config',
    'settings',
    'scope',
    'node',
    'inspector',
    'developer',
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
        { value: 'settings', label: 'Settings' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Inspect an .npmrc file' }],
  related: ['packages-lock-inspector', 'dotenv', 'netrc-inspector', 'properties-convert'],
  status: 'stable',
};
