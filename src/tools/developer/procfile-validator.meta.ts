import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'procfile-validator',
  name: 'Procfile Validator',
  category: 'developer',
  summary: 'Validate a Heroku Procfile on-device: process types, commands, duplicates and syntax.',
  description:
    'Paste a Heroku Procfile and validate it without uploading it. The tool reads each line as a process type, a colon, and a command, and reports the declared process types and the commands that run them. It flags a line with no colon, an empty process type, an empty command, and a process type that is declared more than once, so a Procfile is verified before it is deployed to Heroku or run with a process manager. The summary view gives the counts, the processes view lists every line, and the issues view lists the problems.',
  keywords: [
    'procfile',
    'heroku',
    'process',
    'web',
    'worker',
    'foreman',
    'deploy',
    'validate',
    'command',
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
        { value: 'processes', label: 'Processes' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [
    {
      title: 'A web and a worker process',
      input: 'web: node server.js\nworker: node worker.js',
    },
    {
      title: 'A line with no command',
      input: 'web: node server.js\nworker:',
    },
    {
      title: 'A repeated process type',
      input: 'web: node server.js\nweb: node server2.js\nclock: node clock.js',
    },
  ],
  related: ['dockerfile-generator', 'systemd-unit-inspector', 'gitignore', 'nginx-config-auditor'],
  status: 'stable',
};
