/**
 * Editorial content for the nginx-config-auditor tool page.
 *
 * Kept out of ``nginx-config-auditor.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does the auditor check?',
      a: 'It scans an nginx configuration for security-relevant settings: whether a server block sets security headers, whether TLS is pinned and strong, and whether risky directives such as a bare server_name or missing client_body timeouts are present.',
    },
    {
      q: 'What makes a check fail?',
      a: 'A check fails when the expected secure value is missing or set to a weak one, such as no Strict-Transport-Security header, an ssl_protocols that still allows TLSv1 or TLSv1.1, or error pages that disclose server details.',
    },
    {
      q: 'Is my server config uploaded?',
      a: 'No. The configuration is parsed entirely in the browser, so an internal server block or a private upstream address is never transmitted.',
    },
  ],
} as const;
