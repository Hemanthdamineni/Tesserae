# Toolbench

A large collection of file and text utilities that run **entirely in your
browser**. No uploads, no accounts, no tracking. Works offline once loaded and
installs as an app on every major OS.

> Encoders, hashers, formatters, converters, generators, colour, date/time,
> numbers, network, image, PDF, archive and audio tools — each one a small,
> lazy-loaded module so the site stays fast no matter how many are added.

## Why

Most "online tools" upload your file to someone's server for a job the browser
can do itself. Toolbench does the job locally: your data never leaves the tab.
You can verify that in DevTools → Network, or by pulling the plug after the page
loads.

## Develop

```bash
npm ci
npm run dev            # http://localhost:4321
```

| Script                 | What                                                  |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Dev server                                            |
| `npm run build`        | Static build to `dist/` (see env vars below)          |
| `npm run preview`      | Serve the build                                       |
| `npm run check`        | `astro check` (types)                                 |
| `npm run lint`         | ESLint                                                |
| `npm run format`       | Prettier (write) / `format:check` to verify           |
| `npm test`             | Vitest unit tests                                     |
| `npm run test:e2e`     | Playwright smoke + privacy (no network egress) checks |
| `npm run test:audit`   | Deep audit: every tool against a real fixture         |
| `npm run docs:tools`   | Regenerate `docs/TOOLS.md` / `.csv` from the registry |
| `npm run bundle:check` | Entry-chunk and total-JS budgets                      |
| `npm run verify`       | check + lint + format + test + build + bundle + e2e   |

Requires **Node 22.23.4+**.

Build-time environment variables:

- `SITE_URL` — canonical origin, baked into canonical URLs and the sitemap
  (default `https://hemanthdamineni.github.io/browser-tools-platform`).
- `BASE_PATH` — path the site is served from (default `/browser-tools-platform`);
  set `BASE_PATH=/` for a custom domain at the domain root.

```bash
SITE_URL=https://your-domain.example BASE_PATH=/ npm run build
```

## Add a tool

Three small files, no wiring — see **[docs/ADDING-A-TOOL.md](docs/ADDING-A-TOOL.md)**.

## Documentation

| Doc                                                | What it covers                               |
| -------------------------------------------------- | -------------------------------------------- |
| **[docs/HANDOFF.md](docs/HANDOFF.md)**             | Run, verify, deploy and maintain the project |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**   | Stack, directory map and runtime flow        |
| **[docs/ADDING-A-TOOL.md](docs/ADDING-A-TOOL.md)** | Tool metadata, content contract, fixtures    |
| **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**       | GitHub Pages, Netlify, Vercel, Cloudflare    |
| **[docs/TOOLS.md](docs/TOOLS.md)**                 | Generated catalogue of every tool            |
| **[docs/history/](docs/history/)**                 | Completed plans, audits and round logs       |

## How it's built

Static Astro + TypeScript, Tailwind, hand-written vanilla islands, a generic Web
Worker for heavy jobs. No backend. Full write-up in
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Deploy

Any static host. Set `SITE_URL` and `BASE_PATH` at build time (see above).
GitHub Pages, Netlify, Vercel and Cloudflare Pages configs are included —
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Privacy & security

**[/privacy](src/pages/privacy.astro)** (generated from per-tool metadata) and
**[SECURITY.md](SECURITY.md)**.

## Licence

MIT — see [LICENSE](LICENSE). Bundled libraries and their licences: [NOTICE](NOTICE).
