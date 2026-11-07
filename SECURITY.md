# Security

## Reporting

Email the maintainers or open a private security advisory on the repository.
Please do not file public issues for undisclosed vulnerabilities.

## Threat model

Tesserae ships **static files only**. There is no server, database, session or
user account. The main asset to protect is the visitor's own data while it is
being processed in their tab.

| Risk                               | Mitigation                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exfiltration of user input         | No backend. CSP `connect-src 'self' blob:`. e2e test fails the build if a `network: 'none'` tool makes any cross-origin request.                                                      |
| XSS via tool output                | Tool `run()` returns strings; the workbench renders them as text / into `<img src="data:">` / typed structures — output is never parsed as HTML. `escapeHtml` on every interpolation. |
| XSS via dependency                 | `default-src 'self'`, no third-party scripts, no CDN, SRI-free because nothing is remote. `npm audit` in CI.                                                                          |
| Malicious `data:`/`blob:` download | Downloads are user-initiated `<a download>`; no auto-execution.                                                                                                                       |
| Clickjacking                       | `frame-ancestors 'none'` / `X-Frame-Options: DENY`.                                                                                                                                   |
| ReDoS (regex tools)                | User-supplied patterns run against user-supplied text in the user's own tab; a hang only affects that tab. Long-running work is cancellable.                                          |
| Supply chain                       | Minimal dependencies, exact ranges, `npm audit` gate, `NOTICE` inventory.                                                                                                             |

## Known advisories (accepted, tracked)

`npm audit` currently reports advisories against **Astro 4.16** and its build-time
dependencies (esbuild, vite, sharp) that are fixed only in Astro 7.x.

Assessment: every one of these advisories concerns the **Astro dev server**,
**SSR request handling**, **server islands**, or a **server adapter**. Tesserae
builds with `output: 'static'`, uses no adapter, no middleware and no server
islands, and deploys as pre-rendered files. None of the reported issues are
reachable in the production artifact.

Action: upgrade to Astro 7 (with the Tailwind v4 / `@tailwindcss/vite` migration)
is planned and tracked in `docs/ROADMAP.md`. Until then CI runs
`npm audit --omit=dev --audit-level=critical` and the full report is reviewed on
each dependency change.

## Hardening checklist for contributors

- Never `innerHTML` untrusted strings. Use `textContent` or `escapeHtml`.
- Tool `run()` must not touch the network. If a tool genuinely needs a remote
  call, it must be opt-in, declared in `meta.privacy.network`, listed on
  `/privacy`, and the e2e allow-list updated with justification.
- New dependencies: check licence (permissive only), transitive weight, and
  maintenance status before adding.
