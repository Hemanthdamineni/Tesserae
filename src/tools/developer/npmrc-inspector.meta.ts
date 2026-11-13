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
  examples: [
    {
      title: 'A registry and auth config',
      input: 'registry=https://npm.example.com/\n_authToken=sekret-token\nsave-exact=true',
    },
    {
      title: 'A proxy and strict-ssl config',
      input:
        'https-proxy=http://proxy.example.com:8080\nproxy=http://proxy.example.com:8080\nstrict-ssl=false',
    },
    {
      title: 'A commented config with a bad key',
      input: '# npm scope\n@myco:registry=https://myco.example.com/\nnot_a_real_key=1',
    },
  ],
  related: ['packages-lock-inspector', 'dotenv', 'netrc-inspector', 'properties-convert'],
  status: 'stable',
};
