import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'nginx-config-auditor',
  name: 'nginx Config Auditor',
  category: 'security',
  summary:
    'Audit an nginx config on-device: TLS, version hiding, redirects, server names and braces.',
  description:
    'Paste an nginx configuration and audit it without uploading it. The tool counts server blocks and listens, then flags common hardening and correctness problems: server_tokens left on, a TLS server without ssl_protocols, weak or missing ssl_ciphers, a plain HTTP server that never redirects to HTTPS, a server block without server_name, a deprecated ssl on directive, and unbalanced braces. The summary view gives the counts, the issues view lists every problem with a severity and a fix, and the directives view lists the top-level directives it found.',
  keywords: [
    'nginx',
    'nginx config',
    'server block',
    'ssl',
    'tls',
    'server_tokens',
    'hardening',
    'config audit',
    'reverse proxy',
    'security',
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
        { value: 'issues', label: 'Issues' },
        { value: 'directives', label: 'Directives' },
      ],
    },
  ],
  examples: [{ title: 'Audit an nginx configuration' }],
  related: ['ssh-config-auditor', 'sudoers-auditor', 'security-headers', 'http-header-analyzer'],
  status: 'stable',
};
