# Tesserae

An opus tessellatum of private tools. Each one a tessera; together, the work.

![CI](https://github.com/Hemanthdamineni/Tesserae/actions/workflows/ci.yml/badge.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Hemanthdamineni/Tesserae/blob/main/LICENSE)

Tesserae is a collection of 526+ file and text utilities that run **entirely in your
browser**. No uploads, no accounts, no tracking. Works offline once loaded and
installs as an app on every major OS.

> Formerly known as **Browser Tools Platform** (see decision D-0035).

## Table of Contents

- [Why](#why)
- [Features](#features)
- [Getting Started](#getting-started)
- [Usage / Deploy](#usage--deploy)
- [Contributing](#contributing)
- [Community](#community)
- [Documentation](#documentation)
- [Security](#security)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## Why

Most "online tools" upload your file to someone's server for a job the browser
can do itself. Tesserae does the job locally: your data never leaves the tab.
You can verify that in DevTools → Network, or by pulling the plug after the page
loads.

## Features

- **Private by default** — every tool runs on your device. No uploads, no
  accounts, no tracking.
- **Offline-capable PWA** — installs as an app on every major platform and works
  with no internet connection once loaded.
- **Fast by design** — each tool is a small, lazy-loaded module (heavy jobs run in
  a Web Worker), so the site stays fast no matter how many tools are added.
- **Broad coverage** — encoders, hashers, formatters, converters, generators,
  colour, date/time, numbers, network, image, PDF, archive and audio tools.
- **Static only** — no backend, no database, no server-side processing.

## Getting Started

### Prerequisites

- **Node 22.23.4+**

### Clone and run

```bash
git clone https://github.com/Hemanthdamineni/Tesserae.git
cd Tesserae
npm ci
npm run dev            # http://localhost:4321
```

### Available scripts

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

## Usage / Deploy

Tesserae is a fully static site — deploy it on any static host. Set the
build-time environment variables below, then run `npm run build`.

| Variable    | What it does                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`  | Canonical origin, baked into canonical URLs and the sitemap (default `https://hemanthdamineni.github.io/Tesserae`). |
| `BASE_PATH` | Path the site is served from (default `/Tesserae`); set `BASE_PATH=/` for a custom domain at the domain root.       |

```bash
SITE_URL=https://your-domain.example BASE_PATH=/ npm run build
```

GitHub Pages, Netlify, Vercel and Cloudflare Pages configs are included —
see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Contributing

Tesserae is maintained by its community. Every tool here is a tessera — pieces
contributed by people who needed it and made it. Contributions are welcome.

- **Add a tool** — three small files, no wiring — see
  **[docs/ADDING-A-TOOL.md](docs/ADDING-A-TOOL.md)**.
- **Report a bug** — open an issue on
  [GitHub](https://github.com/Hemanthdamineni/Tesserae/issues) with
  what you expected, what happened, and a sample input where relevant.
- **Pull requests** are reviewed in the open — see
  **[CONTRIBUTING.md](CONTRIBUTING.md)** for setup and expectations.

The code is MIT-licensed, so your contributions stay open source.

## Community

Tesserae is a community-maintained project, not a sole-maintained one. If it
helps you, give it back: request a tool, report a bug, or send a pull request.

- Browse and open
  [issues](https://github.com/Hemanthdamineni/Tesserae/issues)
  for bugs, tool suggestions, and ideas.
- Join the conversation in
  [discussions](https://github.com/Hemanthdamineni/Tesserae/discussions)
  for questions and general feedback.
- See the [Contributing section](#contributing) to add a tool or
  [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

## Documentation

| Doc                                                | What it covers                               |
| -------------------------------------------------- | -------------------------------------------- |
| **[docs/HANDOFF.md](docs/HANDOFF.md)**             | Run, verify, deploy and maintain the project |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**   | Stack, directory map and runtime flow        |
| **[docs/ADDING-A-TOOL.md](docs/ADDING-A-TOOL.md)** | Tool metadata, content contract, fixtures    |
| **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**       | GitHub Pages, Netlify, Vercel, Cloudflare    |
| **[docs/TOOLS.md](docs/TOOLS.md)**                 | Generated catalogue of every tool            |
| **[docs/history/](docs/history/)**                 | Completed plans, audits and round logs       |

How it's built: static Astro + TypeScript, Tailwind, hand-written vanilla islands,
a generic Web Worker for heavy jobs. No backend. Heavy runtime assets such as
ONNX WebAssembly are vendored under `public/vendor/` and served by the static
host. Full write-up in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Security

**[/privacy](src/pages/privacy.astro)** (generated from per-tool metadata) and
**[SECURITY.md](SECURITY.md)**. To report
a vulnerability, follow the instructions in
[SECURITY.md](SECURITY.md) — please do not file public issues for undisclosed
vulnerabilities.

## License

MIT — see [LICENSE](LICENSE). Bundled libraries and their licences:
[NOTICE](NOTICE).

## Acknowledgements

Thanks to every contributor who has added a tool, fixed a bug, or suggested an
idea — Tesserae is the sum of those pieces. Heavy runtime libraries (such as
ONNX WebAssembly, Tesseract and HEIF support) are vendored under
`public/vendor/` and served by the static host; see
[NOTICE](NOTICE) for the full bundled-library inventory.
