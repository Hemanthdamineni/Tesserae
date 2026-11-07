import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'netrc-inspector',
  name: 'Netrc File Inspector',
  category: 'developer',
  summary: 'Inspect a .netrc file on-device: machines, default entry, login, password and account.',
  description:
    'Paste a .netrc credentials file and inspect it without uploading it. The tool reads each machine entry and the default entry, and reports the host, the login name, whether a password is present and any account field. It flags a machine with no login, a machine with no password, a default entry with no login or password, a line that does not start with a known token, and a macdef block, so a broken or malformed netrc can be found before curl or git silently ignores it. Passwords are never printed, only whether one is set.',
  keywords: [
    'netrc',
    'credentials',
    'machine',
    'login',
    'password',
    'curl',
    'ftp',
    'git',
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
        { value: 'machines', label: 'Machines' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a .netrc file' }],
  related: ['ssh-config-auditor', 'pgp-tool', 'ssh-key-fingerprint', 'sudoers-auditor'],
  status: 'stable',
};
