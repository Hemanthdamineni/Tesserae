# Round Report

Append-only log. One entry per autonomous run. A human reviews this at the end of the
round and writes the next `BACKLOG.md` and `TODOS.md`.

## run-20261016-1001-61fc — 2026-10-16T10:19:56Z

- Merged: none — the run ended in setup because clean `main` does not pass the repo check.
- Failed: none — no items were claimed.
- Blocked: all items — the required check is red on a clean checkout, so the entire batch was left for a human rather than built on a broken base.
- Main broken: `npm run test` fails on a clean checkout of `origin/master`.
  - Failing test: `src/lib/registry.test.ts > registry > each tool module loads and exposes run()` — `Error: Test timed out in 5000ms.`
  - Root cause: the test loops over `ALL_TOOLS` (263 tools) and `await t.load()`s each `<id>.tool.ts` under jsdom. In isolation it takes ~4.4s; inside the full suite (268 files in parallel) it exceeds vitest's 5s default `testTimeout`.
  - Evidence: `npm test` on clean main failed twice with this single failure (1894 passed / 1 failed); `npx vitest run --testTimeout=60000` passes cleanly — 268 files / 1895 tests, so only the default timeout is too tight.
  - Other check steps on the same clean main are green: `astro check` → 0 errors; `eslint .` → clean; `npm run build` → 288 pages built.
  - Not fixed here: this is unrelated breakage and the protocol says not to touch it. I did **not** raise the timeout. Note a fix already exists as an uncommitted edit in the primary checkout (add `, 60_000` to that test).
- Mistakes noticed:
  - `src/lib/registry.test.ts` — the "each tool module loads and exposes run()" test has a fixed 5s timeout that does not scale with the catalogue. It is load-sensitive and deterministically red in the full parallel suite at 263 tools; it needs an explicit timeout.
  - The `TOOLS.md` generator is **not committed**. `scripts/gen-tools-doc.mjs` (regenerates `docs/TOOLS.md` + `docs/TOOLS.md.csv` from `src/tools/**/*.meta.ts`) exists only as an untracked file in the primary checkout; there is no `npm` script for it and CI does not call it. A run cannot reliably "regenerate `TOOLS.md` with the repo's generator".
  - Settings said `MAIN_BRANCH = main`, but this repo has no `main` branch: `origin/HEAD -> origin/master` and the only remote heads are `master` and `worktree-new-tool-worktree`. This run treated `master` as the main branch so pushes target the branch the other runs actually use.
  - Several concurrent runs had already claimed items (`merge-cors-headers` + `upgrade-image-batch-1/2/3`, `merge-conditional-headers`/`video-foundation`/`ml-runtime-foundation`/`pdf-compress`, `merge-cache-headers`/`qr-scanner`/`heic-to-jpg`/`image-strip-metadata`, `merge-escape-tools`/`pdf-sign`/`code-beautify`/`code-minify`); they will hit the same red suite when they verify.
- Ideas: none this run.

## run-20261017-1203-68f4 — 2026-10-17T13:49:49Z

Batch (filled from `BACKLOG.md` first, then `TODOS.md`): `merge-cache-headers`,
`ml-runtime-foundation`, `pdf-compress`, `qr-scanner`. One merge item, no intra-batch dependencies,
no two items touching the same tool.

- Merged: `merge-cache-headers` — `8943bdc` — one `cache-headers` tool absorbs Cache-Control,
  CDN-Cache-Control, Surrogate-Control, Expires, Age, Cache-Status and Vary; the seven old ids stay
  routable as hidden `redirectTo` aliases (verified with two live redirects in a browser).
- Merged: `qr-scanner` — `efe0e63` — camera plus image scanning, native `BarcodeDetector` with a
  lazily-imported `jsqr` fallback; verified by decoding real URL / Wi-Fi / plain-text QR PNGs, plus a
  friendly error on a blank image, with zero console errors and zero off-origin requests.
- Merged: `pdf-compress` — `d7aa8b6` — image downsampling and stream cleanup with presets and a
  before/after size report; a 2,058,214-byte test PDF compressed to 224,501 bytes (89.1% saved) and
  the downloaded file re-opens as a valid 1-page PDF.
- Merged: `ml-runtime-foundation` — `af99d71` — shared WebGPU→WASM loader for
  transformers.js/onnxruntime-web with Cache Storage caching, download-size/progress reporting,
  `AbortSignal` cancellation and a deny-by-default permissive-licence allow-list.
- Failed: none. Blocked: none.

Checks per merge (rebase onto `origin/master`, then `npm run verify` =
`astro check` + `eslint .` + `vitest run` + `astro build`, all EXIT=0, then a Playwright smoke test
against `astro preview`): `merge-cache-headers` 270 files / 2022 tests; `qr-scanner` 271 / 2063;
`pdf-compress` 273 / 2098 (292 pages); `ml-runtime-foundation` 280 / 2145 (291 pages).

New dependencies (both lazy; neither is in the eager bundle):

- `jsqr@^1.4.0` — Apache-2.0, ~46 KB gzip — dynamically imported only when `BarcodeDetector` is
  unavailable.
- `@huggingface/transformers@^4.3.1` — Apache-2.0 — pulled in by `import()` inside `loadModel()`;
  `onnxruntime-web` (MIT) comes in transitively. `NOTICE` was updated for both.
- A build with the loader retained emits one separate 576 KB `transformers.web.*.js` chunk that no
  page requests; the `ml` barrel itself bundles to 3.4 KB with no runtime code, so importing it from a
  `*.meta.ts` stays cheap.
- `docs/TOOLS.md` and `docs/TOOLS.md.csv` regenerated: 268 tools across 18 categories. This also
  fixes pre-existing drift — the committed docs claimed 261 tools / 17 categories and were missing
  the whole `converters` category.

Incidents:

- `/tmp` runs on a tmpfs with a _per-user quota_, and this run exhausted it: `git` began failing with
  `unable to write file …`, which truncated `BACKLOG.md` to 0 bytes mid-run. Both the interrupted
  `git reset --hard` and a machine restart hit the same working tree, so the tick-off commit had to be
  re-applied from scratch on a freshly reset `origin/master`. Deleting the two finished item worktrees
  (1.4 GB) restored the quota. Worth knowing: `df` shows space free long before the quota is hit.
- A machine restart wiped `/tmp/opencode` earlier in the run and every worktree directory vanished.
  The branches survived in the repo, so all in-flight work was recovered from git and re-verified. The
  first `pdf-compress` verify reported EXIT=1 for this reason alone; re-run on a fresh worktree it is
  green.
- The `ml-runtime-foundation` sub-agent died _after_ committing, with a transient
  LLM-infrastructure error (`getaddrinfo ETIMEOUT opencode.ai`) — not an item failure. Its commit
  survived, so I verified and merged it instead of spending a failed attempt on it.
- The run's first batch (`merge-conditional-headers`, `upgrade-image-batch-2/3`, `video-foundation`)
  was lost to a push race with concurrent run `run-20261017-1202-8af9`; the control files were
  re-read and a fresh batch selected. `master` advanced five times during this run and one push was
  rejected and had to be re-applied.

Mistakes noticed:

- **`pdf-lib` ships eagerly to the whole site.** `src/tools/pdf/shared.ts` imports `pdf-lib`, and all
  12 eager `src/tools/pdf/*.meta.ts` files import _values_ (`pdfCredit`, `fflateCredit`) from it.
  Because the registry eagerly imports every `*.meta.ts`, the shared chunk grows to 963 KB raw /
  322 KB gzip and 267 of the 291 built pages load it — including pages with nothing to do with PDF
  (`/tools/yaml-to-json`, `/tools/request-id`, `/tools/x-frame-options`, …). The credit strings need
  to live in a dependency-free module so only `*.tool.ts` pulls the library.
- **Merged tools keep their old implementations.** All 19 `redirectTo` aliases still have their
  `.tool.ts` and `.core.ts` files on disk, so the build emits 19 never-loaded lazy chunks of dead
  code. A merge should delete the retired implementation instead of only flipping the meta.
- **`npm run format:check` is red repo-wide** — `prettier --check` reports 457 unformatted files,
  while `.prettierrc.json`, `.prettierignore` and the `prettier` devDependency are all committed. The
  gap is that `verify` runs `check && lint && test && build` and never runs `format:check`, so
  nothing keeps the tree formatted.
- **Legacy `.js` tools are tracked but invisible.** `src/tools/index.js`,
  `src/tools/text-summary/{index,test}.js` and `src/tools/pdf/pdf-to-image.js` are committed, are not
  `*.meta.ts`, and therefore are not in the registry, not type-checked, not linted and not tested.
  `src/tools/index.js` has no importer anywhere.
- **`FileWorkbench.astro` never renders `result.stats`.** The file-workbench run result has a `stats`
  field and `pdf-compress` populates it, but the component only renders `report` and `outputs`, so the
  numbers are silently dropped. `pdf-compress` worked around this with a `report` table.
- **The `TOOLS.md` generator is still not committed.** `scripts/gen-tools-doc.mjs` exists only as an
  untracked file in the primary checkout and `verify` never calls it, which is exactly why the
  committed docs had drifted. This run copied it in to regenerate the docs and deliberately did not
  commit it.
- **Settings still say `MAIN_BRANCH = main`.** This repo has no `main`; `origin/HEAD` points at
  `master`, and treating `main` as the main branch would push to nothing.
- **Dead runs leave branches, worktrees and claims behind** (`tool/upgrade-image-batch-2` `1167aee`,
  `tool/upgrade-image-batch-3` `149b717`, prunable worktree entries, and four abandoned `⏳` claims).
  That is what makes bare branch names collide for later runs and forced this run's suffixed branch
  names.

Ideas (new tools, not variants of anything already in the catalogue — each id checked against
`docs/TOOLS.md`):

- `parquet-inspect` — read a Parquet file's schema, row groups and per-column stats in the browser
  (`hyparquet`, MIT), plus Parquet ↔ CSV/JSON. Nothing in the catalogue touches columnar data, and
  data engineers constantly need to look inside a `.parquet` without uploading it anywhere.
- `toml-convert` — TOML ↔ JSON/YAML. The catalogue covers YAML, JSON, XML and `.env`, but there is no
  TOML tool at all, despite `Cargo.toml` and `pyproject.toml` being everywhere.
- `hex-diff` — byte-level diff of two binaries (firmware, captures, blobs) with region highlighting.
  Only `diff-text` exists today, and every binary-debugging session needs this.
- `subtitle-convert` — SRT/VTT/ASS conversion, shifting and retiming, entirely on-device; there is no
  subtitle tool in the catalogue.

## run-20261021-0200-recovery — 2026-10-21T02:00:00Z

Recovery round. The 2026-10-17 runs left the repo mid-flight: `master` was 20 commits behind
`origin/master`, four `⏳` claims were four days stale, six branches held finished work that was
never merged, and the primary checkout held 282 untracked tool files that one `git reset` away from
being lost. No orchestrator was running.

- Merged: **the uncommitted tranche** — 94 new tools rescued from the 2026-10-19 working tree onto
  `master` (`recover/uncommitted-tranche` → `1904c74`, `71e3f12`, merged as `9a22354`). It arrived
  broken and was fixed rather than pushed as-is:
  - `src/tools/text/unicode-lookup.meta.ts` had been committed **without its `.tool.ts`**, so
    `build()` in `src/lib/registry.ts` threw and took `src/lib/registry.test.ts` down with it.
    The implementation and 8 tests were written from the meta's own spec.
  - The tranche's copy of `src/lib/registry.test.ts` was an **older revision** that reverted
    `origin/master`'s alias coverage (`ALIAS_TOOLS`, `redirectTarget`) and its 120 s timeout. The
    upstream version was kept.
  - 32 `related` arrays pointed at ids that the header merges had turned into hidden aliases, so
    those links resolved to nothing. They now point at the merged replacement.
- Merged: `tool/merge-escape-tools-r432a` (`85eb2e3`) — `string-escape` absorbs backslash/json/
  unicode escape; the old ids are aliases.
- Merged: `tool/upgrade-image-batch-2` (`4979654`) and `tool/upgrade-image-batch-3` (`5903715`) —
  the image tools are now `stable`.
- Merged: `tool/video-foundation` (`14f0fc6`) — the `video` category plus a shared lazy video
  engine on Mediabunny (MPL-2.0). `mediabunny@^1.61.6` added to `package.json`/`NOTICE`.
- Merged: `tool/image-strip-metadata-r432a` (`4c3fe6b`) — lossless EXIF/GPS/XMP removal.
- Merged: `worktree-new-tool-worktree` — 7 new tools (matrix calculator, binary file signature
  inspector, CSV transpose, markdown table format, Unicode styles, whitespace visualizer). Its
  `image-resize` was dropped in favour of the `stable` version, and its `markdown-toc` was dropped
  because the rescued tranche already ships that id — the registry rejects duplicate ids.
- Fixed (from the unmerged `phase2/verification` branch): the workbench capped file selection
  (20 files / 100 MB), sanitised ZIP entry names (`../x` no longer escapes the archive, duplicates
  no longer overwrite each other), made file reads abortable, escaped filenames before they reach
  `innerHTML`, invalidated stale runs so a cancelled run cannot publish a result after a reset,
  and released preview object URLs. `tar-create` now writes the ustar `size`/`mtime` fields as
  12-byte fields with a POSIX base-256 fallback, and `calculator` rejects empty function arguments
  and non-finite results.
- Control files: `BACKLOG.md` and `TODOS.md` no longer carry a single `⏳` claim. Everything that
  landed is ticked with its merge SHA, and the four dead runs are marked `⚠️ run died`.
- Tooling: `scripts/gen-tools-doc.mjs` is committed and wired to `npm run docs:tools`; CI gained a
  "Tool docs are current" step, so the inventory cannot drift again. The whole tree is now
  Prettier-clean (671 files were not) and `npm run format:check` passes.
- Tests: the external golden-output checks from `phase2/verification` were ported — `unzip` for
  `zip-create`, `ffprobe` for `audio-to-wav`, `qpdf` and `pdfinfo` for `pdf-metadata`. They check our
  output with programs we do not control, which is the only way to catch a file we can read back
  but no other program can. Each skips itself when its reference tool is absent; CI installs the
  four so the checks actually run there.
- Merged: **two more tools rescued from the dead runs' abandoned worktrees** — `yaml-format`
  (YAML 1.2 formatter/validator, no new dependencies) and `code-beautify` (Prettier standalone with
  each parser plugin loaded lazily). `prettier` moves from devDependencies to dependencies because
  the tool ships it to the browser, and `NOTICE` records it as a runtime dependency. The text
  workbench now shows a tool's progress message while it runs, which the lazy parser loading
  needs. The remaining abandoned implementations (`code-minify`, `image-ocr`, `merge-base64`,
  `pdf-sign`, `heic-to-jpg`) were committed onto their branches and pushed, so they are preserved
  rather than lost; they need dependency, licence and review work before they can be merged.

Checks: `astro check` → 0 errors; `eslint .` → clean; `prettier --check` → clean;
`vitest run` → 395 files / 3406 tests; `astro build` → 398 pages.

Mistakes noticed:

- **`npm run test` was OOM-killed on this machine**, not logically red: every test file passed
  (389/389) but vitest reported `Worker exited unexpectedly` and exited 1, because a jsdom
  environment per file at 12 workers exceeded the 15 GB of RAM. Capping the pool
  (`maxWorkers: 6`) makes it deterministic. The earlier "main is red" note in
  `run-20261016-1001-61fc` was this same symptom seen at a smaller catalogue size.
- **The control files were the only record of what had been done**, and they were four days stale.
  Six branches (`tool/merge-escape-tools-r432a`, `tool/upgrade-image-batch-2/3`,
  `tool/video-foundation`, `tool/image-strip-metadata-r432a`, `tool/merge-cache-headers-r68f4`)
  held finished work that no control file referenced.
- **Dead branches pile up and collide on bare names.** `tool/merge-cache-headers`,
  `tool/merge-cache-headers-r68f4`, `tool/merge-conditional-headers`, `tool/pdf-compress`,
  `tool/qr-scanner-r68f4` and `tool/ml-runtime-foundation` are byte-identical patches to work
  already on `origin/master`. They should be deleted.
- **The `phase2/verification` branch is a work of its own**, not a merge candidate: it carries its
  own `docs/mission/` ledger and was written against a much older tree. Merging it wholesale would
  have reverted newer work; the security fixes were ported by hand instead.
- **`related` ids are not validated anywhere.** Pointing one at a hidden alias is silently ignored
  by `relatedTools()`, so a stale id looks fine and silently falls back to same-category tools.
  There should be a registry test for dangling `related` ids.
- **Two tools with the same purpose but different ids can both ship.** The tranche and
  `worktree-new-tool-worktree` each had a `markdown-toc`; the registry's duplicate-id check caught
  it only because the ids happened to match.

Ideas:

- `parquet-inspect`, `hex-diff` and `subtitle-convert` are still worth building (see the ideas
  list above) — `subtitle-convert` in particular is already half-built in the rescued tranche.

## run-20261020-2217-a799 — 2026-10-21T10:16:51Z

Batch of four: one merge item from `BACKLOG.md` and three tools from `TODOS.md`. Two decisions
worth a reviewer's eye: the remote has no `main` branch (`origin/HEAD` → `origin/master`), so
`master` was used as `MAIN_BRANCH`; and the three non-merge items were run **one sub-agent at a
time** rather than all four at once, because four concurrent suites on this box (load average 49)
crashed the session twice — each sub-agent committed in small steps, so no work was lost.

- Merged: `http-header-analyzer` (`1faf3a8`) — paste any header block and every line is detected
  and parsed with that header's rules; 30 long-tail header tools (`alt-used`, `early-data`,
  `trailer-header`, `priority-header`, `signature-input`, `tracestate` and 24 more) became hidden
  aliases that redirect to it, and `Content-MD5` / `Warning` are flagged as deprecated in the UI.
  The tools that do something else (request builders, curl converters, media types, cookies, the
  security-policy family) were deliberately left alone.
- Merged: `heic-to-jpg` (`dec427e`) — batch HEIC/HEIF → JPEG/PNG/WebP; the libheif WASM is served
  from this origin and loaded on demand, never from a CDN.
- Merged: `video-to-gif` (`bc08c91`) — time range, fps, width and palette quality, with the
  finished animation previewed inline before the export.
- Merged: `pdf-sign` (`75d7414`) — draw, type or upload a signature, place it on a page, flatten
  it into the PDF with pdf-lib. The reusable signature logic lives in `src/lib/signature/` so the
  later `signature-maker` item can share it.
- New dependencies: `libheif-js@1.23.5` (LGPL-3.0, ~512 kB gzip including the WASM, **lazy** —
  separate chunk, WASM served from `/vendor/libheif/` on this origin with its licence next to it)
  and `gifenc@1.0.3` (MIT, 3.6 kB gzip, **lazy** — dynamic `import()` on first use). Both are in
  `NOTICE`.
- Limitations: `heic-to-jpg` — HEVC-coded HEIC/HEIF only (AVIF is refused with a pointer to the
  image converter), output is 8-bit sRGB, no EXIF/GPS is carried over, 64 MB per file.
  `video-to-gif` — max 300 frames, audio is dropped, alpha is composited over black, GIF delays
  are centiseconds so 30 fps plays back at 33.3 fps, the preview is skipped above 4 MB.
  `pdf-sign` — one signature on one page per run, encrypted PDFs are refused, the mark is
  rasterised so it cannot be moved afterwards, typed signatures use system fonts only.
  `http-header-analyzer` — analysis only; the folded tools' "build" modes are no longer reachable
  in the UI, following the `cors-headers` / `conditional-request-headers` merge precedent.
- Mistakes noticed:
  - `scripts/gen-fixtures.mjs` built `e2e/fixtures/one-page.pdf` with the page's `/Parent`
    pointing at the **catalog** instead of the page tree. pdf-lib walks `/Parent` to read
    inherited attributes, so every page-geometry call on that fixture threw
    `Parent.ascend is not a function` — which breaks `pdf-watermark`, `pdf-page-numbers`,
    `pdf-rotate` and `pdf-sign`. The e2e suite never caught it because the fixture was only ever
    used by `pdf-metadata`. Fixed in this run (generator + regenerated fixture), and `pdf-sign`
    now reports a broken page tree in plain language.
  - Tailwind's `[hidden]` preflight rule is `:where()`-scoped in the base layer, so the HTML
    `hidden` attribute loses to `.flex`/`.btn`: the Cancel/Reset and "Download all (.zip)"
    buttons show before they should, and `showWhen` never hid an option — roughly 25 tools are
    affected. A global fix breaks `e2e/workbench-robustness.spec.ts`, so only the option wrapper
    was patched (in `heic-to-jpg`). This needs a proper fix in the base layer.
  - The heavy libraries are eagerly loaded on **every** tool page: `import.meta.glob` in
    `src/lib/worker/tool.worker.ts` is evaluated twice by Vite — once for the worker bundle and
    once for the main graph — so ~1.2 MB raw / ~400 kB gzip (including a full copy of `pdf-lib`)
    lands in the page chunk of every tool. `import ToolWorker from './tool.worker.ts?worker'` in
    `src/lib/worker/client.ts` would keep it out of the main graph.
  - `dist/_astro/pdf.worker.min.mjs` is emitted twice under two names (1.37 MB each).
  - `src/lib/worker/client.ts` terminates the worker on abort, so a `blob:` URL minted inside a
    worker dies with it; `video-to-gif` had to use data URLs for its preview.
  - `src/lib/video/index.ts` never emits a "loading the video engine" progress message, so the
    worker shows a bare bar while the ~180 kB engine chunk loads.
  - `src/components/workbench/shared.ts` `readOptions` turns a cleared number field into
    `Number('')` → `0`, so an empty numeric option silently means zero.
  - `related` ids are still not validated: twelve visible tools point at the `string-escape`
    aliases (`json-escape`, `unicode-escape`, `backslash-escape`) and those links are silently
    dropped. A registry test for dangling `related` ids would catch this class of mistake.
  - The old `priority-header` tool reported `u=0` as "not set", because `'0'` is falsy; the new
    analyzer parses it correctly.
  - `e2e/privacy.spec.ts` hardcodes `http://localhost:4321` instead of using `baseURL`, so it
    fails on any other port.
  - Four pre-existing tools fail `e2e/smoke.spec.ts` ("every tool page renders a working
    workbench"): `csv-sanitize`, `jsonpath`, `rsa-encrypt-decrypt` and
    `x509-certificate-inspector` — their examples raise an error instead of producing a result.
  - `npm run docs:check` is a CI step, but `docs/TOOLS.md` is only ever regenerated by hand, so
    every run that adds a tool leaves CI red until someone runs `npm run docs:tools`. (Regenerated
    in this run: 376 tools across 19 categories.)
- Ideas:
  - A shared **batch-runner panel**: pick N files once, run them through the same tool, get one
    progress table and one zip. Half the catalogue now has a batch mode, each re-implemented from
    scratch, and the duplication is growing every round.
  - An **HTML accessibility audit** for a whole pasted page — contrast, `alt` text, heading order,
    form labels, landmark structure — as a linter rather than the single-purpose checks that
    exist today.
  - **Burn subtitles into a video** (SRT/VTT → hardcoded or soft): `subtitle-converter` changes
    the text file, but nothing can put the subtitles on the picture.
  - A **font inspector** for WOFF2/WOFF — coverage, variation axes, unicode ranges, licence bits
    — since nothing in the catalogue touches fonts at all.

## run-20261023-2148-a5dd — 2026-10-24T03:12:09Z

- Merged: `image-watermark` (`3110270`) — text or logo watermark on one or many images: opacity, 9
  positions with margin, or tiled at any angle, plus a live preview panel; batch mode, PNG/JPEG/WebP
  output. Verified in a browser as a batch of two (76% of the changed pixels sat in the configured
  quadrant, tiled mode covered all four quadrants, logo mode landed at exactly 40% width with the 4%
  margin).
- Merged: `image-add-text` (`906dd6a`) — caption/meme text on an image: system font stacks, size,
  colour, alignment, outline, shadow, uppercase, wrapping, opacity, drag or arrow-key placement in a
  panel. Dragged text landed at 28.7%/74.3% against a requested 28.68%/75%, with white glyph pixels
  where expected.
- Merged: `image-blur-redact` (`8cb89f1`) — draw rectangles, then blur, pixelate or black them out;
  per-region effect, generated report table, re-encode drops EXIF/GPS/XMP/IPTC/ICC/comments. Verified:
  0 non-black pixels inside a blacked-out region, 0 changed pixels outside it, and pixelation cut the
  unique colours in the region from 35,536 to 560.
- Merged: `pdf-protect` (`777c090`) — password protection with AES-256 via qpdf wasm plus print /
  copy / modify permissions. Verified with the system `qpdf` CLI: `R = 6`, all three encryption
  methods `AESv3`, the requested permissions recorded, decrypt with the password succeeds, without it
  fails with "invalid password" (exit 2), and a password containing quotes, a backslash and an emoji
  round-trips byte-for-byte.
- Failed: none.
- Blocked: none.
- New dependencies: `@jspawn/qpdf-wasm@0.0.2` (Apache-2.0; `qpdf.wasm` 1,274,647 B ≈ 422 KB gzip +
  52,796 B ≈ 18.9 KB gzip glue, **lazy** — dynamic `import()` inside the tool worker, fetched on the
  first run only: a page load makes 9 requests with no wasm, the first run fetches the engine chunk
  and the wasm from this origin). The package named in the ticket, `qpdf-wasm@0.1.0`, cannot work
  here: it is a pthread build that pre-spawns one worker per core and needs `SharedArrayBuffer`, i.e.
  cross-origin isolation, which a static site cannot provide without COOP/COEP headers. Both are
  Apache-2.0; the replacement is documented in `pdf-protect.qpdf.ts`, `NOTICE` and the report below.
- Limitations: `image-watermark` — a logo is rasterised to a PNG data URL capped at 1024 px on its
  long edge, an SVG passed to `run()` by hand fails in Chromium's `createImageBitmap` (the panel
  always converts), tiling is capped at 20,000 marks. `image-add-text` — the preview canvas is capped
  at 2 MP (same geometry, sub-pixel wrap differences only), line height is fixed at 1.2×, system
  fonts only. `image-blur-redact` — the effect is per region but radius/cell size/opacity are global,
  blur is clamped to the rectangle, alpha is blurred along with RGB, regions are 1%-granular in the
  UI. `pdf-protect` — blocking extraction keeps accessibility extraction allowed, permission
  granularity is print/copy/modify only, the wasm cannot be driven under vitest/jsdom (the golden
  test uses the system CLI instead), and `dist` contains the wasm twice (client + worker graphs);
  only the worker copy is ever fetched.
- Process notes (decisions taken without a human, for review): the settings say `MAIN_BRANCH = main`
  but this repo's main branch is `master` — I used `master`. No `BACKLOG.md` item was claimable
  (`merge-base64` already carried two ⚠️, `merge-datauri` is held by a live run), so the batch came
  from the top of `TODOS.md`; the batch is `image-watermark`, `image-add-text`, `image-blur-redact`,
  `pdf-protect` (no merge items, no shared existing tool, no intra-batch dependency). The stale
  claims on `screen-recorder`, `markdown-preview`, `gst-calculator` and `sip-calculator` were
  rewritten to `⚠️ run died`, which puts each at the two-attempt limit — they are now blocked and
  need a human to decide whether to retry. `image-ocr`, `webcam-recorder`, `pdf-organize` and
  `merge-datauri` each carry a dead run's ⏳ next to a live run's ⏳; I left those lines alone.
  Dubious-looking but left alone: `code-minify` and `merge-base64` sit at two ⚠️ without a ⛔.
- Mistakes noticed:
  - **Panel tools and `data-file-workbench`.** `FileWorkbench.astro:152-176` binds the generic
    workbench behaviour to _every_ `[data-file-workbench]` root and skips only the hardcoded
    `data-signature-workbench`, dereferencing `[data-report]`, `[data-download-all]` and friends with
    `!`. Any custom panel that carries the marker therefore gets a second drop zone and a second Run
    handler and throws as soon as the generic code touches a node the panel does not have. My three
    panels dropped the marker; `8cf4580` (a human fix that landed mid-run) wraps panels in
    `[data-panel-workbench]` and widens the sweep, which is what makes that safe. `SignatureWorkbench`'s
    "the shared e2e checks look for it" comment is now stale, and a generic "this root is owned by a
    panel" skip would be better than the signature special case.
  - **The shared volume hit 100% during this run** (1.7 GB free at the start, 300 MB at the worst
    point). One agent, trying to unblock its own build, deleted other runs' `dist` directories —
    including a live run's — and my own scratch directory `/tmp/smoke` was wiped by something outside
    this run and had to be rebuilt mid-flight. Four parallel runs each installing a ~1 GB
    `node_modules` is the cause; the next round needs a plan for it (one shared install, a hardlink
    recipe, or a documented `--outDir` outside the volume).
  - **Hardlinked `node_modules` and a merged dependency.** Because every worktree shares one
    hardlinked `node_modules`, merging `pdf-protect` (which adds a package) breaks `check`, `test`
    and `build` in every sibling worktree: `registry.test.ts` and the build failed in `image-add-text`
    with "Rollup failed to resolve import @jspawn/qpdf-wasm/qpdf.wasm?url" until the package was
    copied into that worktree. Not a code fault, but it will bite every run that adds a dependency.
  - Pre-existing and still failing the sweep: `jsonpath` ("JSONPath Extractor") — its first example
    raises instead of producing a result, so `e2e/smoke.spec.ts` aborts there; the other three
    known breakages (`csv-sanitize`, `rsa-encrypt-decrypt`, `x509-certificate-inspector`) were not
    reached. All four new tool pages pass the same criteria (correct `<h1>`, a workbench marker —
    `data-panel-workbench` for the three panels, the file workbench for `pdf-protect`).
  - `src/components/workbench/shared.ts:imageToPngBlob()` awaits `image.decode()`, which never
    settles in the repo's Chromium (reproduced: `onload` fires and `createImageBitmap` resolves, but
    `decode()` hangs) — so an SVG result's "Download PNG" can hang silently. `createImageBitmap`
    (what `image-batch.ts` uses) is the safe path.
  - `imageToPngBlob` is also module-private, so `image-watermark` duplicated ~15 lines of it for
    logo rasterisation — exporting it would remove a copy-paste magnet across panels.
  - `pdf-to-images` is the only PDF tool without a `.test.ts` (its `.js` helper is uncovered too).
  - `src/tools/pdf/shared.ts` `output()` copies the whole output buffer (`copy.set(bytes)`) only to
    satisfy `ArrayBufferLike`/`BlobPart` typing; typing the source as `Uint8Array<ArrayBuffer>`
    removes an avoidable full copy of every large output.
  - The Tailwind `[hidden]`-vs-`.btn` bug from the last report is still live and shows on the new
    panels: the Cancel and Reset buttons are visible before they should be.
- Ideas:
  - A shared **image-annotator panel kernel** — a canvas stage with draggable/resizable regions that
    mirror into percentage option values. Three tools in this run (`image-watermark`'s logo
    placement, `image-add-text`'s drag-to-position, `image-blur-redact`'s region boxes) each built
    one from scratch, and the catalogue lists more (`image-collage`, `pdf-organize`,
    `image-watermark` on video, `pdf-redact`).
  - `pdf-unlock` and `pdf-fill-form` should reuse this run's qpdf engine (`pdf-protect.qpdf.ts`):
    the wasm is already vendored and lazy, and "remove a password the user knows" is the same
    `qpdf --decrypt` call the golden tests already exercise.
  - A **batch-runner panel**, still unbuilt from the last report: pick N files once, run them through
    the same tool, get one progress table and one zip.
  - `FileWorkbench` should skip any root that declares itself panel-owned (e.g. a
    `data-workbench-owned` attribute) instead of the hardcoded `data-signature-workbench` check, and
    `workbench/shared.ts` should export `imageToPngBlob`.

## run-20261023-2031-a3f2 — 2026-10-24T10:35:00Z

- Merged: merge-datauri (0b2222e) — `data-uri` gains four modes (text/image × encode/decode); `image-to-datauri` and `datauri-to-image` stay routable as redirect aliases; deprecated `unescape`/`escape` path replaced with TextEncoder/TextDecoder.
- Merged: image-ocr (8784cc2) — tesseract.js OCR with 10 self-hosted languages (all traineddata vendored under `/vendor/tesseract/`, no third-party fetch); lazy dynamic import; text report + per-image .txt download.
- Merged: webcam-recorder (f6cb8ad) — getUserMedia + MediaRecorder recorder panel; VP9→VP8→WebM→MP4 mime fallback; resolution + mic options; camera device picker; shared mockable `webcam-recorder-core` ready for screen-recorder reuse.
- Merged: pdf-organize (a0f7e7e) — reorder/rotate/delete/insert-blank-page planner with thumbnail grid panel; pure core in `pdf-organize.core.ts` (84 tests).
- New dependencies: tesseract.js@^7.0.0 (Apache-2.0, ~5.4 KB gzipped wrapper, lazy dynamic import); @tesseract.js-data/{eng,deu,fra,spa,hin,chi_sim,ita,nld,por,rus}@^1.0.0 (models Apache-2.0, npm packages MIT; 0.9–1.7 MB each, vendored static assets served from this origin, fetched only when a language is first used).
- Limitations:
  - image-ocr — LSTM "best int" models only (no legacy engine data); first use of a language downloads its model from this origin (~1–2 MB).
  - webcam-recorder — device labels are blank until permission is granted (browser behaviour); resolution uses ideal constraints, so a fixed-720p camera stays 720p; WebM playback lacks header duration (seek workaround in the player).
  - pdf-organize — a source page cannot appear twice in one plan (friendly ToolError); rotation adds to the page's existing /Rotate; blank pages are Letter/A4 only.
  - data-uri — `image-decode` returns the decoded file without an inline image preview (same as the old tool); alias pages are static meta-refresh redirects.
  - e2e specs for image-ocr/webcam-recorder were authored but not executed in this run (browser-run out of scope of the green gates); unit + build + a manual Playwright-driven smoke pass on each tool page were done instead.
- Mistakes noticed:
  - `FileWorkbench`'s generic script attached to panel-owned roots that reuse the `data-file-workbench` marker: on `/tools/data-uri` both handlers bound to the same Run button and the generic one crashed (`TypeError: reading 'length' of undefined`) before the panel's handler could run. Fixed by skipping roots without a `[data-download-all]` button (merge-datauri branch). The hardcoded guard list (`data-signature-workbench`, now download-all) keeps growing — a `data-workbench-owned` attribute convention would stop this recurring for the next panel.
  - `data-uri.tool.ts` and `proxy-authorization.tool.ts` use deprecated `unescape()` (TS 6387 hints on master); the data-uri merge fixed its own path, `proxy-authorization` still needs it.
  - An earlier dead run's `image-ocr` branch shipped a `^[a-z]{3}$` language-code regex that rejects every region-suffixed tesseract code (`chi_sim`); fixed in the rebase.
  - `pdf-to-images.tool.ts` sets `GlobalWorkerOptions.workerSrc` at module top level unconditionally — importing that module outside a browser crashes (pdf-extract-text guards this correctly); worth a cleanup.
  - `pdf/shared.ts loadPdfBytes` reports every load failure (including empty files) as "not a valid PDF" — acceptable but could distinguish empty input.
  - The Tailwind `[hidden]`-vs-`.btn` visibility bug from the previous report is still live on the new panels (Cancel/Reset visible before they should be).
- Ideas:
  - `screen-recorder` should reuse `webcam-recorder-core` (`startRecording` already takes an injected recorder factory; only the `getDisplayMedia` source differs).
  - The image-annotator panel kernel idea from the previous report gains another consumer: `pdf-organize`'s thumbnail grid and `image-blur-redact` both needed draggable-region canvases this round.
  - `pdf-unlock`/`pdf-fill-form` can reuse the vendored qpdf wasm from `pdf-protect` (same engine, `--decrypt` path).
  - `image-ocr` + `pdf-ocr` (after: image-ocr) can now share the vendored tesseract stack as-is; no extra vendoring needed for pdf-ocr.

## run-20261023-2024-f777 — 2026-10-24T09:00:00Z

Batch: `keyboard-tester`, `video-trim`, `video-extract-audio`, `video-convert` (claimed as `9ba63e6`). No merge
items, no new dependencies anywhere. All four were smoke-tested in a real browser against a real VP8+Opus
fixture, all four merges verified with the full `verify` gate (check + lint + vitest + build) after each rebase.

- Merged: `keyboard-tester` (`c25e5c6`) — on-screen US-QWERTY layout that lights up per key, key/code/char/
  modifier readout, and a rollover/ghosting test with presets and a custom-combination parser. Verified live:
  single key lights the right key, a 4-key chord registers 4 keys, a Shift+A+S+D challenge reports PASS with a
  report table; zero console errors.
- Merged: `video-trim` (`abf7188` + race fix `138c2bf`) — scrubber panel with draggable/keyboard-operable
  handles, stream copy when the cut allows it and re-encode otherwise. Verified live: a 6 s VP8+Opus fixture
  trimmed from 0:02 produced a valid 4.02 s WebM (ffprobe-confirmed) via the re-encode path.
- Merged: `video-extract-audio` (`a9067f7`) — WAV (self-written 16-bit PCM), MP3 and AAC via the browser's
  WebCodecs audio encoder with an explicit "your browser lacks this encoder" message. Verified live: the fixture
  extracted to a valid 6.01 s 48 kHz mono PCM WAV (ffprobe-confirmed); zero console errors.
- Merged: `video-convert` (`5936034`) — MP4/WebM/MOV/MKV with a remux-first decision matrix and honest
  remux-vs-transcode reporting. Verified live: webm→mp4 transcoded to a valid h264+opus MP4 (ffprobe-confirmed).
- Failed: none. Blocked: none.
- New dependencies: none.
- Limitations: `video-trim` — stream copy can only cut on keyframes; input capped at 2 GiB (output buffered in
  memory). `video-extract-audio` — MP3/AAC depend on the browser's WebCodecs audio encoder (Firefox has
  neither; the tool says so instead of silently substituting); primary audio track only; WAV is 16-bit PCM.
  `video-convert` — transcode keeps the source bitrate (presets are video-compress's job); primary tracks only;
  output capped at 512 MB. `keyboard-tester` — numpad/media keys show in the readout but light nothing;
  browser-reserved chords (Ctrl+T/W/N) are untestable and the FAQ says so.
- Mistakes noticed:
  - **A panel root with `data-text-workbench` kills the whole page.** The keyboard-tester panel shipped with a
    stray `data-text-workbench` attribute on its root section. The shared TextWorkbench script matches that
    attribute, assumes a `[data-run]` button exists, and throws `Cannot read properties of null (reading
'addEventListener')` in the hoisted module — which also prevents the panel's own lazy script from mounting.
    The page was dead on arrival (fixed in this run by removing the attribute; the e2e workbench sweep only
    needs `[data-panel-workbench]`). Any future panel copying a workbench root's attributes will hit this again;
    the TextWorkbench script should guard its required elements.
  - **`mediabunny`'s `AudioBufferSink` cannot be used in a worker.** Its buffers call `sample.toAudioBuffer()`,
    which constructs `new AudioBuffer(...)` — a Web Audio DOM object that does not exist in a worker global
    scope. `video-extract-audio` shipped with it and failed with `AudioBuffer is not defined` in the real
    worker; fixed by reading planar f32 directly off `AudioSample`s (`allocationSize`/`copyTo`/`close`).
    Anything else that decodes audio inside the generic tool worker must use `AudioSampleSink`.
  - **Panel pages can race their own preview.** If a video's `loadedmetadata` fires before the lazily imported
    panel module attaches its listener, the panel never learns the clip length and the run button stays
    disabled. Fixed in `video-trim` by re-checking `videoEl.readyState >= 1` after mount; other media panels
    (camera, mic, screen recorder) should do the same for their metadata events.
  - **Two items that master had already absorbed were still unticked with stale ⏳ claims** (`code-minify`
    `5c6b600`, `video-compress` `819c44d`), and run-20261023-2100-7541 then burned them with a second `⚠️ run
died` apiece (`code-minify` is genuinely shipped; `merge-base64` likewise, `af1467a` — master's `base64`
    gained the file mode and `base64-file` is already a routable alias). Those three lines now read "failed
    twice" even though nothing failed and nothing needs doing; the human should tick them in the next review.
  - **`docs/TOOLS.md` on origin/master was stale again** (claimed 404 tools; 389 exist — it lists 5 tools whose
    metas were never committed, e.g. `id3-tag-reader`, `gpx-track-stats`). Regenerated here: 389 tools. Anything
    that lands metas without committing the doc will keep tripping CI's doc-check.
  - **Disk pressure is the recurring killer of runs on this machine.** This run started with the volume at 99%
    (1.5 GB free) purely because four dead runs from 2026-10-21 had left 7.5 GB of worktrees behind. They were
    pruned (committed-but-unmerged work was first rescued to `rescue/*-w777` branches and
    `origin/tool/*` branches; `markdown-preview`, `keyboard-tester` and `video-trim` uncommitted work was
    pushed to `rescue/markdown-preview-w777`, `rescue/keyboard-tester-w777`, `rescue/video-trim-w777`).
- Ideas:
  - `audio-info`-style probe reports already exist; a shared **media-probe panel** (drag any media file →
    ffprobe-like table: containers, codecs, bitrates, durations) would replace the per-tool "Property/Value"
    tables four video tools now each render, and would make `video-convert`/`video-trim` input diagnosis
    trivial.
  - `subtitle-converter` exists, but nothing converts audio→text; `speech-to-text` (already in TODOS) plus the
    now-proven worker-safe audio decode path (AudioSampleSink) makes the audio half of that tool mostly plumbing.

## round-2026-10-25-complete-2 — 2026-10-25T07:00:00Z

Round theme: **finish the project properly and make it findable.** Ran on branch `round/complete-2` in
`.conductor/worktrees/complete-2`, deliberately isolated from the primary checkout because a second omp session
was writing tools there concurrently (its ~20 untracked tools were rescued into this branch by name).

- Merged: the whole in-flight tail — `master-int-f777` (video-convert, video-extract-audio, video-trim panel fix),
  `tool/background-remover`, `tool/screen-recorder`, `tool/mic-test`, `tool/markdown-preview`, `tool/webcam-test`,
  `tool/gst-calculator`, `tool/sip-calculator`. The remaining `tool/*` branches were confirmed dead duplicates of
  work already on master.
- Landed: **20 tools that existed only as untracked files** in the primary checkout (id3-tag-reader, csr-decoder,
  geojson-validator, gpx-track-stats, mbox-archive-analyzer, plist-decoder, font-inspector, ieee754-inspector,
  systemd-unit-inspector, cbor-decoder, significant-figures, email-header-analyzer, iptables-ruleset-auditor,
  ssh-config-auditor, sudoers-auditor, svg-sanitizer, text-similarity, access-log-analyzer, feed-inspector,
  webcam-test).
- Built: **38 new tools** — stopwatch, countdown-timer, pomodoro-timer, typing-test, fancy-text, speaker-test,
  dead-pixel-test, online-notepad, html-playground, file-encrypt, text-to-speech, voice-recorder, image-filters,
  image-collage, signature-maker, invoice-generator, gif-maker, video-frames, speech-to-text, sqlite-viewer,
  spreadsheet-viewer, bcrypt, pgp-tool, tuner, spectrogram, bpm-detector, image-upscale, audio-convert,
  noise-reduction, pdf-unlock, pdf-fill-form, pdf-redact, pdf-ocr, calculator (scientific keypad), code-to-image,
  mermaid-renderer, text-stats (platform limits + readability). Catalogue: **378 → 449 tools, 19 → 20 categories**.
- Fixed (board items): **T005** — the 45 dead alias implementations are gone and `registry.ts` no longer requires a
  `.tool.ts` for a `redirectTo` meta, with a test guarding the invariant. **T006** — `FileWorkbench` renders
  `stats` escaped, the axe sweep owns a page-scaled timeout instead of blowing the default, `e2e/privacy.spec.ts`
  uses `baseURL`, WebKit registers only when installed, and `verify` now runs `format:check`, `bundle:check` and
  `test:e2e`. **T008** — `src/lib/related-tools.test.ts` gates dangling/hidden/duplicate `related` ids.
  **T003** — the twelve examples that threw on click are repaired with per-example regression tests.
  **T004** — the credit strings moved out of `src/tools/pdf/shared.ts` so pdf-lib leaves the eager graph
  (measured by the new `scripts/check-bundle.mjs`).
- SEO/AEO: every one of the 449 tool pages now carries unique editorial content — an `article` (3–5 headed
  sections), ≥3 `examples` and ≥3 `faq` — enforced by `src/lib/contract.test.ts`. Added `/llms.txt`,
  `/llms-full.txt`, an enriched `/tools-index.json`, `WebSite`/`Organization`/`ItemList`/`HowTo` JSON-LD,
  per-tool Open Graph cards (`scripts/gen-og.mjs`, 353 PNGs), explicit AI-crawler rules in `robots.txt`,
  `<lastmod>` in the sitemap, a `/guides` section with four evergreen guides, and base-path-aware links
  everywhere so the canonical URL is a one-line change.
- Infrastructure: `astro.config.mjs` takes `SITE_URL` + `BASE_PATH` from the environment, a GitHub Pages deploy
  workflow publishes on push to `master`, and `docs/LAUNCH.md` + `docs/RUNBOOK.md` cover indexing, rollback and
  incident response.
- Checks: `astro check` 0 errors; `eslint` clean; `prettier --check` clean after formatting 35 files; `vitest`
  **6389 passed / 0 failed**; `astro build` 481 pages; `docs:check` clean; `bundle:check` reported the eager
  chunk defect before the fix and is the acceptance test for it.
- Mistakes found and worth knowing:
  - **The file tools' relative paths resolve against the session CWD, not the worktree.** Several agents wrote
    into the primary checkout before the hazard was broadcast; every stray was rescued into the worktree and the
    primary checkout was restored to its own session's state. Write absolute paths in every subagent brief.
  - **`git stash` in a shared worktree is destructive.** One agent used it while siblings were editing; nothing
    was lost, but a stash-and-drop can silently revert a peer's uncommitted work.
  - **`pgp-tool.tool.ts` imported `openpgp` at module scope**, which threw under jsdom and took the whole
    registry test down. The tool's own doc comment said it was lazy. Heavy libraries must be imported inside
    `run()`.
  - **A haiku-tier agent printed its tool calls as text instead of making them** — mechanical batches via `sonic`
    need a file-existence check afterwards.
  - **Agents report completion while their work is incomplete** (truncated transcripts, "Done" with the file
    unwritten). Every agent's output was verified against the filesystem before its work was trusted.
- Ideas: `scripts/check-bundle.mjs` should also assert per-tool lazy-chunk budgets; the `/guides` section has
  room for a "privacy model" page that the AI answer engines can quote; `pdf-to-word` and `word-to-pdf` were the
  two highest-demand gaps the demand research found and remain unbuilt.

### round-2026-10-25-complete-2 — outcome (2026-10-26T22:45Z)

Deployed to production at https://hemanthdamineni.github.io/browser-tools-platform/ (GitHub Pages,
workflow build). The final sitemap sweep returned **423/423 URLs → 200**, including every tool
page, category, and guide. The two post-deploy defects found in the live smoke were fixed and
re-deployed: canonical/sitemap URLs missing the project-site base path, and sitemap URLs that
redirected to a trailing slash.

Final board state: T003 ✅ (twelve broken example payloads repaired with per-example regression
tests), T004 ✅ (eager entry chunk 711 → 27.2 KB gzip: pdf-lib out of the eager graph, editorial
prose split into build-time content modules, client loads tools via a lazy glob), T005 ✅,
T006 ✅, T008 ✅. Gates on the merged master: astro check 0 errors, eslint clean, prettier clean,
**6452 unit tests green**, **47 e2e green** (chromium + firefox), bundle:check PASS, docs:check
current. `docs/SEARCH-INDEXING.md` hands the Search Console / Bing / IndexNow steps to the owner.

## run-20261028-1622-f1a7 — 2026-10-28T16:22:26Z

- Merged: the pending tool batch (`041bfa8`) — 51 tools from `TODOS.md` plus four inspectors
  (`compressed-file-inspector`, `elf-binary-inspector`, `pdf-structure-inspector`, `border-radius`).
  Every tool has a meta/tool pair, a real implementation, and focused tests; the catalogue is now
  456 tools across 20 categories.
- Merged: every hidden alias module restored as a callable forwarding wrapper (`base64-file`,
  the 30 long-tail header ids, the CORS/cache/conditional families, data-URI and escape ids).
  The registry alias tests pass and no alias is a meta-only shell.
- Merged: panel workflows. Screen recorder, webcam test, mic test, voice recorder, speech-to-text,
  text-to-speech, video frames, PDF OCR/redaction, signature maker and the new image/audio/device
  panels now invoke `runToolById` with progress, pause/cancel, downloads, and stream/object-URL
  cleanup. No `/api` placeholder or console.log-only panel remains.
- Merged: contract repair. FAQ copy moved out of `ToolMeta` into `*.content.ts`; `range.max` became
  optional and renders as a numeric field when absent; invalid `input: 'none'` values became `text`;
  new-tool summaries were trimmed to the 120-character limit.
- Fixed in this round: `video-frames` disposed its Mediabunny source before awaiting extraction, so
  every real run failed with "Input has been disposed" — now verified in Chromium (4 PNGs from a
  3-second clip). Typed signature SVG emitted `font-family=""…""`, so PNG export could not decode;
  it now rasterises to a real RGBA PNG. The GST tool asserted a 2025–2026 slab restructure and
  notification numbers that could not be verified; it now reflects the CBIC schedule actually
  checked (5/12/18/28 plus the special slabs) and accepts any custom rate.
- Limits: removed the hard byte/pixel ceilings introduced by this batch. Large inputs are processed;
  speech-to-text reports a warning in the result instead of refusing the file. Browser-mandated
  canvas limits remain, because a canvas cannot represent anything beyond them.
- Checks: `npm run check` → 0 errors; `eslint src --max-warnings=0` → clean; `npm test` → 482 files /
  6,556 tests; `npm run build` → 488 pages; `npm run docs:check` → clean after regenerating
  `docs/TOOLS.md` at 456 tools. Browser smoke: video frames, signature PNG, bcrypt hash, GST table.
- Mistakes noticed and fixed: alias `.tool.ts` files had been generated as `{ meta }` shells;
  PDF OCR/redaction panels called a nonexistent `/api`; `calculator.astro` contained a literal
  `<script>` inside a comment, which broke Astro's dev dependency scan; `image-filters` linked to
  a nonexistent `image-adjust` id; two new inspectors lacked the required three FAQ entries.
- Ideas: none new; the existing batch-runner and image-annotator kernel suggestions still stand.
