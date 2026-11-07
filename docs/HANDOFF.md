# Hand-off guide

Everything a new maintainer needs to run, change, verify and ship Tesserae.

## What this is

Tesserae is a static catalogue of **506 browser-side utilities** — encoders,
hashers, formatters, converters, inspectors, generators, image/PDF/audio tools.
There is no backend and no upload path: every tool runs in the visitor's tab,
often inside a Web Worker. The site is an Astro build deployed as static files.

Two promises shape most decisions:

1. **Nothing leaves the device.** No analytics, no cookies, no server calls at
   runtime. The privacy model is data (`meta.privacy`), and an e2e test fails
   the build if a page makes a network request.
2. **The catalogue stays fast.** A tool's code is lazy-loaded; the entry JS
   budget is enforced by `npm run bundle:check`.

## Quick start

Requires **Node 22.23.4+** (see `engines` in `package.json`).

```bash
npm ci                # reproducible install from package-lock.json
npm run dev           # http://localhost:4321
npm run verify        # the full gate CI runs, locally
```

`npm run build` writes `dist/`. Two build-time variables control URLs:

| Variable    | Default                                                    | Purpose                          |
| ----------- | ---------------------------------------------------------- | -------------------------------- |
| `SITE_URL`  | `https://hemanthdamineni.github.io/Tesserae` | Canonical origin, sitemap, OG    |
| `BASE_PATH` | `/Tesserae`                                  | Sub-path the site is served from |

## Repository map

| Path                        | What lives there                                                       |
| --------------------------- | ---------------------------------------------------------------------- |
| `src/tools/<category>/`     | One folder per tool: `.meta.ts`, `.tool.ts`, `.test.ts`, `.content.ts` |
| `src/lib/registry.ts`       | Discovers tools with `import.meta.glob`; no manual wiring              |
| `src/lib/content.ts`        | Loads optional article/FAQ prose at build time                         |
| `src/components/workbench/` | Text/File/Media workbenches and their shared controls                  |
| `src/components/panels/`    | Tool-specific UI panels (audio, image, OCR, PDF, …)                    |
| `src/lib/worker/`           | Generic worker client, cancellation and progress plumbing              |
| `src/pages/`                | Routes: home, `/tools`, `/categories`, guides, sitemap, `llms.txt`     |
| `scripts/`                  | Docs generation, bundle budget, asset vendoring, static server         |
| `e2e/`                      | Playwright smoke, privacy, deep-audit and fixture specs                |
| `docs/`                     | Maintainer documentation (start with `ARCHITECTURE.md`)                |
| `docs/history/`             | Completed plans, audit reports and round logs — historical only        |

## Gates

`npm run verify` is the single source of truth. It runs, in order:

1. `npm run check` — `astro check` (0 errors; hints are deprecations)
2. `npm run lint` — ESLint
3. `npm run format:check` — Prettier
4. `npm run test` — Vitest (unit, ~7,000 tests)
5. `npm run build` — static build to `dist/`
6. `npm run bundle:check` — entry-chunk and total-JS budgets
7. `npm run test:e2e` — Playwright smoke + privacy (excludes deep audit)

Extras used by CI or before a release:

| Command                   | What it does                                                     |
| ------------------------- | ---------------------------------------------------------------- |
| `npm run docs:check`      | Regenerates `docs/TOOLS.md` and fails if the result differs      |
| `npm run test:audit`      | Deep audit: runs every tool with a real fixture (4 shards in CI) |
| `npm run test:coverage`   | Unit tests with V8 coverage                                      |
| `npm run test:e2e:webkit` | Safari smoke inside the Playwright Docker image                  |
| `npm audit`               | Must stay at zero; the tree is pinned through `overrides`        |

When you change a tool's metadata, run `npm run docs:tools` and commit the
regenerated `docs/TOOLS.md`/`.csv`. When you add a tool, also add its FAQ and
examples — `src/lib/contract.test.ts` enforces the contract.

## Deploying

- **GitHub Pages** — `.github/workflows/deploy.yml` builds and publishes on
  every push to `master` (skipped on forks). `SITE_URL`/`BASE_PATH` are derived
  from the repository name.
- **Netlify / Vercel / Cloudflare Pages** — configs are committed
  (`netlify.toml`, `vercel.json`); set `SITE_URL` (and `BASE_PATH=/` for a
  custom domain) in the host's build settings. Details in `DEPLOYMENT.md`.
- No secrets are required for a deploy. CI needs only the default token.

## CI

`.github/workflows/ci.yml` runs typecheck, lint, format, docs freshness, unit
tests with coverage, build, `npm audit`, and the Playwright suite; a second job
runs the deep audit in four shards. `npm run verify` locally mirrors it closely
enough to catch anything before a push.

## Conventions and constraints

- **Privacy** — never add analytics, remote fonts, CDNs or runtime fetches. The
  privacy e2e test blocks and asserts on network egress.
- **No backend** — anything requiring a server belongs in a different project;
  WASM bundles are vendored under `public/vendor/` and checked in `build`.
- **Node** — the pinned engine is intentional (Vitest 5 and Astro 7 both need
  modern Node). Update `engines`, CI and this guide together. CI pins the exact
  version (`22.23.4`) rather than `22` because the runner's bundled tool cache
  can lag a patch behind, and Astro refuses to build on an older Node.
- **Dependency upgrades** — Vitest 5 requires every `expect(...).rejects`
  assertion to be awaited; ESLint 10 needs `minimatch` ≥ 11 via `overrides`.
  `npm audit` must stay at zero.
- **Bundle budget** — `scripts/check-bundle.mjs` allows 120 KB gzip per eager
  entry and 24 KB x tool pages for total JS. Heavy dependencies must stay
  behind a dynamic `import()`.
- **History** — `docs/history/` is append-only context, not live documentation.
  `TODOS.md`/`BACKLOG.md` there are complete and kept for provenance only.

## Known local-only setup

- Playwright browsers are not checked in: `npx playwright install chromium`
  (and `webkit` if you want the local Safari project). WebKit's host libraries
  are only present on some distributions; `playwright.config.ts` detects this
  and skips the project with a message. `npm run test:e2e:webkit` runs it in
  Docker instead.
- `public/vendor/` is generated by `npm run vendor:heif` / `vendor:tesseract`;
  the build verifies it exists but does not regenerate it.

## Where to start

- Add or change a tool: `docs/ADDING-A-TOOL.md`
- Understand the runtime: `docs/ARCHITECTURE.md`
- Launch/operations notes: `docs/LAUNCH.md`, `docs/RUNBOOK.md`
- Deployment details: `docs/DEPLOYMENT.md`
- The generated catalogue: `docs/TOOLS.md`
