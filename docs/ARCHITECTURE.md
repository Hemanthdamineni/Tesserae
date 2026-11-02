# Architecture

## Goals

- **Private by construction.** Static files on a CDN. No server, so there is
  nothing to upload to. Tools run in the visitor's tab.
- **Lightweight core, large catalogue.** The shell is HTML + a few kB of JS.
  Each tool's code — and any heavy library it needs — is a separate chunk fetched
  only when that tool is opened.
- **Cheap to extend.** Adding a tool is three small files and no wiring
  (`docs/ADDING-A-TOOL.md`).
- **Installable everywhere.** A PWA that works offline on Windows, macOS, Linux,
  Android and iOS.

## Stack

| Concern        | Choice                                        | Why                                           |
| -------------- | --------------------------------------------- | --------------------------------------------- |
| Site generator | Astro 4, `output: 'static'`                   | Zero JS by default; islands only where needed |
| Styling        | Tailwind CSS 3 + CSS custom properties        | Small, themeable (light/dark/system)          |
| Interactivity  | Hand-written TypeScript in `<script>` islands | No framework runtime shipped                  |
| Heavy work     | Web Worker (`src/lib/worker/tool.worker.ts`)  | UI never blocks                               |
| Tests          | Vitest (unit) + Playwright (e2e + privacy)    | —                                             |

## Directory map

```
src/
  lib/
    types.ts        The tool contract (ToolMeta, ToolModule, render kinds)
    registry.ts     import.meta.glob discovery of src/tools/**
    categories.ts   Category definitions
    options.ts      resolveOptions(): merge caller values over declared defaults
    format.ts       formatBytes / slugify / escapeHtml / …
    files.ts        read*, downloadBlob, downloadZip, createDropZone
    clipboard.ts    copyText with legacy fallback
    capabilities.ts SSR-safe feature detection
    seo.ts          JSON-LD builders
    site.ts         Branding + nav (rename the product here only)
    worker/
      tool.worker.ts  Generic worker: id -> lazy import -> run()
      client.ts       runTool / runToolById, worker lifecycle, abort
  components/
    Layout / Header / Footer / BaseHead / SearchDialog / ThemeToggle / Icon
    ToolPage.astro        Per-tool page chrome (breadcrumb, privacy, FAQ, related)
    PrivacyBadge.astro    Rendered from meta.privacy — never hard-coded
    ToolCard / CategoryCard
    workbench/
      TextWorkbench.astro + FileWorkbench.astro
      OptionsFields.astro   Renders the option schema
      shared.ts             readOptions / applyShowWhen / renderTextResult
  pages/
    index / tools/index / tools/[tool] / categories/[category] / privacy / about
    sitemap.xml.ts / robots.txt.ts / manifest.webmanifest.ts / opensearch.xml.ts
  tools/<category>/<id>.{meta,tool,test}.ts
public/
  sw.js  favicon.*  icons/*  _headers  og.png
scripts/gen-icons.mjs   Deterministic PNG/ICO generation (Node zlib only)
```

## Request/response flow for a tool run

```
tool page (static HTML)
  └─ TextWorkbench / FileWorkbench island
       └─ runToolById(id, payload, { signal, onProgress })      src/lib/worker/client.ts
            ├─ text tool  → import the module on the main thread → run()
            └─ file tool  → postMessage to tool.worker.ts
                              └─ import.meta.glob lazy import of <id>.tool.ts → run()
                                   └─ progress + result posted back
```

`AbortSignal` is not structured-cloneable, so cancelling a worker job
`terminate()`s the worker; it is recreated on the next run.

## Privacy model as data

`meta.privacy = { processing: 'on-device', network: 'none' | string[], offline }`.
`PrivacyBadge` and `/privacy` are generated from this. An e2e test
(`e2e/privacy.spec.ts`) loads every tool page, exercises it, and fails if any
cross-origin request is made by a tool that declares `network: 'none'`.

## Build output

`npm run build` → `dist/` of pre-rendered HTML + hashed assets under `/_astro/`.
`public/_headers` carries the CSP and cache rules for Netlify / Cloudflare Pages;
`docs/DEPLOYMENT.md` translates them for other hosts.

## Tool categories

| Category   | Description         | Count |
| ---------- | ------------------- | ----- |
| encoding   | Encoding & Decoding | 10    |
| crypto     | Hashing & Crypto    | 4     |
| security   | Security & Privacy  | 4     |
| text       | Text & Strings      | 17    |
| data       | Data Formats        | 13    |
| developer  | Developer Utilities | 14    |
| web        | Web & CSS           | 16    |
| color      | Colour              | 7     |
| datetime   | Date & Time         | 7     |
| numbers    | Numbers & Maths     | 2     |
| converters | Converters          | 0     |
| generators | Generators          | 11    |
| network    | Network             | 0     |
| image      | Image               | 0     |
| pdf        | PDF                 | 0     |
| archive    | Archives & Files    | 0     |
| audio      | Audio               | 0     |
| misc       | Everyday Tools      | 0     |

_Note: Categories with 0 tools are reserved for future expansion (E4+)._

## Known follow-ups

- Astro 4 has advisories fixed only in Astro 7 (all dev-server / SSR; none affect
  the static output). Tracked in `SECURITY.md`; upgrade planned.
- Worker + main thread each bundle a copy of a tool's module. Small today;
  revisit if the catalogue's worker tools get heavy.
- True multi-GB streaming hashing/compression (needs an incremental-hash lib).

## Worker/main-thread chunk dedupe — won't do (documented) {#chunk-dedupe}

Investigated under E2-S4-T1 (2026-09): every `*.tool.ts` module is bundled twice
— once in the main graph (lazy `import()` from the workbenches) and once inside
the generic worker bundle (`tool.worker.ts`'s `import.meta.glob`). Measured
~460 KB raw of ~860 KB in `dist/_astro/` are these paired tool chunks (each copy
is independently tree-shaken, so the copies are not byte-identical).

The obvious fix — a Vite `build.rollupOptions.output.manualChunks` entry for
`src/tools/**` + heavy vendor libs — **cannot** dedupe here: Vite compiles the
worker graph as a _separate Rollup build_ with its own chunk graph and hashed
output. Chunk ids are never shared across the two builds, and no
`manualChunks`/`shared-chunk` configuration can make the main graph reference a
worker-build chunk (or vice versa) without a fragile custom emit/rewrite plugin
that would couple us to Vite internals and break across Astro/Vite upgrades.

Accepting the duplication keeps the build boring and each graph independently
tree-shaken (a text tool that never runs in the worker still only costs one
small copy). Revisit only if the _duplicated_ bytes grow an order of magnitude
(e.g. after Batch C's canvas/pdf tools): trigger is total `_astro/` > 5 MB raw,
at which point the right move is per-tool "prefer worker" routing instead of
chunk surgery.
