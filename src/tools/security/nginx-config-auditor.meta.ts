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
  examples: [
    {
      title: 'A server with strict security headers',
      input:
        'server {\n  listen 443 ssl;\n  server_name example.com;\n  ssl_certificate /etc/ssl/example.crt;\n  ssl_certificate_key /etc/ssl/example.key;\n  ssl_protocols TLSv1.2 TLSv1.3;\n  add_header Strict-Transport-Security "max-age=63072000";\n  add_header X-Content-Type-Options nosniff;\n  root /var/www/example;\n}',
    },
    {
      title: 'A server allowing TLSv1 and TLSv1.1',
      input:
        'server {\n  listen 443 ssl;\n  server_name example.com;\n  ssl_protocols TLSv1 TLSv1.1 TLSv1.2;\n  root /var/www/example;\n}',
    },
    {
      title: 'A plain http server with no headers',
      input:
        'server {\n  listen 80;\n  server_name example.com;\n  location / {\n    proxy_pass http://backend;\n  }\n}',
    },
  ],
  related: ['ssh-config-auditor', 'sudoers-auditor', 'security-headers', 'http-header-analyzer'],
  status: 'stable',
};
