# Runbook

Operational procedures for Tesserae. Day-to-day contributing lives in `CONTRIBUTING.md`; the tool contract
lives in `docs/ADDING-A-TOOL.md`. This file is for operators: deploy, roll back, respond to an incident.

## 0. The one command that matters

```bash
npm ci
npm run verify
```

`verify` runs, in order: `astro check` (types + Astro), `eslint`, `prettier --check`, `vitest` (unit), `astro build`,
`scripts/check-bundle.mjs` (bundle budget + the "pdf-lib must not be eager" invariant), and `playwright test` (e2e,
including the no-network privacy check and the axe accessibility sweep).

A red run blocks a release. Nothing else in this document overrides that.

## 1. Deploy

Deploys are automated: push to `master` and `.github/workflows/deploy.yml` builds and publishes to GitHub Pages.

| Variable    | Value for GitHub Pages             | Meaning                                                     |
| ----------- | ---------------------------------- | ----------------------------------------------------------- |
| `SITE_URL`  | `https://<owner>.github.io/<repo>` | Canonical origin, including the base path                   |
| `BASE_PATH` | `/<repo>`                          | The path the site is served from (`/` with a custom domain) |

Before the first deploy: **Settings → Pages → Source: GitHub Actions**.

Manual deploy from a workstation:

```bash
SITE_URL=https://<owner>.github.io/<repo> BASE_PATH=/<repo> npm run build
# then publish ./dist with any static host
```

Full launch and indexing checklist, including Search Console: `docs/LAUNCH.md`.

## 2. Roll back

1. Actions → the last good run → **Re-run all jobs**. The artifact is static, so this republishes the older build.
2. If visitors are stuck on a stale service worker, bump `VERSION` in `public/sw.js` and deploy — the update flow
   (`updatefound` → `postMessage('skip-waiting')`) prompts a reload.

Never rewrite history on `master` to roll back; republish instead.

## 3. A tool is broken in production

1. Reproduce on the live URL. Check the browser console and the Network tab — a real defect in this project never
   involves a request to a third party, so any unexpected request is a privacy regression and takes priority.
2. If the tool is unusable, set `status: 'beta'` in its `*.meta.ts` (the page shows a warning) or `hidden: true` to
   drop it from listings and the sitemap, and deploy. Both are one-line changes and cheap to revert.
3. Fix forward: add a regression test that fails on the old behaviour, then the fix.

## 4. A dependency advisory lands

1. `npm audit --omit=dev` — only production dependencies matter to visitors; this site is static and ships no
   server code, so dev-server advisories are usually unreachable (`SECURITY.md` records the reasoning).
2. If the advisory is reachable, bump the package, run `npm run verify`, and note any bundle-size change from
   `npm run bundle:check`.
3. Record the decision in `SECURITY.md` (reachable or not, and why) so the next person does not redo the analysis.

## 5. Adding or changing a tool

1. Follow `docs/ADDING-A-TOOL.md` — three co-located files (`*.meta.ts`, `*.tool.ts`, `*.test.ts`), plus a panel
   only when the tool needs custom interaction.
2. The meta must carry unique `description` prose, an `article` (3–5 headed sections, ~150–300 words), ≥3
   `examples`, ≥3 `faq`, and `related` ids that resolve to visible tools. `src/lib/contract.test.ts` enforces all
   of this; `src/lib/related-tools.test.ts` enforces the `related` rule.
3. Regenerate the catalogue: `npm run docs:tools` (CI runs `npm run docs:check` and fails if it drifts).
4. Regenerate social cards: `node scripts/gen-og.mjs` (runs against `dist/` after a build).

## 6. Merging two tools into one

The merged id survives as a hidden alias so old links keep working:

1. Give the surviving tool the absorbed behaviour (a mode option, usually).
2. Turn the old meta into a hidden alias: `redirectTo: '<survivor>'`, `hidden: true`, and a name/summary that says
   where it moved.
3. Delete the old `*.tool.ts` — the registry no longer requires a tool module for an alias (see
   `src/lib/registry.ts`), and `registry.test.ts` fails if an alias regains a real implementation.
4. Repoint every `related` array that named the old id. `related-tools.test.ts` catches the ones you miss.

## 7. Removing a tool deliberately

Set `hidden: true` first and deploy — that drops it from listings, search, `llms.txt` and the sitemap while the
route keeps resolving. Delete the files only once you are sure nothing links to it.

## 8. Bundle budget

`npm run bundle:check` fails when a tool page loads more than the budget, or when a non-PDF page loads a chunk
containing `PDFDocument`. Both are real user-visible regressions (the second was a 1.24 MB eager chunk on every
page). When you add a heavy library, load it with a dynamic `import()` inside the tool's `run()`, never at module
scope in a `*.meta.ts`.
