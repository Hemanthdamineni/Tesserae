# Toolbench — Implementation Backlog & Spec

> **This file is the single source of truth for building out Toolbench.**
> It is written to be executed by an automated coding model with **no additional
> context**. Every remaining task carries enough detail (exact IDs, option keys,
> algorithms, expected test values, libraries) that you should **never have to
> guess or invent an approach**. If something is genuinely ambiguous, prefer the
> most conservative, standards-compliant behaviour and add a `faq` entry noting
> the choice — do **not** silently change architecture, file layout, the tool
> contract, dependencies, or naming.

---

## 0. HOW TO USE THIS FILE

1. Read **§1 Project Context**, **§2 The Tool Contract**, **§3 Design System**,
   **§4 Definition of Done** once, fully, before writing any code.
2. Pick the lowest-numbered **unchecked** task in **§8 Backlog**. Do tasks in
   order within a story unless a task says otherwise.
3. Each tool task points to a detailed spec in **§9 Tool Spec Appendix**. Build
   exactly that spec.
4. Run the **verification gate** (§1.5) after every task. A task is done only
   when the gate is fully green. Then tick its checkbox in this file and commit.
5. One commit per story (or per 3–5 tools), message `feat(tools): <story> — <ids>`.
6. Never mark a checkbox done unless you personally ran the gate and it passed.
7. If you add a new npm dependency you were not told to add: **stop**. Adding
   deps is out of scope unless a task explicitly lists the package.

### Rules that override everything else

- **Do not edit** `src/lib/**`, `src/components/**`, `src/pages/**`,
  `astro.config.mjs`, `package.json`, `tsconfig.json`, `eslint.config.js`, or any
  existing tool — **unless a task explicitly tells you to and names the file**.
  Foundation-change tasks (Epic E2) are the only place those files change, and
  they spell out the exact edit.
- **Do not delete or rename** any existing file.
- **Do not change** a shipped tool's `meta.id` — it is a public URL.
- **Do not introduce a backend, an API call, telemetry, analytics, cookies, web
  fonts, or any external network request.** Toolbench is 100% static and
  on-device. A tool that cannot be done client-side is marked _deferred_ — do not
  fake it.
- **Do not "improve" the design system, colours, or component API** as a
  side-effect of a tool task.

---

## 1. PROJECT CONTEXT

### 1.1 What Toolbench is

A large static website of **privacy-first browser utilities**: encoders, hashers,
formatters, converters, generators, and file tools (image / PDF / archive /
audio). Every tool runs **entirely in the user's browser tab**. There is no
server. The site is a PWA and installs as an app on Windows, macOS, Linux,
Android and iOS, and works fully offline once loaded.

Product goals: genuinely useful (not toy demos), fast, reliable, accessible
(WCAG 2.1 AA), mobile-first, maintainable, and able to grow to hundreds of tools
without the codebase rotting.

### 1.2 Non-negotiable principles

| Principle        | What it means in code                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| On-device only   | `run()` never calls `fetch`, `XMLHttpRequest`, `WebSocket`, or loads a remote URL.                                                     |
| Honest privacy   | `meta.privacy.network` is `'none'` for every tool here. An e2e test fails the build if a tool page makes a cross-origin request.       |
| Lightweight core | Each tool's code is a lazily-imported module. Heavy libs (`pdf-lib`, `pdfjs-dist`, `fflate`, `marked`) load only when their tool runs. |
| Pure logic       | `run()` is a pure function of its input. No DOM, no globals mutation. This makes it unit-testable and worker-portable.                 |
| Accessible       | Every control labelled; keyboard operable; visible focus; `prefers-reduced-motion` respected; no colour-only signalling.               |
| No surprises     | Errors are friendly `ToolError`s with a hint. Output is never rendered as raw HTML.                                                    |

### 1.3 Tech stack & versions (do not change)

- **Astro 4.16** (`output: 'static'`), TypeScript **strict** + `noUncheckedIndexedAccess`.
- **Tailwind CSS 3.4** via `@astrojs/tailwind`. Design tokens are CSS custom
  properties in `src/styles/global.css` (see §3).
- Interactivity: **hand-written vanilla TS** inside Astro `<script>` islands. No
  React/Vue/Svelte. No client framework runtime is shipped.
- Heavy work runs in a generic **Web Worker** (`src/lib/worker/tool.worker.ts`).
- Tests: **Vitest** (unit, `jsdom` env) + **Playwright** (e2e: a11y with
  `axe-core`, smoke, and the "no network egress" privacy assertion).
- Node **20+**.
- **Allowed runtime npm packages** (already installed — import normally):
  `yaml` (ISC), `diff` (BSD-3), `marked` (MIT), `cronstrue` (MIT),
  `qrcode-generator` (MIT), `fflate` (MIT), `pdf-lib` (MIT), `pdfjs-dist`
  (Apache-2.0). **No others may be imported.** Everything else you implement in
  pure JS/TS inside the tool file.

### 1.4 Repository layout

```
src/
  lib/
    types.ts        Tool contract: ToolMeta, ToolModule, TextRunResult, render kinds, ToolError
    registry.ts     Auto-discovers src/tools/**/<id>.{meta,tool}.ts via import.meta.glob
    categories.ts   The 18 category definitions (id, name, blurb, icon, order)
    options.ts      resolveOptions(meta, values) — merges caller values over declared defaults
    format.ts       formatBytes, formatNumber, formatDuration, clamp, pluralize, slugify, escapeHtml
    files.ts        readAsText/ArrayBuffer/DataURL, downloadBlob, downloadZip, createDropZone
    clipboard.ts    copyText / readClipboardText (with legacy fallback)
    capabilities.ts SSR-safe feature detection (webCrypto, workers, offscreenCanvas, webAudio, ...)
    seo.ts          softwareAppJsonLd / faqJsonLd / breadcrumbJsonLd
    site.ts         Branding + nav. Rename the product here only.
    worker/
      tool.worker.ts  Generic worker: message {id,toolId,payload} -> lazy import <toolId>.tool.ts -> run()
      client.ts       runTool / runToolById, worker lifecycle, AbortSignal handling
  components/
    Layout.astro BaseHead.astro Header.astro Footer.astro SearchDialog.astro ThemeToggle.astro Icon.astro
    ToolPage.astro        Per-tool page chrome (breadcrumb, title, PrivacyBadge, FAQ, "how it works", related)
    PrivacyBadge.astro    Rendered from meta.privacy — never hard-coded
    ToolCard.astro CategoryCard.astro
    workbench/
      TextWorkbench.astro   Generic text-in -> text/rich-out UI (used when meta.input === 'text')
      FileWorkbench.astro   Generic drag/drop file-in -> file-out UI (used when meta.input === 'file')
      OptionsFields.astro   Renders meta.options[] into an accessible form
      shared.ts             readOptions, applyShowWhen, bindRangeOutputs, showError, renderTextResult
  pages/
    index.astro  tools/index.astro  tools/[tool].astro  categories/index.astro  categories/[category].astro
    privacy.astro about.astro offline.astro 404.astro
    sitemap.xml.ts robots.txt.ts manifest.webmanifest.ts opensearch.xml.ts tools-index.json.ts
  tools/<category>/<id>.{meta,tool,test}.ts     <-- YOU ADD FILES ONLY HERE
  styles/global.css
public/
  sw.js  favicon.svg  favicon.ico  icons/*  og.png  _headers
scripts/gen-icons.mjs        Deterministic PNG/ICO icon generation (Node zlib only)
docs/
  ADDING-A-TOOL.md  ARCHITECTURE.md  DEPLOYMENT.md  ROADMAP.md
e2e/  smoke.spec.ts  privacy.spec.ts
```

### 1.5 Verification gate (run after every task)

```bash
npm run check      # astro check — MUST report 0 errors (2 pre-existing "hints" are OK)
npm run lint       # eslint — MUST be clean
npm run format     # prettier --write (then re-run lint)
npm test           # vitest run — ALL tests pass, including src/lib/registry.test.ts
npm run build      # astro build — MUST complete, 0 errors
```

`npm run verify` chains check + lint + test + build. The e2e suite
(`npm run test:e2e`, needs `npx playwright install chromium`) is run once per
epic, not per task.

Current gate status (this file's baseline): **PASS** — 64 tools, 629 unit tests,
build 79 pages, `astro check` 0 errors, eslint clean.

---

## 2. THE TOOL CONTRACT

> Also in `docs/ADDING-A-TOOL.md`. This section is authoritative and complete.

### 2.1 A tool is THREE co-located files under `src/tools/<category>/`

| File           | Contents                                                               | When loaded                                     |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| `<id>.meta.ts` | `export const meta: ToolMeta` — metadata only, tiny                    | eagerly, at build (cards, search, SEO, routing) |
| `<id>.tool.ts` | `import { meta } from './<id>.meta'; ... export default { meta, run }` | lazily, only when the tool runs                 |
| `<id>.test.ts` | Vitest unit tests importing `./<id>.tool`                              | test run only                                   |

**Registry rules enforced at build time** (violating any of these fails
`npm run build` and `src/lib/registry.test.ts`):

- `meta.id` is unique across ALL tools, kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`),
  and **equals the filename base** (`json-format` ⇒ `json-format.meta.ts` /
  `json-format.tool.ts` / `json-format.test.ts`).
- `meta.category` is one of: `encoding crypto security text data developer web
color datetime numbers converters generators network image pdf archive audio
misc`.
- `<id>.tool.ts` **imports** `meta` from `./<id>.meta` and re-exports it in the
  default object — single source of truth, never copy the object.
- `meta.summary.length <= 120`.

### 2.2 `ToolMeta` (every field)

```ts
export interface ToolMeta {
  id: string; // kebab-case, === filename base, permanent
  name: string; // Title Case, US spelling, e.g. "JSON Formatter"
  category: CategoryId; // exactly the one assigned in the spec
  summary: string; // <= 120 chars; card subtitle + meta description fallback
  description: string; // 1–3 sentences shown at top of the tool page
  keywords: string[]; // 5–12; US spelling primary, may also add GB spelling + synonyms
  privacy: { processing: 'on-device'; network: 'none'; offline: true }; // ALWAYS exactly this
  input: 'text' | 'file';
  accept?: string; // file input accept attr, only when input:'file' (e.g. 'image/*')
  multiple?: boolean; // allow multiple files, only when input:'file'
  options?: ToolOption[]; // see 2.3
  examples?: { title: string; input?: string; options?: OptionValues }[]; // 2–3; one-click fills the workbench
  faq?: { q: string; a: string }[]; // 1–3
  related?: string[]; // 2–4 other tool ids (may reference not-yet-built ids; that's fine)
  credits?: { name: string; url: string; license: string }[]; // ONLY if a task says to use a lib
  status?: 'stable' | 'beta'; // use 'stable' unless the spec says 'beta'
  worker?: boolean; // see 2.5 / 2.6 — usually omit
  hidden?: boolean; // omit
  updated?: string; // omit
}
```

### 2.3 `ToolOption` schema (rendered into the form by `OptionsFields.astro`)

```ts
type ToolOption =
  | {
      key;
      label;
      help?;
      showWhen?;
      type: 'select';
      default: string;
      choices: { value: string; label: string }[];
    }
  | { key; label; help?; showWhen?; type: 'boolean'; default: boolean }
  | { key; label; help?; showWhen?; type: 'number'; default: number; min?; max?; step? }
  | {
      key;
      label;
      help?;
      showWhen?;
      type: 'range';
      default: number;
      min: number;
      max: number;
      step?;
    }
  | { key; label; help?; showWhen?; type: 'text'; default: string; placeholder? }
  | { key; label; help?; showWhen?; type: 'textarea'; default: string; placeholder? };
```

- `key` is what appears in `input.options`. `default` is mandatory and typed to
  match `type` (`boolean` default is a boolean, `number`/`range` a number, the
  rest a string).
- `showWhen: { key, value }` hides the field until another option currently
  equals `value`. Use it for mode-dependent fields.
- For a **second free-text input** (diff/compare tools) use
  `{ key: 'second', label: 'Compare with', type: 'textarea', default: '' }`.

### 2.4 `run()` rules

```ts
// text tool
function run(input: TextRunInput): TextRunResult | Promise<TextRunResult> { ... }
interface TextRunInput { text: string; options: OptionValues; signal?: AbortSignal;
                         onProgress?: (fraction: number, message?: string) => void }

// file tool
async function run(input: FileRunInput): Promise<FileRunResult> { ... }
interface FileRunInput  { files: File[]; options: OptionValues; signal?: AbortSignal;
                          onProgress?: (fraction: number, message?: string) => void }
```

1. **First line:** `const o = resolveOptions(meta, input.options);` (import from
   `@/lib/options`). This merges declared defaults so the function works when a
   test omits options. Read every option from `o`, never from `input.options`.
2. **Pure.** Allowed globals: `crypto.subtle`, `crypto.getRandomValues`,
   `TextEncoder`, `TextDecoder`, `Intl` (incl. `Intl.DateTimeFormat` with
   `timeZone`), `structuredClone`, `atob`, `btoa`, `URL`, `URLSearchParams`,
   `Blob`, `Date`, `BigInt`, `performance.now()`. **Forbidden:** `window`,
   `document`, `fetch`, `XMLHttpRequest`, `localStorage`, `navigator.*`,
   `require`, `process`, `fs`, any DOM type. (`OffscreenCanvas` /
   `createImageBitmap` / `AudioContext` are allowed **only** in the specific
   image/audio file-tool tasks that call for them, and those set `worker`
   appropriately — see E4.)
3. **May be `async`.** Text tools that use `crypto.subtle` (async) return a
   `Promise<TextRunResult>`.
4. **Empty input:** text tools return `{ output: '' }` — EXCEPT pure generators
   (uuid, nanoid, ulid, lorem-ipsum, qr-code, placeholder-svg, password,
   passphrase, random-string, random-number, random-color, random-data,
   otp-uri) which always produce output.
5. **Expected user errors:** `throw new ToolError(message, hint?)` (import from
   `@/lib/types`). Message is one sentence, no trailing period is fine; `hint`
   is an actionable suggestion. Never throw a bare `Error` for user input
   problems. Never build an "error oracle" (e.g. decryption must fail with one
   generic message regardless of which check failed).
6. **Honour `signal`** (`if (input.signal?.aborted) throw new DOMException('Aborted','AbortError')`)
   and call `input.onProgress(fraction, msg)` for any loop that can be slow
   (file tools especially).

### 2.5 `TextRunResult` and `render` kinds

```ts
interface TextRunResult {
  output: string; // ALWAYS a string
  render?: 'text' | 'code' | 'image' | 'colors' | 'table' | 'diff'; // default 'text'
  language?: string; // for render:'code', e.g. 'json','yaml','sql','html','css','typescript'
  filename?: string; // suggested download name
  notes?: string[]; // neutral info lines under the output
  warnings?: string[]; // shown with a ⚠ marker
  stats?: Record<string, string | number>; // small key/value facts row
}
```

| `render`           | shape of `output`                                                             | how it displays                                 |
| ------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| `'text'` (default) | any string                                                                    | read-only textarea                              |
| `'code'`           | any string                                                                    | monospace block + `language` label              |
| `'image'`          | a `data:` URL (e.g. `data:image/svg+xml;base64,${btoa(svg)}`)                 | `<img>` + download                              |
| `'audio'`          | a `data:`/`blob:` audio URL (e.g. `data:audio/wav;base64,…`)                  | `<audio controls>` + download link (`filename`) |
| `'colors'`         | `JSON.stringify(cssColorString[])` e.g. `["#ff0000","rgb(0 128 0)"]`          | swatch grid, click to copy                      |
| `'table'`          | `JSON.stringify({ headers: string[], rows: string[][] })` (all cells strings) | HTML table                                      |
| `'diff'`           | unified-diff-ish text (lines start `+`, `-`, `@@`)                            | colourised read-only block                      |

**Nothing is ever parsed as HTML.** For `markdown-to-html` / `meta-tags` etc.
you output the HTML _source_ as `render:'code' language:'html'` — you never render
it.

### 2.6 `FileRunResult` (for `input: 'file'` tools)

```ts
interface OutputFile {
  filename: string;
  blob: Blob;
  previewUrl?: string;
}
interface FileRunResult {
  outputs: OutputFile[]; // 1..n produced files; may be `[]` when `report` is set
  report?: { output: string; render?: OutputRender; language?: string }; // inline result shown in the workbench (not a download)
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
}
```

- File tools run in the Web Worker automatically (`meta.worker` defaults to
  `true` for `input:'file'`). Set `meta.worker = false` **only** for audio tools
  (E4) that need `AudioContext`, which is main-thread only.
- Produce real `Blob`s with correct MIME types. Name outputs sensibly
  (`<original-stem>.<ext>`, or `bundle.zip` when zipping many).
- Until **task E2-S1** lands, a file tool cannot show an inline text/table
  report — it can only emit files. Tasks that need an inline report depend on
  E2-S1 and say so.

### 2.7 Errors — canonical messages

- Empty required text option → `throw new ToolError('Enter a <thing>.', 'It cannot be blank.')`
- Unparseable input → `throw new ToolError('That is not valid <format>.', '<what to check>')`
- Out of supported range → `throw new ToolError('<thing> must be between X and Y.')`
- Unsupported in this browser → `throw new ToolError('Your browser does not support <API>.', 'Try a recent Chrome, Edge or Firefox.')`

### 2.8 Tests (`<id>.test.ts`)

Import the tool default and call `run` directly. Cover, at minimum:

1. **A known-correct normal case** with an **exact** expected value (compute it
   by hand or from an authoritative source; the spec gives you the value where
   feasible).
2. **Empty input** → `{ output: '' }` (or, for a generator, asserts it still
   produces the right shape/length).
3. **An invalid input** → `expect(() => run(...)).toThrow()` (or
   `.rejects.toThrow()` for async), asserting the message matches a regex.
4. **Every option branch** — each `select` value, both `boolean` states that
   change output, boundary `number`s.

6–14 assertions per file. Use this helper shape:

```ts
import { describe, it, expect } from 'vitest';
import tool from './<id>.tool';
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string }; // add `await` + Promise type if async
```

### 2.9 Full worked example — copy this shape exactly

`src/tools/text/reverse-text.meta.ts`:

```ts
import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'reverse-text',
  name: 'Reverse Text',
  category: 'text',
  summary: 'Reverse text by character, word order, or line order — emoji-safe.',
  description:
    'Flip a string end to end, or reverse the order of its words or lines while keeping each readable. Splits on Unicode code points so most emoji survive.',
  keywords: ['reverse', 'backwards', 'mirror text', 'flip', 'reverse words', 'reverse string'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'by',
      label: 'Reverse',
      type: 'select',
      default: 'characters',
      choices: [
        { value: 'characters', label: 'Characters' },
        { value: 'words', label: 'Word order' },
        { value: 'lines', label: 'Line order' },
        { value: 'words-in-line', label: 'Words within each line' },
      ],
    },
  ],
  examples: [
    { title: 'Characters', input: 'Hello World' },
    { title: 'Word order', input: 'the quick brown fox', options: { by: 'words' } },
  ],
  faq: [
    {
      q: 'Does it break emoji?',
      a: 'It splits on Unicode code points, so single-codepoint emoji survive. Emoji built from several joined code points (families, flags) may separate.',
    },
  ],
  related: ['sort-lines', 'case-convert', 'rot13'],
  status: 'stable',
};
```

`src/tools/text/reverse-text.tool.ts`:

```ts
import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './reverse-text.meta';

const chars = (s: string): string[] => Array.from(s);

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text;
  if (!text) return { output: '' };
  let output: string;
  switch (String(o.by)) {
    case 'words':
      output = text.split(/(\s+)/).reverse().join('');
      break;
    case 'lines':
      output = text.split('\n').reverse().join('\n');
      break;
    case 'words-in-line':
      output = text
        .split('\n')
        .map((l) => l.split(/(\s+)/).reverse().join(''))
        .join('\n');
      break;
    default:
      output = chars(text).reverse().join('');
  }
  return { output, stats: { characters: chars(text).length } };
}

const tool: TextToolModule = { meta, run };
export default tool;
```

### 2.10 Mistakes that WILL break the gate

- Filename ≠ `meta.id`.
- Copying the `meta` object into `.tool.ts` instead of importing it.
- Reading `input.options.foo` instead of `o.foo` (breaks when tests omit options).
- Unguarded indexed access: `arr[i].x` where `noUncheckedIndexedAccess` makes
  `arr[i]` possibly `undefined`. Use a length check, `?.`, or `arr[i]!` only when
  the index is provably in range.
- `RegExpMatchArray` group access `m[1]` without a null check.
- `render:'table'` output that is not `JSON.stringify({headers,rows})` with all
  string cells.
- A `select` option whose `choices` value list does not include its `default`.
- `summary` longer than 120 chars.
- Importing a package not in §1.3's allowed list.
- Any `fetch` / DOM / Node usage in `run()`.
- Leaving an unused variable (eslint `no-unused-vars` is an error).

---

## 3. DESIGN SYSTEM & UX CONVENTIONS

You will rarely touch UI, but tools influence it through `meta` and `render`.

- **Colours** are CSS custom properties on `:root` / `:root[data-theme='dark']`
  in `src/styles/global.css`: `--bg --bg-subtle --bg-inset --border --text
--text-muted --accent --accent-strong --accent-fg --ring --danger --warning`.
  Use `rgb(var(--accent))` etc. Contrast is WCAG AA — do not introduce new
  hard-coded colours in any component.
- **Components** already exist for buttons (`.btn .btn-primary .btn-ghost`),
  inputs (`.field`), chips (`.chip`), links (`.link`). Reuse them.
- Tool pages get: breadcrumb, `<h1>` = `meta.name`, `meta.description`,
  `PrivacyBadge` (from `meta.privacy`), the workbench, FAQ accordion,
  "How it works" prose, "Related tools". All automatic from `meta`.
- Keep `meta.name` a plain noun phrase. Keep `summary` benefit-first and terse.
- Prefer **fewer options with good defaults**. Every option is a decision the
  user must make.

---

## 4. DEFINITION OF DONE

### Per tool

- [ ] 3 files created, filename === `meta.id`, correct category.
- [ ] `run()` pure, `resolveOptions` first line, correct `render`.
- [ ] Every option implemented AND covered by a test.
- [ ] ≥1 hand-verified known-answer test with an exact expected value.
- [ ] Empty-input and invalid-input (`ToolError`) tests.
- [ ] `meta` complete: summary ≤120, 5–12 keywords, 2–3 examples, 1–3 faq,
      2–4 related.
- [ ] Gate green (§1.5).
- [ ] Manual smoke: `npm run dev`, open `/tools/<id>`, click each example, toggle
      each option, confirm output + copy/download + friendly errors.

### Per story / epic

- [ ] All child tasks done.
- [ ] `npm run test:e2e` green (a11y + privacy + smoke).
- [ ] `npm run build` clean; new tool pages appear in `dist/` and in
      `/tools-index.json`.
- [ ] Committed with a descriptive message.

---

## 5. STATUS LEGEND

- `[x]` done and verified (gate was green when ticked)
- `[ ]` not started
- `[~]` in progress / partially done (note what remains inline)
- `[!]` blocked (note the blocker inline)

---

## 6. EPICS OVERVIEW

| ID  | Epic                                                                               | Status                | Rough size |
| --- | ---------------------------------------------------------------------------------- | --------------------- | ---------- |
| E0  | Foundation (architecture, workbench, PWA, CI, e2e)                                 | `[x]` done            | —          |
| E1  | Tool Batch A — encoding / text / crypto / security / data / developer              | `[x]` done (64 tools) | —          |
| E2  | Foundation enhancements (inline reports, audio render, worker dedupe, a11y polish) | `[ ]`                 | 8 tasks    |
| E3  | Tool Batch B — web / color / datetime / numbers / generators / network             | `[ ]`                 | ~52 tools  |
| E4  | Tool Batch C — image / pdf / archive / audio / misc (file & canvas tools)          | `[x]` done            | ~48 tools  |
| E5  | Quality & hardening (adversarial review, fuzz, perf budgets, cross-browser)        | `[ ]`                 | 9 tasks    |
| E6  | SEO & content depth (per-tool long-form, structured data, OG images)               | `[ ]`                 | 7 tasks    |
| E7  | PWA / performance / UX polish (install UX, offline, Lighthouse, motion)            | `[ ]`                 | 9 tasks    |
| E8  | Astro 7 upgrade (clears `npm audit`; Tailwind v4 migration)                        | `[ ]`                 | 6 tasks    |
| E9  | Internationalisation scaffolding                                                   | `[ ]`                 | 5 tasks    |
| E10 | Launch & operations (domain, deploy, monitoring, runbook, roadmap cadence)         | `[ ]`                 | 8 tasks    |

Recommended order: **E2 → E3 → E4 → E5 → E6 → E7 → E8 → E10**, with E9 optional /
anytime. E3 and E4 tools within a category can be parallelised freely (disjoint
files).

---

## 7. COMPLETED WORK ✅

### E0 — Foundation `[x]`

- [x] Clean-slate Astro 4 static project; TS strict + `noUncheckedIndexedAccess`;
      Tailwind 3 with CSS-variable design tokens (light/dark/system, no-flash).
- [x] Auto-discovering tool **registry** (`import.meta.glob` over
      `src/tools/**/<id>.{meta,tool}.ts`); build-time validation of id / category
      / filename / uniqueness; `SEARCH_INDEX`, `relatedTools`, `categoriesWithCounts`.
- [x] **18 categories** defined (`src/lib/categories.ts`).
- [x] **TextWorkbench** — options form from schema, live run (debounced),
      examples, copy/download/clear, XSS-safe renderers for
      text/code/image/colors/table/diff, stats/notes/warnings, abort on re-run.
- [x] **FileWorkbench** — drag/drop + picker, multi-file, per-file remove,
      progress bar, cancel, per-output download + "download all (.zip)".
- [x] **Generic tool Web Worker** + client (`runTool` / `runToolById`), abort via
      `worker.terminate()`, file tools run off the main thread.
- [x] `resolveOptions`, `capabilities`, `format.ts`, `files.ts`, `clipboard.ts`,
      `seo.ts` helper libs.
- [x] **Pages**: home, all-tools (filter + live search), `tools/[tool]`,
      categories index + `[category]`, privacy (generated from per-tool
      metadata), about (install instructions per OS), offline, 404.
- [x] **Endpoints**: `sitemap.xml`, `robots.txt`, `manifest.webmanifest`,
      `opensearch.xml`, `tools-index.json`.
- [x] **PWA**: dependency-free service worker (precache shell,
      stale-while-revalidate, offline fallback, versioned), real generated
      PNG/ICO/OG assets (`scripts/gen-icons.mjs`, Node `zlib` only), maskable
      icon, apple-touch-icon.
- [x] **SEO**: per-tool `SoftwareApplication` + `FAQPage` + `BreadcrumbList`
      JSON-LD, canonical, OpenGraph/Twitter, sitemap.
- [x] **Security headers / CSP** via `public/_headers`, `netlify.toml`,
      `vercel.json` (`default-src 'self'`, `connect-src 'self' blob:`, etc.).
- [x] **CI** (`.github/workflows/ci.yml`): check + lint + format check + coverage + build + `npm audit --omit=dev --audit-level=critical`; separate e2e job.
- [x] **e2e** (Playwright): axe-core WCAG 2A/2AA on core pages; every tool page
      renders a working workbench; search dialog; **privacy assertion** — every
      `network:'none'` tool page is exercised and the test fails on any
      cross-origin request; and "the site loads no third-party scripts/fonts".
- [x] **Docs**: `README`, `ARCHITECTURE`, `ADDING-A-TOOL`, `DEPLOYMENT`,
      `ROADMAP`, `SECURITY` (Astro-4 advisory rationale), `NOTICE`, `LICENSE`
      (MIT), `CONTRIBUTING`.
- [x] a11y fix: `--accent` → brand-700 + `--accent-strong` token so buttons and
      chips clear WCAG AA contrast.

### E1 — Tool Batch A `[x]` — 64 tools, 629 unit tests

Foundation reference tools: `base64`, `uuid`, `color-convert`, `file-hash`.

- [x] **encoding** (11): `base64`, `base32`, `hex`, `url-encode`,
      `html-entities`, `unicode-escape`, `quoted-printable`, `jwt-decode`,
      `base58`, `ascii85` _(+ `punycode` NOT built — see E3)_
- [x] **text** (18): `case-convert`, `slugify`, `sort-lines`, `dedupe-lines`,
      `reverse-text`, `rot13`, `morse-code`, `nato-phonetic`, `text-repeat`,
      `wrap-text`, `indent-text`, `remove-empty-lines`, `line-numbers`,
      `find-replace`, `text-stats`, `word-frequency`, `char-frequency`
- [x] **crypto** (4): `file-hash`, `hash` (MD5 pure-JS + SHA via WebCrypto),
      `hmac`, `crc32` (crc32 / crc32c / adler32)
- [x] **security** (4): `password`, `passphrase`, `random-string`,
      `text-encrypt` (AES-256-GCM, PBKDF2-SHA256 600k, `TBenc1.` envelope)
- [x] **data** (13): `json-format`, `json-escape`, `ndjson`, `json-to-yaml`,
      `yaml-to-json`, `json-to-csv`, `csv-to-json`, `json-to-typescript`,
      `json-to-jsonschema`, `xml-format`, `querystring`, `dotenv`, `json-diff`
- [x] **developer** (14): `regex-tester`, `cron-parser`, `number-base`,
      `chmod-calculator`, `hash-identifier`, `snowflake`, `objectid`,
      `uuid-namespace`, `string-escape`, `backslash-escape`, `diff-text`,
      `markdown-to-html`, `html-to-text`, `sql-format`
- [x] **color** (1): `color-convert` (HEX/RGB/HSL/HSV/CMYK/OKLCH + contrast)
- [x] **generators** (1): `uuid` (v4/v7/nil, bulk)

> **Not yet independently review-passed** (workflow was interrupted): the
> `developer` cluster's `string-escape`, `backslash-escape`, `diff-text` did not
> get a second-agent review. Covered by **E5-S1**.

---

## 8. BACKLOG

---

## EPIC E2 — Foundation Enhancements

> **Environment note (2026-09-04):** `npm run test:e2e` was run per task and is
> green (7/7). The Playwright `mobile-safari` project cannot launch in this
> sandbox because WebKit's system libraries can't be installed without sudo
> (`npx playwright install-deps` requires root); all runs therefore used
> `--project=chromium`. Re-run the full matrix in CI where deps are available.

**Goal:** unlock the tool families in E4 (file tools that show an inline
report; audio tools; canvas tools) and pay down small a11y/perf debt.
**These are the ONLY tasks allowed to edit `src/lib/**` and `src/components/**`.**
Each task states the exact files and the exact change. Do them in order; run the
full gate + `npm run test:e2e` after each.

### Story E2-S1 — Inline reports for file tools

Many file tools (image metadata, EXIF, palette extraction, PDF info, archive
listing, audio info, checksums) need to show **text / a table** inline, not just
emit a file. Add an optional `report` channel to `FileRunResult` and render it in
`FileWorkbench`.

- [x] **E2-S1-T1** — `src/lib/types.ts`: add to `FileRunResult`:
  ```ts
  /** Optional inline result shown in the workbench (not a download). */
  report?: { output: string; render?: OutputRender; language?: string };
  ```
  Also relax the doc comment so `outputs` may be `[]` when `report` is set.
  `OutputRender` is the existing exported union — add `'audio'` to it now
  (used by E2-S2): `'text'|'code'|'image'|'colors'|'table'|'diff'|'audio'`.
- [x] **E2-S1-T2** — `src/components/workbench/shared.ts`: `renderTextResult`
      already handles `text/code/image/colors/table/diff`. Add an `'audio'` branch:
      create `<audio controls src={output}>` (output is a `data:` or `blob:` URL) +
      a download `<a>`. Keep it XSS-safe (set `.src`, never `innerHTML` the URL).
- [x] **E2-S1-T3** — `src/components/workbench/FileWorkbench.astro`: after
      rendering `outputs`, if `result.report` is present, render it into a
      `[data-report]` container by calling the shared `renderTextResult` with
      `{ output: report.output, render: report.render, language: report.language }`.
      Show it above the outputs list. Import `renderTextResult` from `./shared`.
- [x] **E2-S1-T4** — Add a unit test `src/components/workbench/shared.test.ts`
      (new) covering `renderTextResult` for each render kind incl. `audio` and a
      `report`-only result (jsdom). Wire it into the existing vitest include glob if
      needed (it already matches `src/**/*.test.ts`).
- [x] **E2-S1-T5** — Update `docs/ADDING-A-TOOL.md` §"File tool" with the
      `report` field and the `audio` render kind. Update this file's §2.5/§2.6.

**DoD:** an example file tool (use `file-hash` — change it to also set
`report` with a `render:'table'` of `[algorithm, hash, filename]` rows) shows the
table inline; `file-hash.test.ts` updated; gate + e2e green.

### Story E2-S2 — Audio render + tone generator support

- [x] **E2-S2-T1** — Depends on E2-S1-T1 (adds `'audio'` to `OutputRender`) and
      E2-S1-T2 (renderer). Verify a **text** tool can return
      `{ output: 'data:audio/wav;base64,...', render: 'audio', filename: 'tone.wav' }`
      and it plays + downloads in `TextWorkbench`. `TextWorkbench.astro`'s
      `renderTextResult` call already covers it via shared.ts; only add the
      `render:'audio'` case to the **download button** logic in `TextWorkbench.astro`
      (treat like `image`: use `output` as the `href`, `filename` as download name).
- [x] **E2-S2-T2** — Add a pure-JS **WAV encoder** helper at
      `src/lib/audio.ts` (NEW file, allowed under this epic):
      `encodeWavPCM16(channels: Float32Array[], sampleRate: number): Uint8Array` and
      `wavDataUri(bytes: Uint8Array): string`. RIFF/WAVE, PCM 16-bit, interleaved.
      Unit-test it (`src/lib/audio.test.ts`) with a 1-sample known byte layout.
      This is imported by E4 audio tools AND by the `tone-generator` text tool
      (spec §9).

### Story E2-S3 — Canvas helper for image tools

- [x] **E2-S3-T1** — `src/lib/image.ts` (NEW): helpers used by E4 image tools,
      worker-safe (use `OffscreenCanvas` + `createImageBitmap`, fall back to
      `ToolError` if unavailable):
  - `decodeImage(blob: Blob): Promise<ImageBitmap>`
  - `drawToBlob(bitmap|canvas, { width, height, type, quality }): Promise<Blob>`
  - `canvasFor(width, height): OffscreenCanvas` (throws `ToolError` if no
    `OffscreenCanvas`)
  - `readPixels(bitmap, maxSample = 100_000): Uint8ClampedArray` (downscale-sample
    for palette/analysis)
    Unit-test what is testable in jsdom (guards, type strings); the pixel paths are
    covered by e2e in E5.
- [x] **E2-S3-T2** — Confirm `capabilities.ts` exposes `offscreenCanvas`,
      `createImageBitmap`, `imageOutputType(mime)` (it does). No change expected;
      add any missing one here.

### Story E2-S4 — Worker/main-thread chunk dedupe

- [x] **E2-S4-T1** (closed as "won't do (documented)" — see docs/ARCHITECTURE.md#chunk-dedupe) — Currently a tool's module is bundled twice (once for the
      main-thread lazy import, once inside `tool.worker.ts`'s glob). Investigate a
      Vite `manualChunks` / shared-chunk config in `astro.config.mjs` `vite.build`
      so `src/tools/**` and heavy vendor libs resolve to one shared chunk across the
      main graph and the worker graph. Measure `dist/_astro` total before/after.
      If it can't be done cleanly without risk, document why in
      `docs/ARCHITECTURE.md` and close the task as "won't do (documented)".

### Story E2-S5 — Small a11y / UX debt

- [x] **E2-S5-T1** — `TextWorkbench.astro`: the live-run debounce (180ms) can
      fire heavy tools on every keystroke. Add: skip auto-run when `input.length`
  > 50_000 unless the user presses Run; show a hint. Keep manual Run always
  > working.
- [x] **E2-S5-T2** — `FileWorkbench.astro`: announce progress and completion to
      screen readers via an `aria-live="polite"` region (progress % text). Verify
      with axe + manual VoiceOver/NVDA note in the PR.
- [x] **E2-S5-T3** — `OptionsFields.astro`: ensure every `range` input has a
      visible current-value `<output>` and `aria-describedby` wiring; every `select`
      a programmatic label. Add axe assertions to `e2e/smoke.spec.ts` for a tool
      page with each option type (e.g. `/tools/password`, `/tools/hex`).
- [x] **E2-S5-T4** — `SearchDialog.astro`: trap focus within the dialog, restore
      focus to the trigger on close, and support `Esc`. Add an e2e test.

---

## EPIC E3 — Tool Batch B (web / color / datetime / numbers / generators / network)

**~52 tools.** All `input: 'text'`, pure functions, no new dependencies except
`qrcode-generator` (already installed) for `qr-code`. Build each from its spec in
**§9**. Tools within a story are independent — safe to do in any order or in
parallel. One commit per story.

### Story E3-S1 — Web utilities (10 tools) → `src/tools/web/`

- [x] `url-parse` · [x] `basic-auth` · [x] `data-uri` · [x] `punycode`
- [x] `meta-tags` · [x] `robots-txt` · [x] `gitignore` · [x] `editorconfig`
- [x] `mime-lookup` · [x] `port-lookup`

### Story E3-S2 — Web / CSS generators (4 tools) → `src/tools/web/`

- [x] `css-units` · [x] `gradient-css` · [x] `box-shadow` · [x] `cubic-bezier`

### Story E3-S3 — Web lookups (2 tools) → `src/tools/web/`

- [x] `http-status` · [x] `user-agent`

### Story E3-S4 — Colour (6 tools) → `src/tools/color/`

- [x] `color-contrast` · [x] `color-palette` · [x] `color-blend`
- [x] `color-random` · [x] `color-blindness` · [x] `color-name`

### Story E3-S5 — Date & time (7 tools) → `src/tools/datetime/`

- [x] `timestamp` · [x] `timezone-convert` · [x] `duration-convert`
- [x] `date-diff` · [x] `date-add` · [x] `age-calculator` · [x] `week-number`

### Story E3-S6 — Numbers & maths (13 tools) → `src/tools/numbers/`

- [ ] `unit-convert` · [ ] `roman-numeral` · [ ] `number-to-words`
- [ ] `percentage` · [ ] `statistics` · [ ] `prime-tools` · [ ] `random-number`
- [ ] `gcd-lcm` · [ ] `scientific-notation` · [ ] `fraction` · [ ] `ratio`
- [ ] `base-n-logic` · [ ] `roman-numeral-date` _(optional — see §9; skip if low value)_

### Story E3-S7 — Generators (10 tools) → `src/tools/generators/`

- [x] `nanoid` · [x] `ulid` · [x] `random-data` · [x] `lorem-ipsum`
- [x] `qr-code` · [x] `placeholder-svg` · [x] `vcard` · [x] `ical-event`
- [x] `utm-builder` · [x] `otp-uri`

### Story E3-S8 — Network (8 tools) → `src/tools/network/`

- [ ] `ip-info` · [ ] `cidr-calculator` · [ ] `ip-range` · [ ] `subnet-split`
- [ ] `ipv6-tools` · [ ] `mac-address` · [ ] `ptr-record` · [ ] `asn-lookup` _(see §9 note — may be data-heavy; deferrable)_

### Story E3-S9 — Batch B integration

- [ ] Full gate + `npm run test:e2e`.
- [ ] `src/pages/index.astro` featured list already references `qr-code` —
      confirm it now resolves (it will once `qr-code` exists). No edit needed
      unless a referenced id is still missing (then this is the task to fix the
      list — it is a `pages/` file, edit is authorised **here only**).
- [ ] Update `README` tool count if it hard-codes a number (it uses
      `TOOL_COUNT` — verify, no edit expected).
- [ ] Commit.

---

## EPIC E4 — Tool Batch C (image / pdf / archive / audio / misc)

**~48 tools.** These are **file tools** (`input: 'file'`) and canvas/audio tools.
**Depends on E2** (S1 inline reports, S2 audio+WAV, S3 canvas helpers). Do E2
first. Libraries used here — all already installed: `pdf-lib`, `pdfjs-dist`,
`fflate`. Canvas via `OffscreenCanvas`/`createImageBitmap` (worker-safe). Audio
via `AudioContext`/`OfflineAudioContext` (**main-thread only** → those tools set
`meta.worker = false`).

Per-tool specs in **§9**. Each file tool must: validate input type, honour
`signal`, call `onProgress`, produce correctly-typed `Blob`s, and (where the spec
says) set `report`.

### Story E4-S1 — Image, canvas-based (11 tools) → `src/tools/image/`

`meta`: `input:'file'`, `accept:'image/*'`, `multiple` per spec, `worker` omitted
(defaults true — canvas runs in the worker via `OffscreenCanvas`).

- [x] `image-resize` · [x] `image-compress` · [x] `image-convert`
- [x] `image-crop` · [x] `image-rotate` · [x] `image-to-datauri`
- [x] `datauri-to-image` · [x] `image-metadata` _(report; EXIF parse)_
- [x] `image-palette` _(report: colors)_ · [x] `svg-to-png`

### Story E4-S2 — Image, multi-output (3 tools) → `src/tools/image/`

- [x] `favicon-generator` _(one image → 16/32/48/180/192/512 PNG + .ico, zipped)_
- [x] `image-spritesheet` _(N images → one sheet PNG + a CSS/JSON map)_
- [x] `image-diff` _(two images → a difference PNG + `report` stats)_

### Story E4-S3 — PDF (11 tools) → `src/tools/pdf/`

`accept:'application/pdf'` (or `image/*` for images-to-pdf). `credits`: pdf-lib
MIT and/or pdfjs-dist Apache-2.0 per tool.

- [x] `pdf-merge` · [x] `pdf-split` · [x] `pdf-extract-pages` · [x] `pdf-rotate`
- [x] `pdf-delete-pages` · [x] `pdf-page-numbers` · [x] `pdf-watermark`
- [x] `pdf-metadata` _(report + rewrite)_ · [x] `pdf-to-images` _(pdfjs render → zip)_
- [x] `images-to-pdf` · [x] `pdf-extract-text` _(pdfjs → .txt + report)_

### Story E4-S4 — Archives & files (10 tools) → `src/tools/archive/`

`credits`: fflate MIT.

- [x] `zip-create` · [x] `zip-extract` · [x] `zip-inspect` _(report: table)_
- [x] `gzip` _(compress/decompress)_ · [x] `tar-create` · [x] `tar-extract`
- [x] `file-split` · [x] `file-join` · [x] `base64-file`
- [x] `file-metadata` _(report: name/size/type/mtime + SHA-256)_

### Story E4-S5 — Audio, Web Audio API (10 tools) → `src/tools/audio/`

`accept:'audio/*'`, **`meta.worker = false`** (AudioContext is main-thread).
`OfflineAudioContext` for rendering. Output WAV via `src/lib/audio.ts` (E2-S2).

- [x] `audio-info` _(report: table)_ · [x] `audio-to-wav` · [x] `audio-trim`
- [x] `audio-normalize` · [x] `audio-gain` · [x] `audio-fade`
- [x] `audio-reverse` · [x] `audio-merge` _(multiple)_ · [x] `audio-channels`
      _(stereo↔mono, extract L/R)_ · [x] `audio-speed` _(resample; pitch note)_

### Story E4-S6 — Generators that emit media/audio → `src/tools/generators/` or `misc`

- [x] `tone-generator` _(text tool; sine/square/saw/triangle/noise → WAV
      data URI, `render:'audio'`)_ — depends on E2-S2.
- [x] `metronome-click` _(text tool; BPM/bars → a click-track WAV,
      `render:'audio'`)_ — depends on E2-S2.

### Story E4-S7 — Everyday tools (8 tools) → `src/tools/misc/`

All `input:'text'`, pure.

- [x] `calculator` _(safe expression evaluator — NO `eval`/`Function`)_
- [x] `programmer-calculator` _(bitwise ops across bases)_
- [x] `tip-calculator` · [x] `loan-calculator` _(amortisation summary)_
- [x] `bmi-calculator` · [x] `aspect-ratio` · [x] `data-size` _(bytes ↔ KiB/MB…)_
- [x] `random-picker` _(pick N / shuffle / make teams from a list)_

### Story E4-S8 — Batch C integration

- [x] Full gate + `npm run test:e2e` (image/audio/pdf paths need real browser —
      add smoke specs in `e2e/tools-c.spec.ts` that upload a tiny fixture PNG /
      WAV / PDF from `e2e/fixtures/` and assert an output/report appears and no
      network request is made).
- [x] Add fixtures: a 2×2 PNG, a 0.1s mono WAV, a 1-page PDF (generate them in a
      `scripts/gen-fixtures.mjs`, Node-only, committed).
- [x] `src/pages/index.astro` featured list references `image-resize` — confirm
      it resolves.
- [x] Commit.

### E4 — Tool Batch C `[x]` — image / pdf / archive / audio / misc, gate green

- [x] 13 image tools (E4-S1/S2) with meta/tool/test each; EXIF + PNG metadata parsing.
- [x] 11 PDF tools (E4-S3) using pdf-lib / pdfjs-dist, with tests and inline reports.
- [x] 10 archive tools (E4-S4) using fflate, with tests; zip-inspect reports a table.
- [x] 10 audio tools (E4-S5) with `meta.worker = false` and tests.
- [x] tone-generator + metronome-click (E4-S6) emit WAV data URIs, `render:'audio'`.
- [x] 8 everyday misc tools (E4-S7) with tests (calculator, tip, loan, BMI, etc.).
- [x] E4-S8 integration: fixtures (`e2e/fixtures/` via `scripts/gen-fixtures.mjs`),
      `e2e/tools-c.spec.ts` (image-resize / audio-info / pdf-metadata, no network),
      featured `image-resize` resolves on the home page.
- [x] Gate: `npm run verify` green — 0 TS errors, eslint clean, 1167 unit tests,
      183-page Astro build. e2e chromium 10/10 green (mobile-safari WebKit not
      installable in this sandbox — same limitation as E2; run in CI).

---

## EPIC E5 — Quality & Hardening

### Story E5-S1 — Adversarial review of every tool

- [ ] **E5-S1-T1** — For each category dir, run a focused review pass: verify one
      known-answer by hand per tool against an authoritative source (RFC, MDN,
      `iconv`, `openssl`, `python -c`, etc.); confirm `resolveOptions` usage,
      purity, correct `render` shape, `ToolError` on bad input, no unguarded
      indexed access, every option tested. Fix in place. Priority order:
      `developer` (string-escape / backslash-escape / diff-text never reviewed) →
      `data` → `crypto` → `encoding` → the rest.
- [ ] **E5-S1-T2** — Add a **contract meta-test** `src/lib/contract.test.ts`
      (new, under `src/lib` — authorised here): iterate `ALL_TOOLS`, assert for
      each: `summary.length<=120`; `keywords.length>=3`; `examples.length>=1`;
      `related.length>=1`; `privacy` deep-equals `{processing:'on-device',
network:'none', offline:true}`; every `select` option's `default` is in its
      `choices`; every `showWhen.key` refers to a real sibling option; `input`
      is `'text'|'file'`; if `input:'file'` then `accept` is set. Load each
      `.tool.ts` and assert `typeof default.run === 'function'` and
      `default.meta === <the meta module's meta>`.
- [ ] **E5-S1-T3** — Fix everything E5-S1-T2 flags.

### Story E5-S2 — Fuzz / property tests for parsers

- [ ] **E5-S2-T1** — For round-trippable tools (base64, base32, hex, base58,
      ascii85, url-encode, html-entities, unicode-escape, quoted-printable,
      backslash-escape, json-escape, punycode, querystring, dotenv), add a
      property test: for 200 random strings (seeded PRNG in the test, include
      emoji, control chars, RTL, long runs), `decode(encode(x)) === x`.
- [ ] **E5-S2-T2** — For `regex-tester`, `find-replace`, `sql-format`,
      `cron-parser`: feed pathological inputs (nested quantifiers, 10k-char
      lines, deeply nested parens) and assert they return within a time budget
      (use `vi.useFakeTimers` where possible, else a wall-clock `expect` < 500ms)
      or throw `ToolError` — never hang.

### Story E5-S3 — Performance budgets

- [ ] **E5-S3-T1** — Add `scripts/check-bundle.mjs`: after `npm run build`,
      assert `dist/` initial route JS (home page) gzip < 20 KB, any single
      `_astro/*.js` < 250 KB gzip, total `_astro` < 2 MB gzip. Wire into CI as a
      non-blocking report first, then blocking.
- [ ] **E5-S3-T2** — Lighthouse CI (`@lhci/cli` as a devDep — **this is an
      approved dep add for this task only**) on `/`, `/tools`, `/tools/base64`,
      `/tools/image-resize`: assert Perf ≥ 95, A11y = 100, Best-Practices ≥ 95,
      SEO = 100. Add `.lighthouserc.json`. Add to CI.
- [ ] **E5-S3-T3** — For heavy file tools (pdf-to-images, image-_, audio-_),
      add a note in each tool's `faq` about practical size limits and confirm
      `onProgress` + cancel work with a large fixture (manual + e2e).

### Story E5-S4 — Cross-browser & mobile

- [ ] **E5-S4-T1** — Extend `playwright.config.ts` projects: add `firefox`,
      `webkit`, `Pixel 7`. Run the full e2e matrix in CI (allow-fail webkit
      audio initially, document any gaps).
- [ ] **E5-S4-T2** — Manual pass on a real iOS Safari and Android Chrome: PWA
      install, offline, a text tool, an image tool, an audio tool, a PDF tool,
      the search dialog, dark mode. Record results in `docs/BROWSER-MATRIX.md`
      (new).

### Story E5-S5 — Security review

- [ ] **E5-S5-T1** — Confirm CSP in `public/_headers` still fits (workers +
      `blob:` + `wasm-unsafe-eval` if any WASM sneaks in — there should be none).
      Add a test that greps `dist/**/*.js` for `http://` / `https://` string
      literals pointing off-origin and fails on any (allowlist schema.org and
      the site URL in JSON-LD only).
- [ ] **E5-S5-T2** — `npm audit` review; update `SECURITY.md` "known advisories"
      table; if E8 (Astro 7) is done, this should be empty.
- [ ] **E5-S5-T3** — Verify no tool writes to `localStorage`/`IndexedDB` (only
      the theme toggle and per-tool "remember last input" — if the latter is
      added later it must be opt-in and documented).

---

## EPIC E6 — SEO & Content Depth

Thin utility pages get penalised. Every tool page needs unique, useful prose.

### Story E6-S1 — Long-form content per tool

- [ ] **E6-S1-T1** — Extend `ToolMeta` (E2-authorised edit to `types.ts` — do it
      as part of this task): add optional
      `article?: { heading: string; body: string }[]` (plain paragraphs, no
      HTML) rendered by `ToolPage.astro` under "How it works". Keep it optional.
- [ ] **E6-S1-T2** — Write `article` for the top ~40 tools by expected search
      volume (base64, json-format, hash, uuid, url-encode, jwt-decode,
      timestamp, cron-parser, regex-tester, color-convert, qr-code,
      image-resize, image-compress, pdf-merge, pdf-split, etc.): 150–300 words
      each covering what it does, when to use it, input/output formats,
      limitations, and the privacy angle. British or American spelling,
      consistent per file.
- [ ] **E6-S1-T3** — Ensure each of those tools has 3 real `examples` and 3
      `faq` entries answering actual user questions.

### Story E6-S2 — Structured data & discovery

- [ ] **E6-S2-T1** — Add `HowTo` JSON-LD (in `src/lib/seo.ts`) for tools whose
      `article` includes step content; render on the page.
- [ ] **E6-S2-T2** — Add an `ItemList` JSON-LD to `/tools` and each
      `/categories/[category]`.
- [ ] **E6-S2-T3** — Add `BreadcrumbList` to category pages (tool pages already
      have it).

### Story E6-S3 — Per-tool Open Graph images

- [ ] **E6-S3-T1** — Extend `scripts/gen-icons.mjs` (or new
      `scripts/gen-og.mjs`, Node zlib only) to generate a per-tool
      `dist`-time OG PNG (1200×630, brand field, tool name, category) — or a
      single dynamic endpoint `src/pages/og/[tool].png.ts` if feasible without a
      renderer (pure canvas-free PNG text is hard; a small bitmap font baked into
      the script is the pragmatic route). Wire `BaseHead.astro` to use
      `/og/<id>.png` when present.

### Story E6-S4 — Content pages

- [ ] **E6-S4-T1** — `/guides` index + a few evergreen guides ("Base64 explained",
      "Which hash should I use?", "Cron syntax cheat sheet", "Colour contrast &
      WCAG") as `.astro` pages under `src/pages/guides/`. Cross-link to the
      relevant tools. (New pages — authorised in this task.)

---

## EPIC E7 — PWA / Performance / UX Polish

- [ ] **E7-T1** — Install prompt UX: capture `beforeinstallprompt`, show a
      dismissible "Install app" button in the header on supported browsers;
      remember dismissal in `localStorage`. New small island component.
- [ ] **E7-T2** — Service worker: precache the tool-index JSON and the top-20
      tool pages; add a "new version available" toast (SW `updatefound` →
      `postMessage('skip-waiting')` flow). Bump `VERSION`.
- [ ] **E7-T3** — Offline page lists the tools already cached (read from the SW
      cache via `caches.match`).
- [ ] **E7-T4** — Add subtle, reduced-motion-aware transitions to result
      rendering and tab/option changes. Nothing over 200ms. Respect
      `prefers-reduced-motion`.
- [ ] **E7-T5** — Keyboard shortcuts: `/` focus search (done), `?` open a
      shortcuts help dialog, `Ctrl/Cmd+Enter` run the current tool,
      `Ctrl/Cmd+C` when output focused copies. Document on the shortcuts dialog.
- [ ] **E7-T6** — "Remember last input/options per tool" (opt-in checkbox,
      `localStorage`, per `meta.id`). Update `/privacy` to mention it.
- [ ] **E7-T7** — Shareable state: encode current input+options into the URL hash
      (`#i=<base64url>&o=<base64url>`), restore on load. Add a "Copy link"
      button. Cap encoded size; fall back gracefully.
- [ ] **E7-T8** — Empty states, loading skeletons, and a friendly first-run hint
      on the workbench.
- [ ] **E7-T9** — Lighthouse pass ≥ targets in E5-S3-T2 on mobile emulation for
      10 representative pages.

---

## EPIC E8 — Astro 7 Upgrade (clears `npm audit`)

`npm audit` flags Astro 4.16 + esbuild/vite/sharp advisories fixed only in Astro 7. None are reachable in the static production artifact (dev-server / SSR / adapter
only — see `SECURITY.md`), but a clean audit matters for trust.

- [ ] **E8-T1** — Branch. `npm i astro@7` (latest 7.x). Read Astro 5→6→7 migration
      guides; apply config changes in `astro.config.mjs`.
- [ ] **E8-T2** — Tailwind: `@astrojs/tailwind` is deprecated on Astro 7. Migrate
      to `@tailwindcss/vite` + Tailwind v4. Convert `tailwind.config.mjs` theme
      to CSS `@theme` in `global.css`. Keep the exact same token names and
      values. Verify every utility class still resolves (grep the build output).
- [ ] **E8-T3** — Fix any `getStaticPaths` / content-collection / `set:html` /
      `Astro.glob` API changes. This project uses `import.meta.glob` (fine).
- [ ] **E8-T4** — Full gate + e2e on all Playwright projects. Visual diff the
      home + a tool page against pre-upgrade screenshots.
- [ ] **E8-T5** — `npm audit` must be clean (or only unavoidable dev-only lows,
      documented). Update CI to `--audit-level=high`. Update `SECURITY.md`.
- [ ] **E8-T6** — Update `README`/`ARCHITECTURE`/`package.json` engine notes.
      Merge.

---

## EPIC E9 — Internationalisation (optional)

- [ ] **E9-T1** — Extract all UI strings from components/pages into
      `src/lib/i18n/en.ts` (a flat key map). No behaviour change.
- [ ] **E9-T2** — Add an `t(key)` helper + `LOCALE` from `site.ts`. Wire
      components to it.
- [ ] **E9-T3** — Decide tool `meta` i18n strategy (likely: keep tool `meta` in
      English for now; only chrome is translated). Document.
- [ ] **E9-T4** — Add `hreflang` + `lang` plumbing; `/[locale]/` routing behind a
      config flag (off by default).
- [ ] **E9-T5** — One sample locale (e.g. `es`) for the chrome to prove the
      pipeline; machine-translate + mark `needsReview`.

---

## EPIC E10 — Launch & Operations

- [ ] **E10-T1** — Choose the real product name + domain. Update `src/lib/site.ts`
      (`name`, `shortName`, `url`, `repository`, `social`) and run
      `node scripts/gen-icons.mjs` if the brand colour changes. Search the repo
      for the placeholder "Toolbench" / "toolbench.app" and replace only in
      user-facing copy (not this file's history).
- [ ] **E10-T2** — Register the domain; set `SITE_URL` in the host env; deploy to
      Cloudflare Pages **and** Netlify (pick primary, keep the other as warm
      standby). Verify `_headers` / `netlify.toml` / `vercel.json` all apply the
      CSP. Confirm HTTPS, HTTP/2, Brotli.
- [ ] **E10-T3** — Post-deploy smoke: run `e2e/` against the live URL; check
      `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, install prompt,
      offline, a tool from each category.
- [ ] **E10-T4** — Submit sitemap to Google Search Console + Bing Webmaster.
      Add the site to a few "privacy tools" / "no-login tools" directories
      (it-tools awesome lists, nologin.tools, etc.).
- [ ] **E10-T5** — Optional privacy-respecting analytics: **self-hosted**
      Plausible or a Cloudflare-Web-Analytics beacon, **or** a tiny first-party
      `/api/hit` edge function that only increments a counter (no PII, no
      cookies). Update `/privacy` and the CSP `connect-src`. If in doubt, ship
      with **zero** analytics.
- [ ] **E10-T6** — `docs/RUNBOOK.md` (new): how to deploy, roll back (redeploy
      previous build + bump SW `VERSION`), rotate the domain, respond to a
      dependency CVE, and add a tool.
- [ ] **E10-T7** — Set a monthly cadence: `npm outdated` + `npm audit`, run the
      full e2e matrix, Lighthouse, review Search Console. Script it in
      `scripts/monthly-check.sh`.
- [ ] **E10-T8** — Publish the repo (public GitHub), add issue templates
      (bug / tool request), a `CODE_OF_CONDUCT.md`, and a "good first tool" label
      pointing at §10 ideas.

---

## 9. TOOL SPEC APPENDIX

> Format per spec: **id — Name** `(category · input · render · lib)` then
> options / algorithm / errors / tests / related. Where an exact expected value
> is given, use it verbatim in a test. "US spelling" applies to `name` and
> `keywords`. All privacy is `{processing:'on-device', network:'none', offline:true}`.
> "empty input → `{output:''}`" unless marked _(generator)_.

### 9.A — WEB (`src/tools/web/`)

#### url-parse — URL Parser (web · text · table · —)

- **summary:** Break a URL into protocol, host, path, query parameters and hash.
- **options:** `base` text='' — optional base URL to resolve a relative input against.
- **algorithm:** `new URL(input, base || undefined)`. Build a `table` with rows:
  `href, protocol, username, password, host, hostname, port, origin, pathname,
decoded pathname (decodeURIComponent), hash`. Then one row per search param as
  `["query: <key>", <value>]` (iterate `url.searchParams`, repeated keys each get
  their own row). `stats`: `{ params: searchParams size }`.
- **errors:** `new URL` throws → `ToolError('That is not a valid URL.', 'Include the scheme, e.g. https://')`.
- **tests:** `https://a:b@ex.com:8443/p/q?x=1&x=2&y=hi#frag` → rows include
  `["protocol","https:"]`, `["port","8443"]`, `["origin","https://ex.com:8443"]`,
  `["query: x","1"]`, `["query: x","2"]`, `["hash","#frag"]`. Relative `/a/b` with
  `base=https://ex.com` → `href` `https://ex.com/a/b`. Empty → `{output:''}`.
  `"not a url"` → throws `/valid URL/`.
- **related:** querystring, basic-auth, utm-builder, punycode

#### basic-auth — HTTP Basic Auth Header (web · text · code · —)

- **options:** `mode` select=`build` (`build`|`decode`); `username` text=''
  [showWhen mode=build]; `password` text='' [showWhen mode=build].
- **algorithm:** build → `output = 'Authorization: Basic ' + btoa(unescape(encodeURIComponent(user + ':' + pass)))`
  (UTF-8 safe). decode → strip a leading `Authorization:` and `Basic ` (case-insensitive),
  `atob` the token, split on the **first** `:` → show `username` and `password`
  on two lines (`Username: ...\nPassword: ...`).
- **errors:** decode with non-base64 → `ToolError('That is not valid base64.')`.
- **tests:** build `Aladdin`/`open sesame` → `Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==`.
  decode that token → `Username: Aladdin\nPassword: open sesame`. UTF-8 password
  `pä$$` round-trips. Empty build (both blank) → `Authorization: Basic Og==`
  (that is `:` encoded) — acceptable; add a `warning` "no username or password".
- **related:** url-parse, jwt-decode, base64

#### data-uri — Data URI Converter (web · text · text · —)

- **options:** `mode` select=`encode` (`encode`|`decode`); `mimeType` text=`text/plain` [showWhen mode=encode];
  `charset` boolean=true (append `;charset=utf-8`) [showWhen mode=encode];
  `encoding` select=`base64` (`base64`|`url`) [showWhen mode=encode].
- **algorithm:** encode → `data:<mime>[;charset=utf-8][;base64],<payload>` where
  payload is `btoa(unescape(encodeURIComponent(text)))` for base64 or
  `encodeURIComponent(text)` for url. decode → regex
  `/^data:([^;,]*)((?:;[^;,]+)*)?(;base64)?,(.*)$/s`; report the mime, params,
  and the decoded text (`decodeURIComponent` or `atob`+UTF-8). If the mime is not
  `text/*` / `application/json` / `image/svg+xml`, output a `note` "binary payload,
  N bytes" and still show the decoded bytes length.
- **errors:** decode of a non-`data:` string → `ToolError('Not a data: URI.')`.
- **tests:** encode `<svg/>` with mime `image/svg+xml` → starts
  `data:image/svg+xml;charset=utf-8;base64,`. Round-trip. decode
  `data:text/plain,hello%20world` → `hello world`.
- **related:** base64, url-encode, image-to-datauri

#### punycode — Punycode / IDN Converter (web · text · text · —)

- **options:** `mode` select=`to-ascii` (`to-ascii`|`to-unicode`).
- **algorithm:** Implement RFC 3492 Punycode + the domain wrapper (split on `.`,
  encode/decode each label, prefix `xn--` for non-ASCII labels on to-ascii;
  strip `xn--` and decode on to-unicode). ~120 lines of well-known reference
  code — port the canonical implementation. Do **not** use the deprecated global
  `punycode` (Node-only).
- **errors:** invalid `xn--` label on to-unicode → `ToolError('Invalid Punycode label.', '<label>')`.
- **tests:** `münchen.de` → `xn--mnchen-3ya.de`; `bücher.example` →
  `xn--bcher-kva.example`; round-trip; `日本語.jp` → `xn--wgv71a119e.jp`;
  ASCII-only `example.com` unchanged both directions.
- **related:** url-parse, url-encode, unicode-escape

#### meta-tags — HTML Meta Tag Generator (web · text · code[html] · —)

- **options:** `title` text='' ; `description` text='' ; `canonicalUrl` text='' ;
  `imageUrl` text='' ; `ogType` select=`website` (`website`|`article`) ;
  `twitterCard` select=`summary_large_image` (`summary`|`summary_large_image`) ;
  `siteName` text=''.
- **algorithm:** Emit, skipping empty fields:
  `<title>`, `<meta name="description">`, `<link rel="canonical">`,
  `<meta property="og:title|og:description|og:url|og:image|og:type|og:site_name">`,
  `<meta name="twitter:card|twitter:title|twitter:description|twitter:image">`.
  Escape `&"<>` in attribute values. `render:'code' language:'html'`.
- **errors:** title AND description both empty → `ToolError('Enter at least a title or description.')`.
- **tests:** title `My Page` + description `Hi` → output contains
  `<title>My Page</title>` and `<meta property="og:title" content="My Page">`.
  A value with `"` is escaped to `&quot;`.
- **related:** robots-txt, gitignore, open-graph (see §10)

#### robots-txt — robots.txt Generator (web · text · code · —)

- **options:** `preset` select=`allow-all` (`allow-all`|`block-all`|`block-ai-bots`|`custom`);
  `userAgents` text=`*` [showWhen preset=custom] (comma-separated);
  `disallow` textarea='' [showWhen preset=custom] (one path/line);
  `allow` textarea='' [showWhen preset=custom];
  `sitemapUrl` text='' ; `crawlDelay` number=0 (min 0 max 60).
- **algorithm:** `allow-all` → `User-agent: *\nAllow: /`. `block-all` →
  `User-agent: *\nDisallow: /`. `block-ai-bots` → a `Disallow: /` block for each
  of: `GPTBot, ChatGPT-User, CCBot, Google-Extended, anthropic-ai, ClaudeBot,
PerplexityBot, Bytespider, Amazonbot, FacebookBot`, then `User-agent: *\nAllow: /`.
  `custom` → one block per user-agent with the allow/disallow lines. Append
  `Crawl-delay: N` (if >0) and `Sitemap: <url>` (if set).
- **tests:** `block-all` → exact `User-agent: *\nDisallow: /\n`. `block-ai-bots`
  output contains `User-agent: GPTBot` and `User-agent: ClaudeBot`. sitemap line
  appears when set.
- **related:** gitignore, editorconfig, meta-tags

#### gitignore — .gitignore Generator (web · text · code · —)

- **options:** `stack` select=`node` (`node`|`python`|`rust`|`go`|`java-maven`|`macos`|`windows`|`linux`|`jetbrains`|`vscode`|`general`).
- **algorithm:** Embed a compact 10–25 line template per stack (dependency dirs,
  build output, env files, logs, coverage, editor/OS cruft). Always prepend the
  `general` block (`.DS_Store`, `Thumbs.db`, `*.log`, `.idea/`, `.vscode/*` with
  `!.vscode/extensions.json`) unless `stack==='general'`. Dedupe lines.
  `render:'code'`.
- **tests:** `node` output contains `node_modules/` and `dist/` and `.env`.
  `python` contains `__pycache__/` and `*.pyc` and `.venv/`. `macos` contains
  `.DS_Store`. No duplicate lines.
- **related:** editorconfig, robots-txt

#### editorconfig — .editorconfig Generator (web · text · code · —)

- **options:** `indentStyle` select=`space` (`space`|`tab`); `indentSize` number=2 (1..8);
  `endOfLine` select=`lf` (`lf`|`crlf`); `charset` select=`utf-8` (`utf-8`|`latin1`);
  `trimTrailingWhitespace` boolean=true; `insertFinalNewline` boolean=true;
  `maxLineLength` number=0 (0..200, 0 = omit).
- **algorithm:** Output `root = true`, a `[*]` section with the chosen keys, and a
  `[*.md]` override setting `trim_trailing_whitespace = false`.
  `max_line_length` only when >0.
- **tests:** defaults → contains `root = true`, `[*]`, `indent_style = space`,
  `indent_size = 2`, `[*.md]`, `trim_trailing_whitespace = false`.
  `indentStyle=tab` → `indent_style = tab` and no `indent_size` line (or
  `indent_size = tab`).
- **related:** gitignore

#### mime-lookup — MIME Type Lookup (web · text · table · —)

- **options:** `mode` select=`ext-to-mime` (`ext-to-mime`|`mime-to-ext`).
- **algorithm:** Embed a map of ~180 common extensions ⇄ MIME types (images,
  docs/office, audio, video, archives, code, fonts, data). `ext-to-mime`: accept
  `png` / `.png` / `photo.png` → the MIME type + a `note` "text" or "binary".
  `mime-to-ext`: a MIME type → all matching extensions as a table.
  `render:'table'`. Unknown → a friendly `note`, **not** an error.
- **tests:** `png` → `image/png`. `.tar.gz` → `application/gzip` (match on last
  ext). `application/json` (mime-to-ext) → includes `json`. `xyzzy` → note
  "Unknown extension".
- **related:** data-uri, http-status, file-metadata

#### port-lookup — Network Port Lookup (web · text · table · —)

- **options:** none.
- **algorithm:** Embed ~160 well-known ports: `{ port, protocol('TCP'|'UDP'|'TCP/UDP'),
service, description }` (20/21 FTP, 22 SSH, 23 Telnet, 25/465/587 SMTP, 53 DNS,
  67/68 DHCP, 80/443 HTTP(S), 110/995 POP3, 123 NTP, 143/993 IMAP, 161/162 SNMP,
  389/636 LDAP(S), 3000/3001 dev, 3306 MySQL, 3389 RDP, 5432 Postgres, 5672
  AMQP, 6379 Redis, 8080/8443 HTTP-alt, 9000 misc, 9092 Kafka, 11211 Memcached,
  27017 MongoDB, …). Input: a port number → that row; a service name substring →
  matching rows; empty → all rows. `render:'table'`
  headers `["Port","Protocol","Service","Description"]`.
- **tests:** `22` → row `["22","TCP","SSH","..."]`. `redis` → row with port 6379.
  empty → many rows (>100).
- **related:** ip-info, http-status, cidr-calculator

### 9.B — WEB / CSS (`src/tools/web/`)

#### css-units — CSS Unit Converter (web · text · table · —)

- **options:** `fromUnit` select=`px` (`px`|`rem`|`em`|`pt`|`pc`|`in`|`cm`|`mm`|`%`);
  `toUnit` select=`rem` (`px`|`rem`|`em`|`pt`|`%`); `rootFontSize` number=16;
  `parentFontSize` number=16; `percentBase` number=16.
- **algorithm:** Parse `input` as `<number><unit?>`; if no unit use `fromUnit`.
  Convert to px: `px`=v; `rem`=v*root; `em`=v*parent; `pt`=v*96/72; `pc`=v*16;
  `in`=v*96; `cm`=v*96/2.54; `mm`=v*96/25.4; `%`=v/100*percentBase. Then px→each
  target. `render:'table'` headers `["Unit","Value"]` with rows px, rem, em, pt,
  %. Round to 4 dp, trim trailing zeros. `stats`: `{ 'as px': ... }`.
- **errors:** non-numeric → `ToolError('Enter a number, optionally with a unit.')`.
- **tests:** `24px` default → `rem` row `1.5`. `1.5rem` with root 16 → `px` `24`.
  `12pt` → `px` `16`. Empty → `{output:''}`.
- **related:** aspect-ratio, gradient-css

#### gradient-css — CSS Gradient Generator (web · text · code[css] · —)

- **options:** `type` select=`linear` (`linear`|`radial`|`conic`); `angle` number=90 (0..360) [showWhen type=linear];
  `shape` select=`ellipse` (`circle`|`ellipse`) [showWhen type=radial];
  `stops` textarea=`#4f46e5 0%\n#ec4899 100%` (one `color [position]` per line).
- **algorithm:** Parse each non-blank stop line: first token = colour (validate
  with a small hex/rgb/hsl/named check), optional 2nd token = position. Emit
  `background-color: <first colour>;` fallback + `background-image:
linear-gradient(<angle>deg, <stops>)` / `radial-gradient(<shape>, <stops>)` /
  `conic-gradient(from <angle>deg, <stops>)`. `render:'code' language:'css'`.
- **errors:** <2 valid stops → `ToolError('Add at least two colour stops.')`;
  bad colour → `ToolError('"<token>" is not a colour.')`.
- **tests:** default → contains `linear-gradient(90deg, #4f46e5 0%, #ec4899 100%)`
  and `background-color: #4f46e5;`. `type=radial` → `radial-gradient(ellipse,`.
- **related:** box-shadow, color-palette, color-blend

#### box-shadow — CSS Box Shadow Generator (web · text · code[css] · —)

- **options:** `offsetX` number=0; `offsetY` number=4; `blur` number=12; `spread` number=0;
  `color` text=`rgba(0,0,0,0.15)`; `inset` boolean=false; `layers` number=1 (1..6).
- **algorithm:** For `layers>1`, emit N comma-separated shadows with progressively
  larger offset/blur and lower alpha (multiply base by `i/layers` for geometry,
  scale alpha down). Output `box-shadow: [inset ]Xpx Ypx Bpx Spx color[, ...];`.
  `render:'code' language:'css'`. Ignore `input.text`.
- **tests:** defaults → `box-shadow: 0px 4px 12px 0px rgba(0,0,0,0.15);`.
  `inset=true` → starts `box-shadow: inset `. `layers=3` → two commas.
- **related:** gradient-css, glassmorphism (see §10)

#### cubic-bezier — Cubic Bezier Explorer (web · text · table · —)

- **options:** `samples` number=11 (3..25).
- **algorithm:** Parse `input` as four comma/space-separated numbers `x1,y1,x2,y2`;
  require `0<=x1<=1` and `0<=x2<=1` (y unrestricted). Compute the CSS easing
  `y` for `samples` evenly spaced `t` values by solving the Bézier `x(u)=t`
  numerically (Newton + bisection fallback) then evaluating `y(u)`. Name the
  nearest keyword easing by Euclidean distance of `(x1,y1,x2,y2)` to:
  `ease .25,.1,.25,1`; `linear 0,0,1,1`; `ease-in .42,0,1,1`;
  `ease-out 0,0,.58,1`; `ease-in-out .42,0,.58,1`. Output the
  `cubic-bezier(x1, y1, x2, y2)` string as a `stats` entry + the nearest name,
  and a `table` headers `["t","progress"]`.
- **errors:** not four numbers, or x out of `[0,1]` → `ToolError`.
- **tests:** `0.25,0.1,0.25,1` → nearest = `ease`; table has 11 rows; row t=0 →
  progress `0`, t=1 → `1`. `0,0,1,1` → nearest `linear`, progress ≈ t.
- **related:** gradient-css, animate (see §10)

### 9.C — WEB LOOKUPS (`src/tools/web/`)

#### http-status — HTTP Status Code Reference (web · text · table · —)

- **options:** `category` select=`all` (`all`|`1xx`|`2xx`|`3xx`|`4xx`|`5xx`).
- **algorithm:** Embed the full standard list (100–103, 200–208, 226, 300–308,
  400–418, 421–429, 431, 451, 500–511) as `{ code, name, meaning }`. Input: a
  code number → that one row; free text → rows whose name/meaning contains it
  (case-insensitive); empty → all (filtered by `category`). `render:'table'`
  headers `["Code","Name","Meaning"]`.
- **tests:** `404` → `["404","Not Found",...]`. `teapot` → row `418`.
  `category=5xx`, empty input → all rows start with `5`. `429` present.
- **related:** port-lookup, mime-lookup, user-agent

#### user-agent — User-Agent Parser (web · text · table · —)

- **options:** none.
- **algorithm:** Pure-JS heuristic regex parser. Detect, in order: bots
  (`bot|crawler|spider|curl|wget|python-requests|Googlebot|bingbot|DuckDuckBot|
Slackbot|facebookexternalhit`), then browser (Edge `Edg/`, Opera `OPR/`,
  Samsung `SamsungBrowser/`, Chrome `Chrome/` (not Edge/OPR), Firefox
  `Firefox/`, Safari `Version/.*Safari`, IE `MSIE|Trident`), OS
  (`Windows NT x.y` → 10/11/8.1/…; `Mac OS X x_y`; `Android x`; `iPhone OS x_y`;
  `Linux`; `CrOS`), engine (`AppleWebKit`→WebKit/Blink, `Gecko/`→Gecko,
  `Trident`→Trident), device type (`Mobile`→mobile, `Tablet|iPad`→tablet, bot→bot,
  else desktop). `render:'table'` headers `["Field","Value"]` rows: Browser,
  Version, OS, OS version, Engine, Device type, Is bot.
- **errors:** empty → `ToolError('Paste a User-Agent string.')`.
- **tests:** `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36` → Browser `Chrome`, OS
  `Windows`, OS version `10`, Engine `Blink`, Device `desktop`, Is bot `No`.
  `curl/8.4.0` → Is bot `Yes`, Browser `curl`.
- **related:** http-status, ip-info

### 9.D — COLOUR (`src/tools/color/`)

> Do **not** import `color-convert.tool.ts`. Write a small self-contained parser
> in each file: accept `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()/rgba()`
> (comma or space syntax), `hsl()/hsla()`, and the 148 CSS named colours. A
> shared ~60-line helper copied into each file is fine.

#### color-contrast — Color Contrast Checker (color · text · table · —)

- **options:** `second` textarea=`#ffffff` (the background colour).
- **algorithm:** Parse fg=`input`, bg=`second`. Relative luminance per WCAG 2.1
  (sRGB → linear, `0.2126R+0.7152G+0.0722B`). Ratio `(L1+0.05)/(L2+0.05)`.
  `render:'table'` headers `["Check","Result"]` rows: `Contrast ratio` `X.XX:1`;
  `AA normal text (>=4.5)` Pass/Fail; `AA large text (>=3)`; `AAA normal (>=7)`;
  `AAA large (>=4.5)`; `Graphics/UI (>=3)`; plus an APCA Lc **approximation**
  (label it "approx"). `stats`: `{ ratio: 'X.XX:1' }`.
- **errors:** bad colour → `ToolError('"<x>" is not a colour.')`.
- **tests:** fg `#000000` bg `#ffffff` → ratio `21.00:1`, all Pass. fg `#777`
  bg `#fff` → ratio ≈ `4.48:1` → AA normal Fail, AA large Pass. Empty input →
  `{output:''}`.
- **related:** color-convert, color-palette, color-name

#### color-palette — Color Palette Generator (color · text · colors · —)

- **options:** `scheme` select=`tints-shades`
  (`tints-shades`|`monochromatic`|`complementary`|`analogous`|`triadic`|`tetradic`|`split-complementary`);
  `count` number=7 (3..12).
- **algorithm:** Parse base → HSL. `tints-shades`: vary L from ~10% to ~95% in
  `count` steps at the base H/S. `monochromatic`: vary S and L slightly.
  `complementary`: base + (H+180). `analogous`: H ± 30° steps. `triadic`: H,
  H+120, H+240. `tetradic`: H, H+90, H+180, H+270. `split-complementary`: H,
  H+150, H+210. Fill/repeat to `count`. Output `JSON.stringify(hexArray)`,
  `render:'colors'`.
- **errors:** bad base colour → `ToolError`.
- **tests:** `#3b82f6` scheme `complementary` → array length 2, `[0]` ≈ `#3b82f6`
  (allow ±1 per channel), `[1]` hue ≈ base+180. `triadic` → length 3. `count`
  respected for `tints-shades`.
- **related:** color-convert, gradient-css, color-blend

#### color-blend — Color Blend / Mix (color · text · colors · —)

- **options:** `second` text=`#ffffff`; `ratio` range=50 (0..100); `space` select=`rgb` (`rgb`|`hsl`).
- **algorithm:** Parse A=`input`, B=`second`. Mix at `ratio/100` (0 = all A) in
  the chosen space (rgb: per-channel lerp; hsl: lerp H along the shorter arc, S,
  L). Output `JSON.stringify([A_hex, blended_hex, B_hex])`, `render:'colors'`.
  `stats`: blended in `hex`, `rgb()`, `hsl()`.
- **errors:** bad colour → `ToolError`.
- **tests:** A `#000000` B `#ffffff` ratio 50 rgb → blended `#808080` (128,128,128).
  ratio 0 → blended == A. ratio 100 → blended == B.
- **related:** color-palette, gradient-css

#### color-random — Random Color Generator (color · text · colors · —) _(generator)_

- **options:** `count` number=8 (1..48); `format` select=`hex` (`hex`|`rgb`|`hsl`);
  `style` select=`any` (`any`|`warm`|`cool`|`pastel`|`vivid`|`grayscale`|`earth`).
- **algorithm:** `crypto.getRandomValues` for randomness. `style` constrains HSL:
  warm H∈[0,60]∪[300,360]; cool H∈[180,300]; pastel S∈[25,45] L∈[80,92];
  vivid S∈[80,100] L∈[45,60]; grayscale S=0; earth H∈[20,45] S∈[30,60] L∈[25,55];
  any = uniform. Output `JSON.stringify` array in the chosen format,
  `render:'colors'`.
- **tests:** `count=12` → array length 12, all valid hex when `format=hex`.
  `style=grayscale` → every colour has R==G==B. Deterministic length; do not
  assert exact colours.
- **related:** color-palette, random-data

#### color-blindness — Colour Blindness Simulator (color · text · colors · —)

- **options:** `type` select=`deuteranopia` (`protanopia`|`deuteranopia`|`tritanopia`|`achromatopsia`);
  `severity` range=100 (0..100).
- **algorithm:** Input = one colour per line (hex/rgb/etc), OR a single colour.
  Apply the standard CVD simulation matrix (Brettel/Viénot linear-RGB matrices;
  use the well-known 3×3 matrices per type) at `severity/100` blend with the
  original. Output `JSON.stringify([...originals, '—', ...simulated])` OR two
  arrays — simplest: output the simulated list only, `render:'colors'`, and put
  the originals in a `note`. `achromatopsia` = luminance greyscale.
- **errors:** no valid colours → `ToolError`.
- **tests:** pure red `#ff0000` deuteranopia severity 100 → a distinct
  yellow-brown (assert it changed and G channel rose). severity 0 → unchanged.
  achromatopsia → R==G==B.
- **related:** color-contrast, color-palette

#### color-name — Nearest CSS Colour Name (color · text · table · —)

- **options:** none.
- **algorithm:** Parse input colour → RGB. Compute distance (weighted Euclidean
  or CIE76 in Lab — Lab preferred) to all 148 CSS named colours; return the
  nearest 5. `render:'table'` headers `["Name","Hex","Distance"]`, closest first.
  `stats`: `{ 'exact match': 'yes'|'no' }`.
- **errors:** bad colour → `ToolError`.
- **tests:** `#ff0000` → top row `red` distance `0`. `#ee0000` → top row `red`
  (small distance). `#7fffd4` → `aquamarine` exact.
- **related:** color-convert, color-contrast, color-palette

### 9.E — DATE & TIME (`src/tools/datetime/`)

> `Date` and `Date.now()` **are** allowed in tool code. Tests that assert a
> relative-time or "now" value must pass a fixed reference — so give these tools
> an optional way to accept the reference instant (an `asOf` / `second` option or
> the input itself). Never make a test depend on the wall clock.

#### timestamp — Unix Timestamp Converter (datetime · text · table · —)

- **options:** `unit` select=`auto` (`auto`|`seconds`|`milliseconds`);
  `timezone` select=`utc` (`utc`|`local`); `output` select=`all` (`all`|`iso`|`rfc2822`|`relative`|`epoch`).
- **algorithm:** input empty → `new Date()`. Numeric input → epoch: `auto` treats
  `abs(n) <= 1e11` as seconds else ms. Non-numeric → `new Date(input)` (throw if
  `NaN`). `all` → `render:'table'` headers `["Format","Value"]` rows: Unix
  seconds, Unix milliseconds, ISO 8601, RFC 2822 (`.toUTCString()` or local),
  RFC 3339, Day of week, Relative (see below). Relative: diff vs `new Date()`;
  `"in 3 days"` / `"5 minutes ago"` with units s/min/h/day/mo/yr. For non-`all`
  output the single value as `text`.
- **errors:** unparseable → `ToolError('Enter a Unix timestamp or a date.', 'e.g. 1700000000 or 2024-01-31')`.
- **tests:** `1700000000` (seconds) → ISO `2023-11-14T22:13:20.000Z`. `0` →
  `1970-01-01T00:00:00.000Z`. `2024-02-29T00:00:00Z` → Unix seconds `1709164800`.
  empty → a table (don't assert the value).
- **related:** timezone-convert, date-diff, duration-convert, cron-parser

#### timezone-convert — Timezone Converter (datetime · text · table · —)

- **options:** `fromZone` select=`UTC` (list ~28 IANA zones: UTC, America/New_York,
  America/Chicago, America/Denver, America/Los_Angeles, America/Sao_Paulo,
  Europe/London, Europe/Paris, Europe/Berlin, Europe/Moscow, Africa/Cairo,
  Africa/Johannesburg, Asia/Kolkata, Asia/Dubai, Asia/Karachi, Asia/Dhaka,
  Asia/Bangkok, Asia/Singapore, Asia/Shanghai, Asia/Tokyo, Asia/Seoul,
  Australia/Perth, Australia/Sydney, Pacific/Auckland, Pacific/Honolulu);
  `targets` select=`world` (`us`|`europe`|`asia`|`world` — each a curated ~8-zone list).
- **algorithm:** Parse `input` (empty → now) as a **wall-clock** time in
  `fromZone`. To interpret a wall-clock string in a named zone without a library:
  format `new Date(inputAsUTC)` in `fromZone` via `Intl.DateTimeFormat` parts,
  compute the offset by comparing, adjust (one iteration handles all but the DST
  gap edge — acceptable, note it). Then render that instant for each target zone
  via `Intl.DateTimeFormat(undefined, { timeZone, weekday, year, month, day,
hour, minute, timeZoneName:'shortOffset' })`. `render:'table'` headers
  `["Zone","Local time"]`.
- **errors:** unparseable input → `ToolError`.
- **tests:** input `2024-01-15 12:00`, fromZone `UTC`, targets `world` → the
  `Asia/Kolkata` row shows `17:30` (UTC+5:30) and `America/New_York` shows
  `07:00` (EST). Assert substrings, not the whole formatted string.
- **related:** timestamp, date-diff, week-number

#### duration-convert — Duration Converter (datetime · text · table · —)

- **options:** `mode` select=`auto` (`auto`|`from-seconds`);
  `output` select=`all` (`all`|`human`|`iso8601`|`clock`|`seconds`|`components`).
- **algorithm:** Parse input as total seconds if numeric & `from-seconds` or
  `auto`+bare number; else parse `human` (`1h 2m 3s`, `1 hour 2 minutes`,
  `90m`), `iso8601` (`PT1H2M3S`, `P1DT2H`), or `clock` (`HH:MM:SS`, `MM:SS`).
  Compute total seconds → emit: human (`1d 2h 3m 4s`, omit zero units),
  iso8601 (`P…T…`), clock (`HH:MM:SS`, `H` may exceed 24), seconds, components
  (`{days,hours,minutes,seconds}` as a table). `all` → `render:'table'`.
- **errors:** unparseable → `ToolError('Could not read that duration.', 'Try 1h 30m, PT1H30M, or 01:30:00')`.
- **tests:** `3661` → human `1h 1m 1s`, iso `PT1H1M1S`, clock `01:01:01`.
  `PT2H` → seconds `7200`. `1d 12h` → seconds `129600`. `01:30` (mm:ss) →
  seconds `90`.
- **related:** timestamp, date-diff

#### date-diff — Date Difference Calculator (datetime · text · table · —)

- **options:** `second` text='' (the other date; empty → now).
- **algorithm:** A=`input` (empty → now), B=`second` (empty → now). `render:'table'`
  rows: total ms, seconds, minutes, hours, days, weeks; calendar breakdown
  `"Y years, M months, D days"` (borrow-based, A→B); total complete months;
  business days (Mon–Fri) between (exclusive of weekends, count each calendar day
  once, direction-signed count magnitude); `"A is before/after/equal to B"`.
- **errors:** either unparseable → `ToolError`.
- **tests:** A `2020-01-01` B `2021-01-01` → days `366` (leap), calendar
  `1 years, 0 months, 0 days`. A `2024-01-01` B `2024-01-08` → business days `5`.
  A after B → magnitude same, note says "after".
- **related:** date-add, age-calculator, week-number

#### date-add — Date Add / Subtract (datetime · text · table · —)

- **options:** `operation` select=`add` (`add`|`subtract`); `years` number=0;
  `months` number=0; `weeks` number=0; `days` number=0; `hours` number=0; `minutes` number=0.
- **algorithm:** Base=`input` (empty → now). Apply years then months
  (calendar-aware: clamp day-of-month, e.g. Jan 31 + 1 month = Feb 28/29), then
  weeks*7+days as days, then hours, minutes as time. Subtract negates. `render:'table'`
  rows: resulting ISO 8601, RFC 2822, weekday, "N days from base" (signed).
- **errors:** unparseable base → `ToolError`.
- **tests:** `2024-01-31` + 1 month → `2024-02-29` (leap). `2023-01-31` + 1 month
  → `2023-02-28`. `2024-03-01` − 1 day → `2024-02-29`. `2024-01-01T00:00Z` +
  90 minutes → `...T01:30:00`.
- **related:** date-diff, age-calculator

#### age-calculator — Age Calculator (datetime · text · table · —)

- **options:** `asOf` text='' (reference date; empty → today).
- **algorithm:** birth=`input`. If birth > asOf or unparseable → `ToolError`.
  `render:'table'` rows: age `"Y years, M months, D days"`; total days, weeks,
  months, hours; day of week born; next birthday date + days until (from asOf);
  western zodiac sign (date-range table).
- **tests:** birth `2000-01-01`, asOf `2024-01-01` → age `24 years, 0 months,
0 days`, day born `Saturday`. birth `2000-06-15`, asOf `2024-06-14` → age
  `23 years, 11 months, 30 days` (or `... 29/30` — assert years `23`). future
  birthdate → throws.
- **related:** date-diff, week-number

#### week-number — Week Number & Calendar Facts (datetime · text · table · —)

- **options:** none (input empty → today).
- **algorithm:** For the given date: ISO 8601 week number + ISO week-year
  (Thursday rule), day of year (1–366), days remaining in year, quarter (Q1–Q4),
  day of quarter, is leap year, ordinal date `YYYY-DDD`, start (Mon) and end
  (Sun) of that ISO week as ISO dates. `render:'table'`.
- **errors:** unparseable → `ToolError`.
- **tests:** `2024-01-01` → ISO week `1`, ISO week-year `2024`, day of year `1`,
  leap year `Yes`. `2021-01-01` → ISO week `53`, ISO week-year `2020`.
  `2024-12-31` → day of year `366`.
- **related:** date-diff, timestamp

### 9.F — NUMBERS & MATHS (`src/tools/numbers/`)

#### unit-convert — Unit Converter (numbers · text · table · —)

- **options:** `category` select=`length`
  (`length`|`mass`|`temperature`|`volume`|`area`|`speed`|`data-storage`|`time`|`pressure`|`energy`|`angle`);
  `from` text='' ; `to` text=''.
- **algorithm:** Embed a factor table per category (value in SI base units per 1
  of the unit). `input` = the numeric value. Parse `from`/`to` against the
  category's unit names/symbols/aliases (case-insensitive). Convert
  `value * factor[from] / factor[to]`. **Temperature** is special: convert to
  Kelvin then out (C: +273.15; F: (x−32)*5/9+273.15; R: x*5/9; K: x). `render:'table'`
  headers `["Unit","Value"]` — the result in `to` **and** the value expressed in
  every unit of the category. `stats`: `{ '<from> → <to>': '<result>' }`.
- **errors:** unknown `from`/`to` for the category → `ToolError` listing the
  valid units; non-numeric value → `ToolError`.
- **tests:** category `length`, `1` `km` → `mi` ≈ `0.621371`. category
  `temperature`, `100` `C` → `F` `212`, `K` `373.15`. category `data-storage`,
  `1` `GiB` → `MiB` `1024`. unknown unit → throws with a unit list.
- **related:** css-units, data-size, scientific-notation

#### roman-numeral — Roman Numeral Converter (numbers · text · code · —)

- **options:** `mode` select=`auto` (`auto`|`to-roman`|`to-number`);
  `extended` boolean=false (vinculum notation `(IV)`=4000, up to 3,999,999).
- **algorithm:** to-roman: standard subtractive table; without `extended`, range
  1..3999. With `extended`, values ≥4000 use parenthesised thousands, e.g.
  `4000` → `(IV)`, `1234567` → `(MCCXXXIV)DLXVII`. to-number: parse a roman
  string (validate strictly — no `IIII`, no `VX`), incl. `(...)` groups when
  `extended`. `auto`: if input matches `^[IVXLCDM()]+$` (case-insensitive) →
  to-number, else to-roman.
- **errors:** out of range / invalid roman → `ToolError`.
- **tests:** `2024` → `MMXXIV`. `MMXXIV` → `2024`. `4` → `IV`. `IIII` → throws.
  `3999` → `MMMCMXCIX`. `4000` no extended → throws; with extended → `(IV)`.
- **related:** number-to-words, number-base

#### number-to-words — Number to Words (numbers · text · text · —)

- **options:** `style` select=`cardinal` (`cardinal`|`ordinal`);
  `letterCase` select=`lower` (`lower`|`sentence`|`title`|`upper`);
  `useAnd` boolean=true (`one hundred and one` vs `one hundred one`).
- **algorithm:** Support integers up to 10^21 (use BigInt for the integer part),
  negatives (`negative ...`), and up to ~4 decimal places read digit-by-digit
  after `point`. Short-scale (`billion`=10^9). Ordinal converts the final word
  (`twenty` → `twentieth`, `three` → `third`). Apply the case transform last.
- **errors:** non-numeric → `ToolError`.
- **tests:** `0` → `zero`. `1234` → `one thousand two hundred and thirty-four`.
  `1234` useAnd=false → `one thousand two hundred thirty-four`. `-5` →
  `negative five`. `3.14` → `three point one four`. `21` ordinal →
  `twenty-first`. `1000000` → `one million`. title case → `One Thousand ...`.
- **related:** roman-numeral, fraction

#### percentage — Percentage Calculator (numbers · text · text · —)

- **options:** `mode` select=`percent-of`
  (`percent-of`|`what-percent`|`percent-change`|`increase-by`|`decrease-by`);
  `a` number=0; `b` number=0.
- **algorithm:** `percent-of`: `a% of b = a/100*b`. `what-percent`: `a is
(a/b*100)% of b`. `percent-change`: `((b-a)/a*100)%` (signed). `increase-by`:
  `a*(1+b/100)`. `decrease-by`: `a*(1-b/100)`. Output the number + a one-line
  explanation sentence. Ignore `input.text` (options only). `stats`: the result.
- **errors:** division by zero (`what-percent` b=0, `percent-change` a=0) →
  `ToolError('Cannot divide by zero.')`.
- **tests:** `percent-of` a=15 b=200 → `30`. `what-percent` a=30 b=200 → `15%`.
  `percent-change` a=200 b=250 → `+25%`. `increase-by` a=100 b=20 → `120`.
  b=0 what-percent → throws.
- **related:** ratio, fraction, statistics

#### statistics — Statistics Calculator (numbers · text · table · —)

- **options:** none.
- **algorithm:** Tokenise `input` on `[\s,;]+`; keep finite numbers, count
  skipped non-numeric tokens (put in a `note`). Compute: count, sum, min, max,
  range, mean, median, mode(s) (list, or "none" if all unique), population &
  sample variance & stdev, Q1/Q2/Q3 (linear interpolation, "exclusive" or
  "inclusive" — pick inclusive/`R-7`, note it), IQR, mean absolute deviation,
  coefficient of variation (%). `render:'table'` headers `["Metric","Value"]`.
- **errors:** zero numeric values → `ToolError('Enter at least one number.')`.
- **tests:** `2 4 4 4 5 5 7 9` → mean `5`, median `4.5`, mode `4`, population
  stdev `2`, sample stdev ≈ `2.138`. `1,2,3` → Q1 `1.5`, Q3 `2.5` (R-7). skipped
  tokens counted.
- **related:** percentage, random-number, gcd-lcm

#### prime-tools — Prime Number Tools (numbers · text · table · —)

- **options:** none.
- **algorithm:** Parse `input` as a positive integer (BigInt for parsing; use
  `Number` when ≤ 2^53). `render:'table'` rows: is prime; prime factorisation
  (`2^3 · 5` form); all divisors (list if ≤ 64, else the count); sum of divisors;
  is perfect / abundant / deficient; Euler totient φ(N); next prime; previous
  prime (or "none" for N ≤ 2). Trial division only for N ≤ 1e14; larger → a
  `note` "too large for factorisation" and still give is-prime via Miller–Rabin
  (deterministic bases for < 3.3e24).
- **errors:** non-integer / N < 1 → `ToolError`.
- **tests:** `28` → is prime `No`, factorisation `2^2 · 7`, divisors
  `1, 2, 4, 7, 14, 28`, perfect `Yes`, φ `12`, next prime `29`, previous `23`.
  `97` → is prime `Yes`. `1` → is prime `No`, previous prime `none`.
- **related:** gcd-lcm, number-base, fraction

#### random-number — Random Number Generator (numbers · text · code · —) _(generator)_

- **options:** `mode` select=`integers` (`integers`|`decimals`|`dice`|`coin`);
  `min` number=1; `max` number=100; `count` number=5 (1..1000);
  `unique` boolean=false [showWhen mode=integers];
  `decimals` number=2 (0..10) [showWhen mode=decimals];
  `dice` text=`3d6` [showWhen mode=dice].
- **algorithm:** `crypto.getRandomValues` + **rejection sampling** for a uniform
  integer in `[min,max]` (no modulo bias). `unique` → error if
  `max-min+1 < count`. `decimals` → `min + random_float * (max-min)` rounded.
  `dice` → parse `NdM(+K|-K)`; roll N d M, show each roll and the total.
  `coin` → `Heads`/`Tails` × count. `render:'code'`, one value per line.
- **errors:** `min > max`; `unique` range too small; bad dice string → `ToolError`.
- **tests:** `mode=integers count=1000 min=1 max=6` → 1000 lines, every value in
  1..6. `unique count=5 min=1 max=5` → the multiset `{1,2,3,4,5}`. `unique
count=5 min=1 max=3` → throws. `dice=2d6` → two roll lines + `Total: N` with
  N in 2..12.
- **related:** random-string, random-picker, random-data

#### gcd-lcm — GCD & LCM Calculator (numbers · text · table · —)

- **options:** none.
- **algorithm:** Tokenise integers (`[\s,;]+`). Compute GCD (Euclid, fold) and LCM
  (`a*b/gcd`, **BigInt** to avoid overflow). `render:'table'` rows: GCD, LCM,
  "pairwise coprime" (Yes/No), then one row per input with its prime
  factorisation.
- **errors:** non-integer / fewer than 2 numbers → `ToolError`.
- **tests:** `12 18` → GCD `6`, LCM `36`. `4 6 8` → GCD `2`, LCM `24`.
  `8 9` → pairwise coprime `Yes`. `4 6` → `No`.
- **related:** prime-tools, fraction, ratio

#### scientific-notation — Scientific Notation Converter (numbers · text · table · —)

- **options:** `mode` select=`auto` (`auto`|`to-scientific`|`to-engineering`|`to-decimal`);
  `sigFigs` number=6 (1..15).
- **algorithm:** Parse `input` (accepts `1.23e4`, `1.23E4`, `12300`, `0.0012`).
  scientific: `m × 10^n`, `1 ≤ |m| < 10`; also give the `1.23e4` form.
  engineering: exponent a multiple of 3. decimal: expand to a plain string
  (no precision loss for exponents in a sane range; for huge exponents use
  BigInt string building). `render:'table'` rows: Scientific, Engineering,
  E-notation, Decimal. `auto`: if input has an exponent → to-decimal else
  to-scientific.
- **errors:** non-numeric → `ToolError`.
- **tests:** `12345` → scientific `1.2345 × 10^4`, engineering `12.345 × 10^3`,
  E-notation `1.2345e4`. `0.0012` → scientific `1.2 × 10^-3`. `1.5e3` (auto) →
  decimal `1500`.
- **related:** unit-convert, number-base, fraction

#### fraction — Fraction Converter (numbers · text · table · —)

- **options:** `mode` select=`decimal-to-fraction` (`decimal-to-fraction`|`fraction-to-decimal`);
  `maxDenominator` number=1000000; `mixedNumber` boolean=true.
- **algorithm:** decimal-to-fraction: detect a repeating decimal in the input
  (`0.1(6)` or `0.1[6]` notation, or a long run) → exact fraction; else use the
  continued-fraction / Stern–Brocot best approximation with `maxDenominator`.
  fraction-to-decimal: parse `a/b` or `c a/b` (mixed) → decimal, marking the
  repeating block as `0.1(6)`. `render:'table'` rows: Fraction, Simplified,
  Mixed number, Decimal, Percentage.
- **errors:** invalid / divide by zero → `ToolError`.
- **tests:** `0.75` → simplified `3/4`, percentage `75%`. `0.333333` →
  `1/3` (via repeating detection or approximation). `3/4` (fraction-to-decimal)
  → decimal `0.75`. `1/3` → decimal `0.(3)`. `7/2` mixed → `3 1/2`.
- **related:** ratio, percentage, scientific-notation

#### ratio — Ratio Calculator (numbers · text · table · —)

- **options:** `mode` select=`simplify` (`simplify`|`scale`|`convert`);
  `scaleValue` number=0 [showWhen mode=scale]; `scalePart` number=1 (1..10) [showWhen mode=scale].
- **algorithm:** Parse `input` like `16:9` or `2:3:5` (also `16/9`, `16 to 9`).
  simplify: divide all parts by their GCD. scale: given `scaleValue` for the
  `scalePart`-th part (1-indexed), solve the others proportionally. convert
  (2-part only): show as fraction, decimal, percentage, and `1:n`. `render:'table'`.
- **errors:** bad ratio / part index out of range / zero part on scale → `ToolError`.
- **tests:** `1920:1080` simplify → `16:9`. `16:9` convert → decimal `1.777…`,
  `1:0.5625`. `2:3` scale scaleValue=10 scalePart=1 → `10:15`.
- **related:** fraction, percentage, aspect-ratio, gcd-lcm

#### base-n-logic — Programmer Number Explorer (numbers · text · table · —)

- **options:** `bits` select=`32` (`8`|`16`|`32`|`64`); `signed` boolean=true.
- **algorithm:** Parse `input` (accepts `0x`, `0b`, `0o`, decimal, leading `-`).
  Use BigInt. `render:'table'` rows: decimal, hex, octal, binary (grouped by 4),
  two's-complement representation at `bits` width, and the value's bit count /
  set-bit count (popcount), and (if it fits) as a signed vs unsigned
  interpretation. This overlaps `number-base` but adds width/signedness context.
- **errors:** out of range for `bits` → `warning` (not error), still show wrapped.
- **tests:** `255` bits=8 → binary `1111 1111`, hex `0xFF`, popcount `8`.
  `-1` bits=8 signed → two's complement `1111 1111`. `0b1010` → decimal `10`.
- **related:** number-base, chmod-calculator, programmer-calculator
- **note:** _Optional / lower priority — `number-base` + `programmer-calculator`
  (E4) may cover this. Skip if time-constrained._

#### roman-numeral-date — Roman Numeral Date (numbers · text · text · —)

- **note:** _Optional novelty tool. Convert `2024-01-31` → `XXXI · I · MMXXIV`
  and back. Only build if §10 backlog is empty. Spec: `mode` add/parse; separator
  option. Standard roman conversion per part._

### 9.G — GENERATORS (`src/tools/generators/`)

#### nanoid — NanoID Generator (generators · text · code · —) _(generator)_

- **options:** `size` number=21 (2..64); `alphabet` select=`url-safe`
  (`url-safe`|`lowercase`|`uppercase`|`numbers`|`hex`|`alphanumeric`|`custom`);
  `custom` text='' [showWhen alphabet=custom]; `count` number=1 (1..200).
- **algorithm:** `url-safe` = `A-Za-z0-9_-` (64 chars). Use the **unbiased**
  nanoid algorithm: `mask = (2 << Math.floor(Math.log2(alphabet.length - 1))) - 1`,
  read random bytes, `byte & mask`, reject if `>= alphabet.length`. `render:'code'`,
  one id per line. `stats`: `{ 'entropy per id': '<bits> bits' }` = `size *
log2(alphabet.length)`.
- **errors:** empty custom alphabet, or alphabet length < 2 → `ToolError`.
- **tests:** `size=21` default → each line length 21, only `[A-Za-z0-9_-]`.
  `alphabet=hex size=8` → `[0-9a-f]{8}`. `count=50` → 50 lines, all unique.
- **related:** uuid, ulid, random-string

#### ulid — ULID Generator (generators · text · code · —) _(generator)_

- **options:** `count` number=1 (1..200); `monotonic` boolean=false; `lowercase` boolean=false.
- **algorithm:** Crockford base32 (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`, no
  I/L/O/U). 26 chars = 48-bit ms timestamp (`Date.now()`, 10 chars) + 80-bit
  randomness (16 chars, `crypto.getRandomValues`). `monotonic`: within the same
  ms, increment the random component instead of re-rolling. `lowercase` →
  lowercase output. `render:'code'`. `stats`: decoded timestamp of the first ULID
  (ISO).
- **tests:** each line matches `/^[0-9A-HJKMNP-TV-Z]{26}$/`. `count=10` → sorted
  order equals generation order (timestamps non-decreasing). Decoding
  the first 10 chars back to ms is within a few seconds of `Date.now()` (compute
  in the test, allow a window).
- **related:** uuid, nanoid, snowflake

#### random-data — Fake Data Generator (generators · text · code · —) _(generator)_

- **options:** `dataset` select=`person`
  (`person`|`contact`|`address`|`network`|`commerce`|`company`|`lorem`|`ids`);
  `rows` number=10 (1..500); `format` select=`json` (`json`|`csv`|`sql`);
  `tableName` text=`data` [showWhen format=sql].
- **algorithm:** Embed small lists (first names ×~60, last names ×~60, street
  words, cities ×~40, TLDs, product adjectives/nouns, industries, lorem words).
  `crypto.getRandomValues` for all choices. Field sets: person
  `{firstName,lastName,fullName,age,gender}`; contact adds `email,phone`; address
  `{street,city,state,zip,country}`; network
  `{ipv4,ipv6,mac,domain,url,userAgent}`; commerce
  `{product,category,price,currency,sku}`; company
  `{name,catchPhrase,industry,domain}`; lorem `{sentence}`; ids
  `{uuid,objectId,nanoid,ulid}`. Emit as pretty JSON array / CSV (with header) /
  `INSERT INTO <table> (...) VALUES (...);` lines. `render:'code'` with
  `language` per format.
- **tests:** `dataset=person rows=5 format=json` → `JSON.parse` gives an array of
  5 objects each with `firstName`. `format=csv` → 6 lines (header + 5).
  `format=sql` → 5 lines starting `INSERT INTO data`.
- **related:** random-string, lorem-ipsum, uuid

#### lorem-ipsum — Lorem Ipsum Generator (generators · text · code|text · —) _(generator)_

- **options:** `unit` select=`paragraphs` (`paragraphs`|`sentences`|`words`|`list-items`);
  `count` number=3 (1..200); `startWithLorem` boolean=true;
  `format` select=`plain` (`plain`|`html`|`markdown`).
- **algorithm:** Classic lorem word bank (~180 words). Sentence = 8–15 words,
  capitalised, ends `.`. Paragraph = 3–6 sentences. `startWithLorem` → first
  sentence begins `Lorem ipsum dolor sit amet, consectetur adipiscing elit`.
  html: `<p>…</p>` / `<ul><li>…</li></ul>`. markdown: blank-line separated /
  `- ` items. `render:'code'` when format≠plain else `text`. Use
  `crypto.getRandomValues` (or a seeded PRNG) for word/length choice.
- **tests:** `unit=words count=5` → 5 space-separated words. `unit=paragraphs
count=2 format=html` → contains `<p>` twice. `startWithLorem` → output starts
  `Lorem ipsum dolor sit amet`.
- **related:** random-data, text-repeat

#### qr-code — QR Code Generator (generators · text · image · qrcode-generator)

- **options:** `contentType` select=`text` (`text`|`url`|`wifi`|`email`|`sms`|`geo`|`tel`);
  `wifiPassword` text='' [showWhen contentType=wifi];
  `wifiEncryption` select=`WPA` (`WPA`|`WEP`|`nopass`) [showWhen contentType=wifi];
  `ecc` select=`M` (`L`|`M`|`Q`|`H`); `cellSize` number=6 (2..16); `margin` number=4 (0..8);
  `dark` text=`#000000`; `light` text=`#ffffff`.
- **algorithm:** Build the payload: `text`/`url` → the input as-is; `wifi` →
  `WIFI:T:<enc>;S:<input>;P:<pw>;;`; `email` → `mailto:<input>`; `sms` →
  `smsto:<input>`; `tel` → `tel:<input>`; `geo` → `geo:<input>`.
  `import qrcode from 'qrcode-generator'; const qr = qrcode(0, ecc);
qr.addData(payload); qr.make();`. Then **build the SVG yourself** from
  `qr.getModuleCount()` and `qr.isDark(r,c)`: a `<svg>` with `width/height =
(count + margin*2) * cellSize`, a background `<rect>` in `light`, and one
  `<rect>` per dark module in `dark` (offset by `margin*cellSize`).
  `output = 'data:image/svg+xml;base64,' + btoa(svg)`, `render:'image'`,
  `filename:'qr.svg'`. `credits: [{ name:'qrcode-generator',
url:'https://github.com/kazuhikoarase/qrcode-generator', license:'MIT' }]`.
- **errors:** payload too long for any version at the chosen ecc (qrcode-generator
  throws) → `ToolError('Too much data for one QR code.', 'Shorten the text or lower the error-correction level.')`.
- **tests:** `input='https://example.com'` → output starts
  `data:image/svg+xml;base64,`; decode the base64 → contains `<svg` and multiple
  `<rect`. `contentType=wifi input=MyNet wifiPassword=secret` → decoded svg
  non-empty (the payload building is the real assertion — factor payload into a
  testable helper and assert `WIFI:T:WPA;S:MyNet;P:secret;;`).
- **related:** placeholder-svg, data-uri, vcard

#### placeholder-svg — Placeholder Image Generator (generators · text · image · —) _(generator)_

- **options:** `width` number=600 (16..4000); `height` number=400 (16..4000);
  `bg` text=`#e2e8f0`; `fg` text=`#64748b`; `label` text='' (empty → `WxH`);
  `fontSize` number=0 (0 → auto = `min(w,h)/6`).
- **algorithm:** Compose `<svg xmlns width height viewBox>` with a `<rect>` fill
  `bg` and a centred `<text>` (`text-anchor="middle" dominant-baseline="central"`)
  fill `fg` font-family monospace. `output = 'data:image/svg+xml;base64,'+btoa(svg)`,
  `render:'image'`, `filename:'placeholder.svg'`. Put the raw markup in a `note`
  or a `stats` `{ bytes }`.
- **errors:** width/height out of range → `ToolError`.
- **tests:** defaults → decoded svg contains `width="600"` and `>600×400<`
  (or `600x400`). `label=Hero` → contains `>Hero<`.
- **related:** qr-code, data-uri, image-placeholder

#### vcard — vCard Generator (generators · text · code · —)

- **options:** `mode` select=`build` (`build`|`parse`); and [showWhen mode=build]:
  `firstName` text, `lastName` text, `org` text, `jobTitle` text, `email` text,
  `phone` text, `website` text, `address` text, `note` text.
- **algorithm:** build → emit vCard 3.0: `BEGIN:VCARD\nVERSION:3.0\nN:<last>;<first>;;;\n
FN:<first> <last>\n` then `ORG:`, `TITLE:`, `EMAIL;TYPE=INTERNET:`, `TEL;TYPE=CELL:`,
  `URL:`, `ADR;TYPE=HOME:;;<address>;;;;`, `NOTE:` for non-empty fields, then
  `END:VCARD`. Escape `\ ; , \n` per RFC 6350 (`\\`, `\;`, `\,`, `\n`).
  parse → read a pasted vCard, `render:'table'` of the fields found.
  build → `render:'code'`.
- **errors:** build with all fields empty → `ToolError('Fill in at least a name or email.')`.
- **tests:** build first `Ada` last `Lovelace` email `ada@x.io` → contains
  `FN:Ada Lovelace`, `N:Lovelace;Ada;;;`, `EMAIL;TYPE=INTERNET:ada@x.io`,
  `END:VCARD`. A `note` with `,` is escaped to `\,`. parse round-trips the FN.
- **related:** ical-event, qr-code, meta-tags

#### ical-event — iCalendar Event Generator (generators · text · code · —)

- **options:** `summary` text; `startDateTime` text (`YYYY-MM-DD HH:MM`, local);
  `endDateTime` text; `allDay` boolean=false; `location` text; `description` text;
  `url` text; `reminderMinutes` number=0 (0..1440, 0 → no alarm).
- **algorithm:** Emit `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Toolbench//EN\n
CALSCALE:GREGORIAN\nBEGIN:VEVENT\n` with `UID:<crypto-random-hex>@toolbench`,
  `DTSTAMP:<nowUTC>`, `DTSTART`/`DTEND` as `YYYYMMDDTHHMMSSZ` (convert the local
  wall-clock via the runtime offset) or `;VALUE=DATE:YYYYMMDD` for allDay,
  escaped `SUMMARY`/`LOCATION`/`DESCRIPTION`/`URL`, optional `BEGIN:VALARM\n
ACTION:DISPLAY\nTRIGGER:-PT<reminder>M\nEND:VALARM`, then `END:VEVENT\nEND:VCALENDAR`.
  Fold lines > 75 octets per RFC 5545. `render:'code'`, `filename:'event.ics'`.
- **errors:** missing/invalid start, or end before start → `ToolError`.
- **tests:** summary `Launch` start `2024-06-01 09:00` end `2024-06-01 10:00` →
  contains `SUMMARY:Launch`, `BEGIN:VEVENT`, `DTSTART:20240601T`, `END:VCALENDAR`.
  `allDay=true` → `DTSTART;VALUE=DATE:20240601`. `reminderMinutes=15` → `TRIGGER:-PT15M`.
- **related:** vcard, date-add, timezone-convert

#### utm-builder — UTM Campaign URL Builder (generators · text · text · —)

- **options:** `source` text; `medium` text; `campaign` text; `term` text;
  `content` text; `lowercase` boolean=false; `stripExisting` boolean=true.
- **algorithm:** `input` = base URL (`new URL(input)`). If `stripExisting`, delete
  existing `utm_*` params. For each of source/medium/campaign/term/content that
  is non-empty, set `utm_<key>` (lowercased if `lowercase`). Output the full URL
  on line 1, then a blank line, then `utm_source = ...` etc. `warnings` if any of
  source/medium/campaign is missing (GA recommends all three).
- **errors:** invalid base URL → `ToolError`.
- **tests:** base `https://ex.com/p` source `newsletter` medium `email` campaign
  `spring` → URL `https://ex.com/p?utm_source=newsletter&utm_medium=email&utm_campaign=spring`.
  `lowercase=true` with `Spring_Sale` → `spring_sale`. Existing `?utm_source=old`
  with `stripExisting` → replaced.
- **related:** url-parse, querystring

#### otp-uri — OTP Auth URI Generator (generators · text · text · —) _(generator)_

- **options:** `type` select=`totp` (`totp`|`hotp`); `issuer` text=`Toolbench`;
  `account` text=`user@example.com`; `secretInput` text='' (empty → generate);
  `secretBytes` number=20 (16..64); `digits` select=`6` (`6`|`8`);
  `algorithm` select=`SHA1` (`SHA1`|`SHA256`|`SHA512`);
  `period` number=30 (15..120) [showWhen type=totp]; `counter` number=0 [showWhen type=hotp].
- **algorithm:** If `secretInput` blank, generate `secretBytes` random bytes and
  RFC 4648 base32-encode (no padding). Build
  `otpauth://<type>/<encodeURIComponent(issuer)>:<encodeURIComponent(account)>?
secret=<b32>&issuer=<enc issuer>&algorithm=<algo>&digits=<n>&<period=|counter=><v>`.
  Output the URI and, on the next line, `Secret (base32): <b32>`. `render:'text'`.
  `faq`: does NOT compute live 6-digit codes (needs the current time; a separate
  concern) — and never send a real secret anywhere.
- **errors:** `secretInput` present but not valid base32 → `ToolError`.
- **tests:** defaults → URI starts `otpauth://totp/Toolbench:user%40example.com?secret=`
  and contains `&digits=6&period=30&algorithm=SHA1`. Secret line matches
  `/^Secret \(base32\): [A-Z2-7]+$/`. `type=hotp counter=5` → `&counter=5`, no
  `period`.
- **related:** qr-code, random-string, hmac

### 9.H — NETWORK (`src/tools/network/`)

#### ip-info — IP Address Info (network · text · table · —)

- **options:** none.
- **algorithm:** Detect IPv4 (`d.d.d.d`, each 0–255) or IPv6 (`::` compression,
  `d.d.d.d` suffix allowed). `render:'table'` rows: version; canonical form;
  integer (decimal — BigInt for v6); hex; **v4:** dotted binary, class (A–E);
  **v6:** fully expanded groups; then booleans: is private
  (10/8, 172.16/12, 192.168/16, 169.254/16 link-local, 127/8 loopback, `::1`,
  `fc00::/7`, `fe80::/10`); is loopback; is link-local; is multicast (224/4,
  `ff00::/8`); is documentation (192.0.2/198.51.100/203.0.113, `2001:db8::/32`);
  is unspecified (`0.0.0.0`, `::`); and the reverse-DNS name
  (`.in-addr.arpa` reversed octets / `.ip6.arpa` reversed nibbles).
- **errors:** invalid → `ToolError('Not a valid IPv4 or IPv6 address.')`.
- **tests:** `192.168.1.1` → version `4`, class `C`, is private `Yes`,
  integer `3232235777`, reverse `1.1.168.192.in-addr.arpa`. `::1` → is loopback
  `Yes`. `2001:db8::1` → is documentation `Yes`, expanded
  `2001:0db8:0000:0000:0000:0000:0000:0001`.
- **related:** cidr-calculator, ptr-record, mac-address

#### cidr-calculator — CIDR / Subnet Calculator (network · text · table · —)

- **options:** none.
- **algorithm:** Parse `input` `addr/prefix` (bare addr → `/32` or `/128`).
  **v4:** network address, prefix, netmask, wildcard mask, broadcast, first
  usable host, last usable host (`/31` and `/32` handled specially — no usable
  hosts / point-to-point note), total addresses `2^(32-p)`, usable hosts
  `max(0, total-2)`, address class. **v6:** first & last address, total as
  `2^(128-p)` (string), no broadcast/netmask concept (note). `render:'table'`.
- **errors:** invalid CIDR / prefix out of range → `ToolError`.
- **tests:** `192.168.1.10/24` → network `192.168.1.0`, netmask `255.255.255.0`,
  broadcast `192.168.1.255`, first host `192.168.1.1`, last host `192.168.1.254`,
  usable hosts `254`. `10.0.0.0/31` → usable hosts `0` + point-to-point note.
  `2001:db8::/48` → total `2^80`.
- **related:** ip-info, subnet-split, ip-range

#### ip-range — IP Range ⇄ CIDR (network · text · code · —)

- **options:** `mode` select=`range-to-cidr` (`range-to-cidr`|`cidr-to-range`).
- **algorithm:** IPv4 only (v6 → `faq` note). range-to-cidr: input
  `A - B` (or `A-B`) → the **minimal** set of aligned CIDR blocks covering
  `[A,B]` (standard greedy: at each step take the largest block that starts at
  the current address and does not exceed B). Output one CIDR per line,
  `render:'code'`. cidr-to-range: input a CIDR → `first - last` and the address
  count.
- **errors:** reversed range (A > B), invalid IP → `ToolError`.
- **tests:** `192.168.1.0 - 192.168.1.10` → `192.168.1.0/29`, `192.168.1.8/31`,
  `192.168.1.10/32`. `10.0.0.0/24` (cidr-to-range) → `10.0.0.0 - 10.0.0.255`
  (256 addresses).
- **related:** cidr-calculator, subnet-split, ip-info

#### subnet-split — Subnet Splitter (network · text · table · —)

- **options:** `mode` select=`by-new-prefix`
  (`by-new-prefix`|`by-subnet-count`|`by-hosts-per-subnet`);
  `newPrefix` number=24 (1..32) [showWhen mode=by-new-prefix];
  `subnetCount` number=4 (1..4096) [showWhen mode=by-subnet-count];
  `hostsPerSubnet` number=254 (1..1000000) [showWhen mode=by-hosts-per-subnet].
- **algorithm:** IPv4. Parse `input` CIDR. Determine the target new prefix:
  `by-new-prefix` → given; `by-subnet-count` → `basePrefix + ceil(log2(count))`;
  `by-hosts-per-subnet` → `32 - ceil(log2(hosts + 2))`. Enumerate the resulting
  equal subnets. `render:'table'` headers
  `["#","Subnet","Netmask","Host range","Usable hosts"]`. Cap at 512 rows
  (append a `note` "showing first 512 of N").
- **errors:** new prefix ≤ base prefix, or invalid CIDR → `ToolError`.
- **tests:** `10.0.0.0/24` by-new-prefix 26 → 4 rows: `10.0.0.0/26`,
  `10.0.0.64/26`, `10.0.0.128/26`, `10.0.0.192/26`; usable hosts `62` each.
  `10.0.0.0/16` by-subnet-count 8 → 8 rows of `/19`.
- **related:** cidr-calculator, ip-range

#### ipv6-tools — IPv6 Toolkit (network · text · text|table · —)

- **options:** `mode` select=`compress` (`compress`|`expand`|`to-integer`|`from-integer`|`eui64`).
- **algorithm:** compress → RFC 5952 shortest form (lowercase, longest zero-run
  → `::`, leftmost on tie). expand → full 8 groups of 4 hex. to-integer → 128-bit
  decimal (BigInt) + `0x` hex. from-integer → parse a decimal or `0x` string →
  IPv6. eui64 → input is a MAC (any format) → the modified EUI-64 interface id
  (split 3+3 bytes, insert `fffe`, flip the U/L bit of byte 0) and the derived
  `fe80::<eui64>` link-local address. `render:'table'` for eui64, else `text`.
- **errors:** invalid input for the mode → `ToolError`.
- **tests:** compress `2001:0db8:0000:0000:0000:0000:0000:0001` →
  `2001:db8::1`. expand `2001:db8::1` → the full form above. eui64
  `00:1a:2b:3c:4d:5e` → interface id `021a:2bff:fe3c:4d5e`, link-local
  `fe80::21a:2bff:fe3c:4d5e`.
- **related:** ip-info, mac-address, cidr-calculator

#### mac-address — MAC Address Formatter (network · text · table · —)

- **options:** none.
- **algorithm:** Parse a MAC-48 in any of colon / hyphen / dot (`xxxx.xxxx.xxxx`)
  / bare 12-hex. `render:'table'` rows: colon form (lower), hyphen form,
  Cisco dot form, bare, uppercase colon; is unicast/multicast (bit 0 of first
  octet); is universal/local (bit 1 — "U/L"); OUI (first 3 bytes, hex only — no
  vendor DB); NIC portion (last 3 bytes); the derived modified EUI-64 id.
- **errors:** wrong length / non-hex → `ToolError('Not a valid MAC address.', '12 hex digits, e.g. 00:1A:2B:3C:4D:5E')`.
- **tests:** `001A2B3C4D5E` → colon `00:1a:2b:3c:4d:5e`, dot `001a.2b3c.4d5e`,
  multicast `No`, U/L `Universal`, OUI `00:1a:2b`. `01:00:5e:00:00:01` →
  multicast `Yes`.
- **related:** ip-info, ipv6-tools

#### ptr-record — Reverse DNS Name Builder (network · text · text · —)

- **options:** `mode` select=`ip-to-ptr` (`ip-to-ptr`|`ptr-to-ip`).
- **algorithm:** ip-to-ptr: IPv4 → `d.c.b.a.in-addr.arpa`; IPv6 → expand, reverse
  the 32 nibbles, join with `.`, append `.ip6.arpa`. ptr-to-ip: reverse the
  operation. `render:'text'`.
- **errors:** invalid IP / PTR name → `ToolError`.
- **tests:** `8.8.4.4` → `4.4.8.8.in-addr.arpa`. `2001:db8::1` →
  `1.0.0.0.` … `.8.b.d.0.1.0.0.2.ip6.arpa` (32 nibbles). round-trip both.
- **related:** ip-info, cidr-calculator

#### asn-lookup — ASN Info (network · text · table · —)

- **note:** _Data-heavy (needs an AS-number → name/country table). Building it
  offline means embedding a large dataset (~100k rows). **Defer** unless a
  compact curated subset (top ~500 ASNs) is acceptable — if so, spec: input an
  AS number or "AS15169" → name, country, type. Otherwise skip; there is no
  privacy-safe live lookup._

### 9.I — IMAGE (`src/tools/image/`) — file tools, canvas in the worker

> `meta.input='file'`, `accept='image/*'`, `worker` omitted (defaults true).
> Use `src/lib/image.ts` (E2-S3). Decode with `createImageBitmap`, draw to an
> `OffscreenCanvas`, encode with `canvas.convertToBlob({ type, quality })`.
> If `OffscreenCanvas` is unavailable → `ToolError('Your browser cannot process
images off the main thread.', 'Update to a recent Chrome, Edge or Firefox.')`.
> Honour `signal`; call `onProgress(i/files.length, file.name)` per file.

#### image-resize — Resize Image (image · file · — · —) `multiple`

- **options:** `mode` select=`fit` (`fit`|`fill`|`exact`|`percent`|`max-width`|`max-height`);
  `width` number=800; `height` number=600; `percent` number=50 (1..400) [showWhen mode=percent];
  `format` select=`original` (`original`|`png`|`jpeg`|`webp`); `quality` range=90 (10..100) [showWhen format≠png];
  `upscale` boolean=false.
- **algorithm:** `fit` = contain (preserve aspect, ≤ w×h); `fill` = cover + crop
  centre; `exact` = stretch; `percent` = scale by %; `max-width`/`max-height` =
  clamp one dimension. Skip enlargement unless `upscale`. Output one file per
  input, `<stem>-<w>x<h>.<ext>`. `stats`: total in/out bytes, saved %.
- **errors:** non-image file → `ToolError`.
- **tests:** (e2e / worker — unit-test only the dimension math by factoring
  `computeTargetSize(srcW, srcH, opts)` into a pure exported helper and asserting:
  `fit 4000×2000 → w=800 h=400`; `percent 50 of 100×100 → 50×50`;
  `max-width 800 of 400×300 no upscale → 400×300`).
- **related:** image-compress, image-convert, image-crop

#### image-compress — Compress Image (image · file · — · —) `multiple`

- **options:** `format` select=`auto` (`auto`|`jpeg`|`webp`); `quality` range=75 (10..100);
  `maxWidth` number=0 (0 = no limit); `stripMetadata` boolean=true (canvas re-encode drops EXIF anyway — note it).
- **algorithm:** Re-encode via canvas at `quality`. `auto` → keep JPEG as JPEG,
  everything else → WebP. Optionally downscale to `maxWidth` first. Output
  `<stem>-min.<ext>`. `stats`: per-file and total original vs compressed size and
  ratio; a `warning` if the "compressed" file is larger (keep the original in
  that case and say so).
- **tests:** dimension/param helper unit test; e2e for real bytes.
- **related:** image-resize, image-convert

#### image-convert — Convert Image Format (image · file · — · —) `multiple`

- **options:** `to` select=`webp` (`png`|`jpeg`|`webp`|`avif`); `quality` range=90 (10..100) [showWhen to≠png];
  `background` text=`#ffffff` (matte for transparency → JPEG).
- **algorithm:** Decode, draw (fill `background` first if target has no alpha),
  `convertToBlob({ type: 'image/'+to, quality })`. If the browser can't encode
  the target (`canvas` returns a PNG regardless — detect via the blob type) →
  `ToolError('This browser cannot encode <to>.', 'Try WebP or PNG.')`.
- **tests:** capability helper unit test (`imageOutputType('image/webp')`); e2e.
- **related:** image-compress, svg-to-png

#### image-crop — Crop Image (image · file · — · —)

- **options:** `mode` select=`aspect` (`aspect`|`pixels`); `aspect` text=`1:1` [showWhen mode=aspect];
  `anchor` select=`center` (`center`|`top`|`bottom`|`left`|`right`|`top-left`|`top-right`|`bottom-left`|`bottom-right`) [showWhen mode=aspect];
  `x` number=0 [showWhen mode=pixels]; `y` number=0 [showWhen mode=pixels];
  `cropWidth` number=0 [showWhen mode=pixels]; `cropHeight` number=0 [showWhen mode=pixels];
  `format` select=`original` (`original`|`png`|`jpeg`|`webp`).
- **algorithm:** `aspect` → compute the largest w:h rect of that ratio that fits,
  positioned by `anchor`. `pixels` → the given rect, clamped to the image.
- **errors:** pixels rect entirely outside image / zero size → `ToolError`.
- **tests:** pure helper `cropRect(srcW,srcH,opts)` — `aspect 1:1 anchor center`
  of `400×300` → `{x:50,y:0,w:300,h:300}`.
- **related:** image-resize, image-rotate

#### image-rotate — Rotate / Flip Image (image · file · — · —) `multiple`

- **options:** `rotate` select=`0` (`0`|`90`|`180`|`270`); `flip` select=`none` (`none`|`horizontal`|`vertical`|`both`);
  `format` select=`original` (`original`|`png`|`jpeg`|`webp`).
- **algorithm:** Canvas transform: swap w/h for 90/270; apply `scale(-1,1)` etc
  for flips. Lossless for PNG; re-encode others.
- **tests:** helper `outputSize(w,h,rotate)` — `90` of `400×300` → `300×400`.
- **related:** image-crop, image-resize

#### image-to-datauri — Image → Data URI (image · file · report[code] · —)

- **options:** `wrap` select=`raw` (`raw`|`css-background`|`html-img`); `mediaQueryComment` boolean=false.
- **algorithm:** Read file → `data:<type>;base64,<...>`. `wrap` `css-background`
  → `background-image: url("<datauri>");`; `html-img` → `<img src="<datauri>" alt="">`.
  Set `report: { output, render: 'code', language: wrap==='raw' ? 'text' : (wrap==='html-img'?'html':'css') }`.
  Also emit the raw `.txt` as an output file. `stats`: original bytes, encoded
  bytes, +33% overhead note.
- **tests:** e2e (needs a real file). Factor the wrapping into a pure helper and
  unit-test that.
- **related:** datauri-to-image, data-uri, base64-file

#### datauri-to-image — Data URI → Image File (image · file · — · —)

- **options:** none. `accept=''` (accept a `.txt` containing a data URI, or paste
  — this one is unusual: still `input:'file'`, read the file as text).
- **algorithm:** Read the file text, match `data:(image/[^;,]+)(;base64)?,(.*)`,
  decode → a `Blob` of the right type → output `image.<ext>`.
- **errors:** not an image data URI → `ToolError`.
- **tests:** pure helper `parseDataUri(str)` → `{ mime, bytes }`.
- **related:** image-to-datauri, data-uri

#### image-metadata — Image Metadata & EXIF Viewer (image · file · report[table] · —)

- **options:** none.
- **algorithm:** Read the file as an `ArrayBuffer`. Always report: file name,
  MIME, byte size, and pixel dimensions (from `createImageBitmap`). For JPEG:
  parse the APP1/Exif segment in pure JS — TIFF header, IFD0 + ExifIFD + GPS IFD;
  decode the common tags (Make, Model, DateTimeOriginal, Orientation, ExposureTime,
  FNumber, ISO, FocalLength, LensModel, GPSLatitude/Longitude → decimal). For
  PNG: read `tEXt`/`iTXt`/`pHYs`/`tIME` chunks. `report: { render: 'table',
headers ["Tag","Value"] }`. Emit no output file.
- **errors:** unreadable → `ToolError`.
- **tests:** pure EXIF parser unit test with a tiny hand-built JPEG APP1 buffer
  (Orientation=6). e2e for a real photo.
- **related:** image-compress (strips metadata), exif-remove (§10)

#### image-palette — Extract Colour Palette (image · file · report[colors] · —)

- **options:** `colors` number=6 (2..16); `algorithm` select=`median-cut` (`median-cut`|`k-means`|`most-frequent`).
- **algorithm:** Decode, downscale-sample (`readPixels`, ~10k px). Quantise to
  `colors` swatches by the chosen method. `report: { output:
JSON.stringify(hexArray), render: 'colors' }`. `stats`: dominant colour, is the
  image mostly light or dark.
- **tests:** pure quantiser unit test on a synthetic pixel array (two-colour
  image → two swatches).
- **related:** color-palette, color-name

#### svg-to-png — SVG → PNG (image · file · — · —)

- **options:** `scale` number=2 (1..8); `width` number=0 (0 = from SVG); `height` number=0;
  `background` text=`transparent`.
- **algorithm:** Read SVG text; determine intrinsic size (`width`/`height` attrs
  or `viewBox`); rasterise via `createImageBitmap(new Blob([svg], {type:'image/svg+xml'}))`
  (or an `Image`+`drawImage` fallback — but that's DOM; prefer the Blob→bitmap
  path which works in workers in current browsers, else `ToolError`) onto a
  canvas at `size*scale`; fill `background` if not transparent; export PNG.
- **errors:** not SVG / no size → `ToolError`.
- **tests:** pure `intrinsicSize(svgText)` helper — `<svg width="100" height="50">`
  → `{w:100,h:50}`; `viewBox="0 0 200 100"` → `{w:200,h:100}`.
- **related:** image-convert, placeholder-svg

#### image-placeholder-blurhash — BlurHash / LQIP (image · file · report · —)

- **note:** _Optional. Compute a BlurHash string + a tiny base64 LQIP data URI
  from a downscaled sample. BlurHash encode is ~80 lines of well-known code (MIT
  reference). Report the hash + the LQIP `<img>` snippet. Build only after the
  core image tools._

### 9.J — IMAGE, MULTI-OUTPUT (`src/tools/image/`)

#### favicon-generator — Favicon Generator (image · file · — · fflate)

- **options:** `sizes` — fixed set 16/32/48/180/192/512 (no option, or a
  `include512` boolean=true); `background` text=`transparent` (matte for the .ico
  PNGs if needed); `padding` number=0 (0..30 %, for maskable).
- **algorithm:** From one source image, produce square PNGs at each size
  (contain, centred, optional padding), plus a multi-image `favicon.ico`
  (16+32+48, PNG-encoded ICO — reuse the approach in `scripts/gen-icons.mjs`),
  plus `apple-touch-icon.png` (180) and `icon-maskable-512.png` (with padding).
  Zip everything with `fflate` → `favicons.zip`. Also emit a `report` (code,
  html) with the `<link>` / manifest snippet to paste. `credits: fflate`.
- **tests:** pure ICO-builder + resize-math unit tests.
- **related:** image-resize, placeholder-svg

#### image-spritesheet — Sprite Sheet Builder (image · file · — · —) `multiple`

- **options:** `layout` select=`grid` (`grid`|`horizontal`|`vertical`|`packed`);
  `columns` number=0 (0 = auto) [showWhen layout=grid]; `padding` number=2;
  `format` select=`png` (`png`|`webp`).
- **algorithm:** Lay each input image out per `layout` (packed = simple shelf
  packing). Draw to one canvas. Output the sheet + a `report` (code, json/css)
  with per-sprite `{name,x,y,w,h}` (JSON) and a `.sprite-<name>{background-position}`
  CSS block.
- **tests:** pure layout function unit test (3 images 10×10, grid cols 2, pad 2 →
  positions `(0,0),(12,0),(0,12)`, sheet `24×24`... compute exact).
- **related:** favicon-generator, image-resize

#### image-diff — Image Difference (image · file · report[table] · —) `multiple` (exactly 2)

- **options:** `threshold` range=10 (0..100); `output` select=`heatmap` (`heatmap`|`highlight`|`side-by-side`).
- **algorithm:** Require exactly 2 images (else `ToolError`). If sizes differ,
  scale the second to the first (note it). Per-pixel compare; `heatmap` = red
  intensity ∝ delta; `highlight` = magenta where delta > threshold over a dimmed
  base. Output the diff PNG. `report` (table): total pixels, differing pixels,
  % different, mean/max channel delta, "images are identical" yes/no.
- **tests:** pure `comparePixels(a,b,threshold)` unit test on small arrays.
- **related:** diff-text, image-metadata

### 9.K — PDF (`src/tools/pdf/`) — file tools

> `import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'` (MIT) for
> editing; `import * as pdfjsLib` from `pdfjs-dist` (Apache-2.0) for
> rendering/text. `pdfjs-dist` needs its worker: set
> `pdfjsLib.GlobalWorkerOptions.workerSrc` to the bundled worker URL
> (`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href`) — this
> resolves to a same-origin asset, no network. Set `credits` per lib used.
> Honour `signal`, call `onProgress`. Encrypted/password PDFs → `ToolError`
> ("This PDF is password-protected — unlock it first.").

#### pdf-merge — Merge PDFs (pdf · file · — · pdf-lib) `multiple`

- **options:** `outputName` text=`merged.pdf`; `keepBookmarks` boolean=false (pdf-lib
  loses outlines — note it).
- **algorithm:** `PDFDocument.create()`, for each input `copyPages` all pages in
  selection order, append. Save → one file. `stats`: input count, total pages.
- **errors:** <2 PDFs → `ToolError`.
- **tests:** e2e with 2 one-page fixture PDFs → output has 2 pages
  (`PDFDocument.load(out).getPageCount() === 2`). Add this as a Vitest test too
  (pdf-lib runs in Node) — generate the fixtures in-test with pdf-lib.
- **related:** pdf-split, images-to-pdf

#### pdf-split — Split PDF (pdf · file · — · pdf-lib)

- **options:** `mode` select=`every-page` (`every-page`|`ranges`|`fixed-size`);
  `ranges` text=`1-3,5,7-` [showWhen mode=ranges]; `size` number=10 [showWhen mode=fixed-size].
- **algorithm:** `every-page` → one PDF per page. `ranges` → parse `1-3,5,7-`
  (open-ended `7-` = to end; 1-indexed) → one PDF per range. `fixed-size` →
  chunks of `size` pages. Zip when >1 output. `stats`: pages, output files.
- **errors:** empty / invalid ranges / range out of bounds → `ToolError`.
- **tests:** Vitest with a 5-page fixture: `ranges='1-2,4'` → 2 outputs of 2 and
  1 pages. `every-page` → 5 outputs.
- **related:** pdf-merge, pdf-extract-pages, pdf-delete-pages

#### pdf-extract-pages — Extract Pages (pdf · file · — · pdf-lib)

- **options:** `pages` text=`1,3,5-7`.
- **algorithm:** Parse the page list (1-indexed, ranges, open-ended). `copyPages`
  those into one new PDF, in the given order. Output one file.
- **errors:** empty / out of bounds → `ToolError`.
- **tests:** 5-page fixture, `pages='5,1'` → 2-page output whose first page is
  the original page 5 (assert via text if the fixture pages carry a label).
- **related:** pdf-split, pdf-delete-pages

#### pdf-rotate — Rotate Pages (pdf · file · — · pdf-lib)

- **options:** `angle` select=`90` (`90`|`180`|`270`); `pages` text=`all`.
- **algorithm:** `pages='all'` or a list. For each, `page.setRotation(degrees((page.getRotation().angle + angle) % 360))`.
- **tests:** Vitest: rotate all pages of a fixture by 90, reload, assert rotation.
- **related:** pdf-delete-pages, pdf-page-numbers

#### pdf-delete-pages — Delete Pages (pdf · file · — · pdf-lib)

- **options:** `pages` text=`2,4`.
- **algorithm:** Parse the list; `removePage` from the highest index down. Error
  if it would remove every page.
- **tests:** 5-page fixture, `pages='2,4'` → 3-page output.
- **related:** pdf-extract-pages, pdf-split

#### pdf-page-numbers — Add Page Numbers (pdf · file · — · pdf-lib)

- **options:** `position` select=`bottom-center`
  (`bottom-center`|`bottom-right`|`bottom-left`|`top-center`|`top-right`|`top-left`);
  `format` select=`n` (`n`|`n-of-total`|`page-n`|`page-n-of-total`);
  `startAt` number=1; `fontSize` number=10; `margin` number=24; `skipFirst` boolean=false.
- **algorithm:** Embed `StandardFonts.Helvetica`. For each page, draw the label
  at the computed x/y (respecting `margin`, text width for right/centre). `stats`:
  pages numbered.
- **tests:** Vitest: run on a fixture, reload, confirm it still opens and page
  count unchanged (can't easily assert drawn text — assert no throw + byte
  growth).
- **related:** pdf-watermark, pdf-metadata

#### pdf-watermark — Watermark PDF (pdf · file · — · pdf-lib)

- **options:** `text` text=`CONFIDENTIAL`; `opacity` range=15 (5..100);
  `rotation` number=45 (-90..90); `fontSize` number=48; `color` text=`#ff0000`;
  `pages` text=`all`; `position` select=`center` (`center`|`tile`).
- **algorithm:** Draw the text (Helvetica-Bold) centred (or tiled across the page)
  at the given rotation/opacity/colour on each selected page.
- **errors:** empty text → `ToolError`.
- **tests:** Vitest: no throw, output opens, page count unchanged.
- **related:** pdf-page-numbers, pdf-metadata

#### pdf-metadata — View / Edit PDF Metadata (pdf · file · report[table] · pdf-lib)

- **options:** `title` text=''; `author` text=''; `subject` text=''; `keywords` text='';
  `creator` text=''; `producer` text=''; `clearAll` boolean=false.
- **algorithm:** Load; `report` (table) the current Title/Author/Subject/Keywords/
  Creator/Producer/CreationDate/ModDate/PageCount. If any edit field is non-empty
  or `clearAll`, apply `setTitle` etc (or blank them) and emit the rewritten PDF
  as an output file. If no edits requested, emit only the report.
- **tests:** Vitest: set title on a fixture, reload, `getTitle() === 'X'`.
- **related:** pdf-page-numbers, image-metadata

#### pdf-to-images — PDF → Images (pdf · file · — · pdfjs-dist, fflate)

- **options:** `format` select=`png` (`png`|`jpeg`|`webp`); `scale` number=2 (1..4);
  `pages` text=`all`; `quality` range=90 [showWhen format≠png].
- **algorithm:** Load with pdfjs; for each selected page, `getViewport({scale})`,
  render to an `OffscreenCanvas`, `convertToBlob`. Zip when >1. `onProgress` per
  page. `stats`: pages rendered, output size.
- **errors:** password-protected / corrupt → `ToolError`.
- **tests:** e2e (real browser — pdfjs canvas rendering). Add to
  `e2e/tools-c.spec.ts` with the 1-page fixture PDF; assert one PNG output and no
  network.
- **related:** images-to-pdf, pdf-extract-text

#### images-to-pdf — Images → PDF (pdf · file · — · pdf-lib) `multiple`, `accept='image/*'`

- **options:** `pageSize` select=`fit` (`fit`|`a4`|`letter`); `orientation` select=`auto` (`auto`|`portrait`|`landscape`) [showWhen pageSize≠fit];
  `margin` number=0; `fitMode` select=`contain` (`contain`|`cover`) [showWhen pageSize≠fit].
- **algorithm:** For each image: `embedJpg`/`embedPng` (convert WebP/others to PNG
  via canvas first). `fit` → one page per image sized to the image (+margin).
  `a4`/`letter` → standard page, image placed per `fitMode`/`margin`.
- **errors:** no images / unsupported type that can't be converted → `ToolError`.
- **tests:** Vitest with 2 tiny PNG buffers → 2-page PDF.
- **related:** pdf-to-images, pdf-merge

#### pdf-extract-text — Extract Text from PDF (pdf · file · report[text] · pdfjs-dist)

- **options:** `layout` select=`reading-order` (`reading-order`|`raw`|`by-page`);
  `pageBreaks` boolean=true.
- **algorithm:** pdfjs `getTextContent()` per page; join items with spacing
  heuristics (`reading-order` groups by y then x; `raw` = item order). Insert
  `\n\n--- Page N ---\n\n` between pages if `pageBreaks`. `report` (text) + emit a
  `.txt` output file. `warning` if the PDF looks scanned (very little text
  extracted) → "This PDF has no selectable text; it may be scanned. OCR is not
  available." `stats`: pages, characters extracted.
- **tests:** e2e with a text fixture PDF → report contains the known sentence.
- **related:** pdf-to-images, html-to-text

### 9.L — ARCHIVES & FILES (`src/tools/archive/`) — `credits: fflate MIT`

> `import { zipSync, unzipSync, gzipSync, gunzipSync, strToU8, strFromU8, zip, unzip } from 'fflate'`.
> Prefer the async callback forms (`zip`, `unzip`) for large inputs; wrap in a
> Promise. Honour `signal`. `tar` is not in fflate — implement the ustar format
> in ~80 lines (512-byte header blocks, 512-byte padding, two zero blocks at
> end).

#### zip-create — Create ZIP (archive · file · — · fflate) `multiple`

- **options:** `level` number=6 (0..9); `zipName` text=`bundle.zip`; `flatten` boolean=false (drop any path, use basename).
- **algorithm:** Build `{ [name]: Uint8Array }` from the files; `zip(...)` →
  output one `.zip`. `stats`: file count, total in, zip out, ratio.
- **tests:** Vitest: zip two `strToU8` blobs, `unzipSync` the result, assert
  contents + names.
- **related:** zip-extract, zip-inspect, tar-create

#### zip-extract — Extract ZIP (archive · file · — · fflate, and `report` list)

- **options:** `filter` text='' (only extract entries whose path contains this).
- **algorithm:** `unzip(...)`; emit each entry as an output file (name = entry
  path with `/` → `__` or keep; **strip any `../`** to prevent path escapes).
  `report` (table): entry name, size, "extracted"/"skipped". Zip the outputs if
  many (so the user gets one download) OR list them individually — list
  individually, cap at 200 with a note.
- **errors:** not a zip / encrypted zip → `ToolError`.
- **tests:** Vitest round-trip with zip-create output.
- **related:** zip-create, zip-inspect

#### zip-inspect — Inspect ZIP (archive · file · report[table] · fflate)

- **options:** none.
- **algorithm:** `unzip` (or parse the central directory) → `report` (table)
  headers `["Path","Size","Compressed","Ratio","CRC32","Modified"]`. `stats`:
  entry count, total uncompressed, total compressed, overall ratio. Emit no
  output file.
- **tests:** Vitest on a known zip.
- **related:** zip-extract, file-metadata

#### gzip — Gzip Compress / Decompress (archive · file · — · fflate)

- **options:** `mode` select=`auto` (`auto`|`compress`|`decompress`); `level` number=6 (0..9) [showWhen mode≠decompress].
- **algorithm:** `auto` → sniff the gzip magic (`1f 8b`) → decompress, else
  compress. Output `<name>.gz` or `<name without .gz>`. `stats`: sizes + ratio.
- **errors:** decompress of non-gzip → `ToolError`.
- **tests:** Vitest: `gzipSync`/`gunzipSync` round-trip via the tool.
- **related:** zip-create, base64-file

#### tar-create — Create TAR (archive · file · — · —) `multiple`

- **options:** `tarName` text=`archive.tar`; `gzip` boolean=false (also gzip → `.tar.gz`, uses fflate).
- **algorithm:** ustar writer. Each file → a 512-byte header (name, mode `0000644`,
  uid/gid `0`, size octal, mtime octal, checksum, typeflag `0`, `ustar\000`) +
  data padded to 512 + two zero blocks at the end. If `gzip`, `gzipSync` the tar.
- **tests:** Vitest: create a tar, parse it back with your tar-extract reader.
- **related:** tar-extract, zip-create

#### tar-extract — Extract TAR (archive · file · — · —) `+ report list`

- **options:** none. `accept` includes `.tar` and `.tar.gz`/`.tgz`.
- **algorithm:** If gzip magic → `gunzipSync` first. Read 512-byte headers; for
  each regular file (typeflag `0`/`\0`) emit an output file (size from the octal
  field; skip the padding). Strip `../`. `report` (table) of entries.
- **errors:** not a tar → `ToolError`.
- **tests:** Vitest round-trip with tar-create.
- **related:** tar-create, zip-extract

#### file-split — Split File into Chunks (archive · file · — · —)

- **options:** `mode` select=`by-size` (`by-size`|`by-count`); `chunkSize` number=5
  [showWhen mode=by-size]; `chunkUnit` select=`MB` (`KB`|`MB`) [showWhen mode=by-size];
  `count` number=4 [showWhen mode=by-count].
- **algorithm:** Slice the file into `<name>.part001`, `.part002`, … Emit all
  parts (zip them for one download if >5). Also emit a tiny `<name>.manifest.json`
  `{ original, size, sha256, parts: [{name,size}] }`. `stats`.
- **tests:** Vitest: split a 10-byte blob into 3 → parts `4,4,2` bytes;
  concatenation equals the original.
- **related:** file-join, file-metadata

#### file-join — Join File Chunks (archive · file · — · —) `multiple`

- **options:** `sort` select=`name` (`name`|`upload-order`); `outputName` text=`joined.bin`.
- **algorithm:** Sort the parts (natural sort on `.partNNN` when `name`), concat
  their bytes → one file. If a `.manifest.json` is among the inputs, verify the
  SHA-256 and the part list; `warning` on mismatch.
- **tests:** Vitest round-trip with file-split.
- **related:** file-split

#### base64-file — File ⇄ Base64 (archive · file · — · —)

- **options:** `mode` select=`auto` (`auto`|`encode`|`decode`); `wrap` number=0 (0 = no wrap, else wrap at N).
- **algorithm:** `auto` → if the file is a `.txt`/`.b64` whose content is valid
  base64 → decode to bytes (output `<name>.bin` or, if a `data:` URI, honour its
  mime); else encode the file's bytes → base64 text (`<name>.b64.txt`).
- **tests:** Vitest round-trip on a small binary buffer.
- **related:** base64, data-uri, gzip

#### file-metadata — File Metadata & Checksum (archive · file · report[table] · —) `multiple`

- **options:** `algorithms` select=`sha-256` (`sha-256`|`sha-1`|`sha-512`|`all`).
- **algorithm:** Per file: name, MIME (or "unknown"), byte size (+ human), last
  modified (ISO), and the selected digests (via `crypto.subtle`; `all` = SHA-1 +
  SHA-256 + SHA-512). `report` (table). Emit an optional `checksums.txt`
  (`<hash>  <name>` lines) output file. No other outputs.
- **tests:** Vitest: SHA-256 of a `File(['abc'])` equals
  `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
- **related:** file-hash, hash, zip-inspect

### 9.M — AUDIO (`src/tools/audio/`) — `meta.worker = false`, main thread

> `accept='audio/*'`. Decode with
> `new AudioContext().decodeAudioData(arrayBuffer)` (or `OfflineAudioContext` for
> processing graphs). Output WAV via `src/lib/audio.ts` (`encodeWavPCM16`,
> `wavDataUri`) from E2-S2. If `AudioContext` is unavailable → `ToolError`.
> `decodeAudioData` supports what the browser supports (usually mp3, wav, ogg,
> m4a, flac in Chrome/Firefox; Safari varies) — on failure →
> `ToolError('This browser could not decode that audio file.')`.

#### audio-info — Audio File Info (audio · file · report[table] · —)

- **options:** none.
- **algorithm:** Decode → `report` (table): file name, MIME, byte size, duration
  (s + mm:ss), sample rate, channels, total samples, estimated bitrate
  (`bytes*8/duration`), peak amplitude (dBFS), RMS level (dBFS), "contains
  clipping" (any sample at ±1.0). No output file.
- **tests:** e2e with the WAV fixture (0.1s mono) → report shows `Channels 1` and
  a plausible duration.
- **related:** audio-to-wav, audio-normalize

#### audio-to-wav — Convert Audio to WAV (audio · file · — · —) `multiple`

- **options:** `sampleRate` select=`original` (`original`|`8000`|`16000`|`22050`|`44100`|`48000`);
  `channels` select=`original` (`original`|`mono`|`stereo`); `bitDepth` select=`16` (`16`).
- **algorithm:** Decode; optionally resample (linear or use `OfflineAudioContext`
  at the target rate) and down/up-mix channels; `encodeWavPCM16`. Output
  `<stem>.wav`.
- **tests:** e2e round-trip; unit-test the WAV header via `src/lib/audio.ts`.
- **related:** audio-info, audio-trim

#### audio-trim — Trim / Clip Audio (audio · file · — · —)

- **options:** `start` text=`0:00` (accepts `SS`, `M:SS`, `H:MM:SS`, or seconds);
  `end` text='' (empty → end of file); `fadeIn` number=0 (ms); `fadeOut` number=0 (ms).
- **algorithm:** Decode; slice the sample range `[start,end)`; apply linear fades;
  encode WAV. `end <= start` or out of range → `ToolError`.
- **tests:** unit-test the time parser (`parseTime('1:30') === 90`). e2e for the
  slice.
- **related:** audio-fade, audio-to-wav

#### audio-normalize — Normalise Audio (audio · file · — · —)

- **options:** `mode` select=`peak` (`peak`|`rms`); `targetDb` number=-1 (peak, -30..0) / `-14` (rms LUFS-ish).
- **algorithm:** Decode; `peak` → scale so the max |sample| hits `10^(targetDb/20)`;
  `rms` → scale so the RMS hits the target (simple RMS, note it's not true LUFS).
  Clamp to ±1. Encode WAV. `stats`: gain applied (dB), new peak.
- **tests:** unit-test the gain math (peak of `[0.5]` to `0 dB` → gain 2×, output
  `[1.0]`).
- **related:** audio-gain, audio-info

#### audio-gain — Adjust Volume (audio · file · — · —)

- **options:** `gainDb` number=0 (-60..24); `hardClip` boolean=true (else soft-clip tanh).
- **algorithm:** Multiply by `10^(gainDb/20)`; clip. Encode WAV. `warning` if
  clipping occurred and `hardClip`.
- **tests:** unit gain math.
- **related:** audio-normalize, audio-fade

#### audio-fade — Fade In / Out (audio · file · — · —)

- **options:** `fadeInMs` number=1000; `fadeOutMs` number=1000; `curve` select=`linear` (`linear`|`exponential`|`logarithmic`).
- **algorithm:** Apply the gain envelope over the first/last N ms per `curve`.
  Encode WAV.
- **tests:** unit-test the envelope value at t=0 (=0), t=fade (=1), midpoint per curve.
- **related:** audio-trim, audio-gain

#### audio-reverse — Reverse Audio (audio · file · — · —)

- **options:** none.
- **algorithm:** Decode; reverse each channel's samples; encode WAV.
- **tests:** unit-test array reversal on a channel; e2e for a real file.
- **related:** audio-trim

#### audio-merge — Merge / Concatenate Audio (audio · file · — · —) `multiple`

- **options:** `mode` select=`concat` (`concat`|`mix`); `gapMs` number=0 [showWhen mode=concat];
  `matchLoudness` boolean=false.
- **algorithm:** Decode all. `concat` → append (resample all to the max sample
  rate, mix to the max channel count, insert `gapMs` silence between).
  `mix` → sum overlapping (align at 0), then normalise to avoid clipping.
  Encode WAV.
- **errors:** <2 files → `ToolError`.
- **tests:** unit-test concat length = sum of lengths + gaps.
- **related:** audio-channels, audio-normalize

#### audio-channels — Channel Tools (audio · file · — · —)

- **options:** `operation` select=`to-mono`
  (`to-mono`|`to-stereo`|`swap`|`left-only`|`right-only`|`mid-side`).
- **algorithm:** `to-mono` = average channels; `to-stereo` = duplicate; `swap` =
  L↔R; `left-only`/`right-only` = that channel to both; `mid-side` = output M =
  (L+R)/2 and S = (L−R)/2 as a stereo file. Encode WAV.
- **tests:** unit-test `to-mono` of `[[1,1],[−1,−1]]` (L,R) → `[0,0]`.
- **related:** audio-merge, audio-to-wav

#### audio-speed — Change Speed (audio · file · — · —)

- **options:** `rate` number=100 (25..400, percent); `preservePitch` boolean=false.
- **algorithm:** `preservePitch=false` → resample (playback-rate change; pitch
  shifts too — note it). `preservePitch=true` → a simple time-stretch (OLA /
  phase-vocoder-lite; if too complex, do WSOLA basic or fall back to resample
  with a `warning` "pitch preservation is approximate"). Encode WAV. New duration
  = original / (rate/100).
- **tests:** unit-test output length for `rate=200` (half length) in the
  no-preserve path.
- **related:** audio-trim, audio-reverse

### 9.N — GENERATORS (media) (`src/tools/generators/`)

#### tone-generator — Tone / Signal Generator (generators · text · audio · —) _(generator)_ — depends on E2-S2

- **options:** `waveform` select=`sine` (`sine`|`square`|`sawtooth`|`triangle`|`white-noise`|`pink-noise`);
  `frequency` number=440 (20..20000) [showWhen waveform≠white-noise & ≠pink-noise];
  `durationMs` number=2000 (50..30000); `amplitude` range=50 (0..100);
  `sampleRate` select=`44100` (`22050`|`44100`|`48000`);
  `fadeMs` number=10 (0..500) (click-free edges); `channels` select=`mono` (`mono`|`stereo`).
- **algorithm:** Synthesise `Float32Array` samples directly (no AudioContext
  needed — pure math), apply `fadeMs` linear edges, `encodeWavPCM16`,
  `output = wavDataUri(bytes)`, `render:'audio'`, `filename:'tone.wav'`.
  Pink noise = white through a simple −3 dB/oct filter (Voss-McCartney or a
  1-pole approximation). Ignore `input.text`.
- **tests:** the generated data URI starts `data:audio/wav;base64,`; decode the
  WAV header (RIFF/WAVE, correct sample rate, `durationMs` → sample count).
- **related:** metronome-click, audio-info

#### metronome-click — Metronome Click Track (generators · text · audio · —) _(generator)_ — depends on E2-S2

- **options:** `bpm` number=120 (20..300); `bars` number=4 (1..64);
  `beatsPerBar` number=4 (1..16); `accentFirst` boolean=true;
  `clickHz` number=1000; `accentHz` number=1500; `sampleRate` select=`44100`.
- **algorithm:** Build silence of the total duration (`bars*beatsPerBar*60/bpm` s),
  place a short (~30ms) exponentially-decaying sine "click" at each beat
  (`accentHz` on beat 1 if `accentFirst`). `encodeWavPCM16` → `wavDataUri`,
  `render:'audio'`, `filename:'metronome.wav'`.
- **tests:** WAV duration matches `bars*beatsPerBar*60/bpm`.
- **related:** tone-generator

### 9.O — EVERYDAY (`src/tools/misc/`) — `input:'text'`, pure

#### calculator — Expression Calculator (misc · text · text · —)

- **options:** `angleMode` select=`radians` (`radians`|`degrees`); `precision` number=10 (0..15).
- **algorithm:** A **safe** recursive-descent / shunting-yard parser+evaluator.
  **NO `eval`, NO `new Function`.** Support `+ - * / % ^` (right-assoc `^`),
  parentheses, unary minus, constants `pi e`, functions
  `sqrt cbrt abs round floor ceil sign ln log log2 exp sin cos tan asin acos
atan atan2 sinh cosh tanh min max pow hypot gcd factorial`, `!` postfix
  factorial, thousands separators ignored. `angleMode` affects trig. Output the
  numeric result (`precision` dp, trimmed) and the normalised expression as a
  `note`.
- **errors:** parse error / unknown name / divide by zero / domain error →
  `ToolError` with the position where possible.
- **tests:** `2 + 3 * 4` → `14`. `(2+3)^2` → `25`. `sqrt(16)` → `4`. `sin(pi/2)`
  → `1`. `5!` → `120`. `1/0` → throws. `2 +` → throws.
- **related:** programmer-calculator, unit-convert

#### programmer-calculator — Programmer Calculator (misc · text · table · —)

- **options:** `bits` select=`32` (`8`|`16`|`32`|`64`); `signed` boolean=false.
- **algorithm:** Evaluate an integer expression with `+ - * / % & | ^ ~ << >> >>>`
  and parenthesised terms; operands may be `0x.. 0b.. 0o..` or decimal. Use
  BigInt, then mask to `bits`. `render:'table'` rows: result in DEC, HEX, OCT,
  BIN (grouped), two's-complement at `bits`, set-bit count.
- **errors:** parse error → `ToolError`.
- **tests:** `0xF0 | 0x0F` → hex `0xFF`, dec `255`. `1 << 4` → `16`. `~0` bits=8
  → dec `255` (unsigned) / `-1` (signed). `5 % 3` → `2`.
- **related:** number-base, base-n-logic, calculator

#### tip-calculator — Tip Calculator (misc · text · table · —)

- **options:** `bill` number=0; `tipPercent` range=18 (0..40); `split` number=1 (1..50);
  `roundUp` select=`none` (`none`|`total`|`per-person`).
- **algorithm:** tip = bill*tip%/100; total = bill+tip; per person = total/split.
  Apply rounding. Ignore `input.text`. `render:'table'` rows: Bill, Tip (amount +
  %), Total, Per person, (Tip per person).
- **errors:** bill < 0 → `ToolError`.
- **tests:** bill 100 tip 20 split 4 → tip `20.00`, total `120.00`, per person
  `30.00`. `roundUp=per-person` bill 100 tip 15 split 3 → per person `38.34` →
  `39.00`, total shown as `117.00`.
- **related:** percentage, loan-calculator

#### loan-calculator — Loan / EMI Calculator (misc · text · table · —)

- **options:** `principal` number=100000; `annualRatePercent` number=6.5; `years` number=5;
  `extraMonthly` number=0.
- **algorithm:** Monthly rate `r = rate/1200`; n = years*12; payment
  `P*r/(1-(1+r)^-n)` (handle r=0 → P/n). With `extraMonthly`, simulate the
  amortisation to find the actual payoff month and total interest. `render:'table'`
  rows: Monthly payment, Number of payments, Total paid, Total interest,
  (Payoff month with extra, Interest saved). Also a short amortisation summary
  (first payment principal/interest split, and every ~12th month) — keep it a
  compact table or a `note`.
- **errors:** principal ≤ 0 / years ≤ 0 → `ToolError`.
- **tests:** principal 100000, rate 6, years 30 → monthly ≈ `599.55`. rate 0,
  principal 1200, years 1 → monthly `100.00`.
- **related:** percentage, tip-calculator

#### bmi-calculator — BMI Calculator (misc · text · table · —)

- **options:** `units` select=`metric` (`metric`|`imperial`);
  `heightCm` number=170 [showWhen units=metric]; `weightKg` number=70 [showWhen units=metric];
  `heightFt` number=5 [showWhen units=imperial]; `heightIn` number=7 [showWhen units=imperial];
  `weightLb` number=154 [showWhen units=imperial].
- **algorithm:** BMI = kg / m². Convert imperial first. `render:'table'` rows:
  BMI, Category (Underweight <18.5, Normal 18.5–24.9, Overweight 25–29.9,
  Obese ≥30), Healthy weight range for the height, and BMI Prime.
- **errors:** non-positive height/weight → `ToolError`.
- **tests:** 170cm 70kg → BMI `24.2`, category `Normal`. imperial 5ft 7in 154lb →
  BMI ≈ `24.1`.
- **related:** unit-convert, percentage

#### aspect-ratio — Aspect Ratio Calculator (misc · text · table · —)

- **options:** `mode` select=`solve` (`solve`|`simplify`|`presets`);
  `ratioW` number=16 [showWhen mode≠presets]; `ratioH` number=9 [showWhen mode≠presets];
  `knownWidth` number=0 [showWhen mode=solve]; `knownHeight` number=0 [showWhen mode=solve].
- **algorithm:** `solve` → given a ratio and one dimension, output the other
  (and the ratio simplified). `simplify` → reduce `ratioW:ratioH` by GCD, also
  give the decimal and the nearest common name (16:9, 4:3, 21:9, 1:1, 3:2, 5:4,
  9:16, 2.39:1). `presets` → a table of common resolutions for a chosen family.
  `render:'table'`.
- **errors:** zero ratio component; solve with neither dimension → `ToolError`.
- **tests:** ratio 16:9, knownWidth 1920 → height `1080`. simplify 1920:1080 →
  `16:9`, name `16:9`, decimal `1.778`.
- **related:** ratio, css-units, image-resize

#### data-size — Data Size Converter (misc · text · table · —)

- **options:** `from` select=`MB` (`B`|`KB`|`MB`|`GB`|`TB`|`PB`|`KiB`|`MiB`|`GiB`|`TiB`|`PiB`|`bit`|`Kbit`|`Mbit`|`Gbit`);
  `to` select=`MiB` (same list).
- **algorithm:** `input` = the value. Decimal units are ×1000, binary (`*iB`)
  ×1024, `bit`/`*bit` are 1/8 byte scaled by 1000. Convert via bytes.
  `render:'table'` — the result in `to` plus the value in B, KB, MB, GB, KiB,
  MiB, GiB, and bits. `stats`.
- **errors:** non-numeric → `ToolError`.
- **tests:** `1` `GB` → `MB` `1000`, `MiB` ≈ `953.674`, `GiB` ≈ `0.931`.
  `8` `bit` → `B` `1`.
- **related:** unit-convert, css-units

#### random-picker — Random Picker / Shuffler (misc · text · text|table · —) _(generator-ish)_

- **options:** `mode` select=`pick` (`pick`|`shuffle`|`teams`|`order`);
  `pickCount` number=1 (1..1000) [showWhen mode=pick];
  `teamCount` number=2 (2..50) [showWhen mode=teams];
  `allowDuplicates` boolean=false [showWhen mode=pick]; `trimLines` boolean=true; `dropBlank` boolean=true.
- **algorithm:** Input = a list (one item per line, or comma-separated if a single
  line). `pick` → N items (unbiased `crypto.getRandomValues` selection; without
  replacement unless `allowDuplicates`). `shuffle` / `order` → Fisher–Yates the
  whole list. `teams` → shuffle then deal round-robin into `teamCount` groups
  (`render:'table'` headers `["Team","Members"]`). Others `render:'text'`.
- **errors:** empty list; `pick` count > list size without duplicates → `ToolError`.
- **tests:** with a fixed list, `mode=shuffle` → output is a permutation of the
  input (same multiset). `mode=teams teamCount=2` on 4 items → 2 rows of 2.
  `pick pickCount=2` → 2 distinct items from the list.
- **related:** random-number, random-data, sort-lines

---

## 10. ADDITIONAL RECOMMENDATIONS / IDEAS BACKLOG

Not yet scheduled into an epic. Each is a candidate tool or feature. Before
building any, confirm it is **genuinely client-side** and **not a thin
calculator that hurts SEO**. Promote the good ones into E3/E4-style stories with
a full §9-shaped spec first. Grouped by theme.

### 10.1 More TEXT tools

- `slug-to-title` — reverse a slug back to a readable title.
- `whitespace-visualizer` — reveal tabs/spaces/zero-width/non-breaking chars, and
  a "clean" mode that strips zero-width + normalises NBSP.
- `zalgo` / `unzalgo` — combining-mark "glitch" text and its removal.
- `fullwidth-convert` — ASCII ⇄ full-width (ｆｕｌｌｗｉｄｔｈ) / small-caps / bubble /
  monospace math letters (Unicode style maps).
- `text-to-ascii-art` — figlet-style banner text. Needs 2–3 bundled FIGfonts
  (~10 KB each, MIT/CC). Medium effort.
- `text-columns` — reflow text into N aligned columns; `cut`-style field extract.
- `remove-duplicate-words` (adjacent + global); `capitalize-sentences`.
- `pig-latin` / `leet-speak` translators (novelty).
- `text-to-binary-emoji` (novelty).
- `unicode-inspector` — per-character: code point, name (needs a Unicode name
  table — big; ship a compact block-name + category version), UTF-8/UTF-16 bytes,
  HTML entity, is-emoji, script.
- `homoglyph-detector` — flag Cyrillic/Greek look-alikes in a string
  (phishing-domain check); `render:'table'`.
- `line-sort-by` — sort lines by a numeric/date field, or by column N.
- `markdown-toc` — build a table of contents from `#` headings.
- `markdown-table-format` — align a pasted Markdown table's pipes.
- `csv-column-select` / `csv-transpose` / `csv-sort` — CSV-specific text tools.
- `diff-json` already exists (`json-diff`); add `diff-csv` (row/cell aware).
- `word-wrap-for-email` — 72-col wrap with `> ` quote awareness.
- `snake-to-http-header` and back (`x_request_id` ⇄ `X-Request-Id`).

### 10.2 More ENCODING / CRYPTO

- `base45` (RFC 9285 — used by EU COVID certs), `base62`, `base91`, `z85` (may
  fold into `ascii85`).
- `rle` — run-length encode/decode text.
- `uuencode` / `xxencode` (legacy, small).
- `bech32` / `bech32m` encode-decode (Bitcoin/Nostr addresses) — pure JS, ~120
  lines.
- `pem-der` — Base64 PEM ⇄ hex DER viewer; parse the ASN.1 structure of an X.509
  cert / public key and show fields (`render:'table'`). Bigger effort; ASN.1
  parser ~200 lines.
- `jwt-generate` — sign a JWT with HS256/384/512 given a local secret
  (`crypto.subtle`). Clearly label "test tokens only; never paste a production
  secret".
- `hmac-verify` — compare a computed HMAC against an expected value
  (constant-time compare in JS is best-effort — note it).
- `argon2` / `bcrypt` / `scrypt` — **need WASM** (argon2-browser, bcryptjs is
  pure-JS but slow). Deferred; would require a dep + `wasm-unsafe-eval` review.
- `pbkdf2` — derive a key from a password (show hex), `crypto.subtle`.
- `ecdsa-keygen` / `rsa-keygen` — generate a key pair with `crypto.subtle`,
  export JWK / PEM. Genuinely useful and fully local.
- `ssh-key-fingerprint` — parse an `ssh-ed25519 AAAA...` / `ssh-rsa` public key,
  show the SHA-256 and MD5 fingerprints and the key type/bits.
- `totp-now` — given a base32 secret, compute the **current** 6/8-digit code
  (uses `Date.now()` — fine in a tool; make the "current time" an option so tests
  are deterministic). Pairs with `otp-uri`.
- `checksum-verify` — paste text + an expected CRC32/MD5/SHA and get pass/fail.
- `entropy-estimator` — Shannon entropy (bits/char and total) + a rough
  password-strength verdict (zxcvbn is heavy; do a DIY estimate).
- `one-time-pad` / `xor-cipher` — XOR text with a key (hex/utf8), base64 output.
- `vigenere` / `rail-fence` / `atbash` / `a1z26` — classical ciphers (novelty +
  education; cheap).
- `enigma` — a configurable Enigma machine (rotors/reflector/plugboard). Fun,
  moderate effort, great SEO for "enigma simulator".

### 10.3 More DATA / DEVELOPER

- `toml-to-json` / `json-to-toml` — needs a TOML parser (`smol-toml` is MIT ~8 KB;
  **would be a new dep — get sign-off**). Or write a subset parser.
- `ini-to-json` / `json-to-ini` — pure JS, easy.
- `csv-to-sql` (CREATE TABLE + INSERTs), `json-to-sql`.
- `json-to-python` (dataclass / TypedDict), `json-to-rust` (serde struct),
  `json-to-kotlin`, `json-to-java` (POJO), `json-to-csharp` (record).
- `json-to-proto` (protobuf message), `json-to-graphql` (SDL type),
  `json-to-mongoose` / `json-to-zod` / `json-to-io-ts` schema.
- `graphql-format` / `graphql-minify` — pure JS tokenizer.
- `jsonpath-eval` / `jmespath-eval` — evaluate a path expr against JSON. JMESPath
  needs a parser (~600 lines) — start with a dot/bracket JSONPath-lite.
- `json-flatten` / `json-unflatten` (dot-key ⇄ nested).
- `json-sort` (deep key sort — may fold into `json-format`), `json-stats`
  (depth, key count, largest array, value type histogram).
- `har-viewer` — parse a `.har` file → a request table (sizes, timings, status);
  **strip cookies/auth headers by default**, big privacy win vs online HAR
  viewers. File tool + `report`.
- `curl-to-code` — parse a `curl` command → fetch() / Python requests / HTTPie.
- `code-to-curl` — the reverse for a pasted fetch().
- `http-request-parser` — paste a raw HTTP request/response → structured table.
- `crontab-to-systemd-timer` and back.
- `dockerfile-lint` (basic best-practice checks), `docker-compose-to-run`.
- `env-diff` — diff two `.env` files (keys added/removed/changed, values masked).
- `package-json-scripts` — pretty-list `scripts` with descriptions.
- `semver-tools` — compare/satisfy/bump semver ranges (write a small semver impl).
- `git-diff-stat` — parse a unified diff → files/insertions/deletions table.
- `regex-explain` — annotate a regex token-by-token (mini railroad description).
- `regex-generate` — build a regex from examples (very hard to do well; skip
  unless a strong heuristic).
- `sql-minify`, `sql-to-json` (parse simple `SELECT`), `sql-parameterize`
  (replace literals with `?`), `sql-inject-detector` (heuristic).
- `sourcemap-lookup` — given a `.map` and a line/col, resolve the original
  position (VLQ decode — pure JS, ~120 lines).
- `crontab-guru-clone` — an interactive builder (needs a custom island; more
  than a `run()`).
- `hex-dump` / `hex-viewer` — file tool: classic `xxd` output (offset · hex ·
  ASCII), `report:'code'`.
- `binary-file-signature` — file tool: identify a file by magic bytes (embed a
  ~200-entry signature table). Great "what is this file" tool.
- `epoch-batch` — convert a whole column of timestamps at once.

### 10.4 More COLOUR / DESIGN / CSS

- `color-mixer-n` — average/blend N colours.
- `gradient-extract` — from an image, sample a horizontal/vertical gradient.
- `contrast-grid` — a matrix of N colours × N colours with pass/fail (great for
  design-system checks). `render:'table'`.
- `tailwind-color-finder` — nearest Tailwind palette token to a colour.
- `css-clamp-generator` — fluid `clamp()` from min/max viewport + size.
- `css-triangle` / `css-arrow` generator.
- `border-radius-generator` (per-corner + the `/` syntax).
- `glassmorphism` / `neumorphism` generators.
- `keyframes-generator` — build a `@keyframes` from stops.
- `svg-path-parser` — break a `d=""` into commands; `svg-path-round` (round
  coordinates); `svg-optimize` (a light DIY cleaner — remove metadata, collapse
  whitespace, round; `svgo` is heavy, don't add it).
- `svg-to-jsx` / `svg-to-react-component` / `svg-to-data-uri` (latter overlaps
  `image-to-datauri`).
- `favicon-from-emoji` — render an emoji to a PNG/ICO/SVG favicon (SVG `<text>` →
  the existing SVG→PNG path).
- `open-graph-preview` — paste HTML `<head>` → render the Google/Twitter/Slack
  card preview (visual; custom-ish component).
- `blurhash-decode` — BlurHash string → a preview PNG.
- `css-specificity` — compute the specificity of a selector.
- `unicode-emoji-picker` — searchable emoji + shortcode ⇄ emoji (needs an emoji
  dataset ~40 KB gzip; acceptable as a lazy chunk).

### 10.5 More NUMBERS / SCIENCE / UNITS

- `matrix-calculator` — add/multiply/transpose/determinant/inverse (small, pure).
- `equation-solver` — quadratic / linear systems (2–3 vars).
- `base-converter-fraction` — non-integer base conversion (`3.14` to base 2).
- `combinatorics` — nPr, nCr, factorial, Catalan, Fibonacci(n), Pascal row.
- `modular-arithmetic` — modpow, modinv, CRT, discrete log (small).
- `continued-fraction` — number ⇄ continued-fraction expansion.
- `roman-clock` — current time in Roman numerals (novelty).
- `physics-units` — a richer unit converter with derived units (N, Pa, J, W).
- `currency-format` — format a number as currency for a locale via
  `Intl.NumberFormat` (no live rates — formatting only).
- `number-spellout-multilang` — `Intl.NumberFormat` / `Intl` spellout where
  supported.
- `dice-probability` — probability distribution of `NdM` (table + text histogram).
- `interest-calculator` (simple vs compound), `retirement/SIP calculator`,
  `mortgage-affordability`.
- `unit-price` — compare "£X per Y" deals.
- `date-recurrence` — expand an RRULE (`FREQ=WEEKLY;...`) to the next N dates
  (pairs with `ical-event`).
- `business-days` — add/subtract working days with a holiday list option.
- `timezone-meeting-planner` — best overlap window across N zones (table).
- `stopwatch` / `countdown` / `pomodoro` / `world-clock` — **live UI**, need a
  custom island each. Good for engagement; lower SEO value; schedule as a small
  epic with shared timer utilities.

### 10.6 More IMAGE / MEDIA (canvas / WebCodecs, still local)

- `image-to-ascii` — ASCII-art from an image (brightness ramp). `report:'code'`.
- `image-pixelate` / `image-dither` (Floyd–Steinberg, ordered) / `image-posterize`
  / `image-grayscale` / `image-sepia` / `image-invert` / `image-threshold`.
- `image-blur` / `image-sharpen` / `image-brightness-contrast` /
  `image-hue-saturation` — canvas convolution / per-pixel.
- `image-border` / `image-round-corners` / `image-drop-shadow` (canvas compose).
- `image-watermark` (text or a second image).
- `image-collage` / `image-grid` (folds into `image-spritesheet`).
- `image-color-replace` — swap one colour for another with tolerance.
- `image-remove-background` — **needs an ML model** (`@imgly/background-removal`
  is ~5 MB WASM+model). Deferred; would be a flagship if the size is acceptable
  as a lazy, clearly-labelled download.
- `image-upscale` — same story (Real-ESRGAN WASM). Deferred.
- `exif-remove` — strip metadata by canvas re-encode; also a proper
  metadata-only strip that keeps the pixels bit-exact (rebuild the JPEG without
  APP1). The bit-exact version is the differentiator vs "just re-encode".
- `heic-to-jpeg` — `libheif` WASM (~2 MB). Deferred; very high demand though.
- `apng` / `gif` assembly from frames — `gifenc` is MIT ~5 KB (a possible dep).
  `webp-animated` via WebCodecs where available.
- `video-to-gif` / `video-trim` / `video-thumbnails` / `video-mute` — **WebCodecs
  API** where available (Chrome/Edge, Safari 17+, Firefox partial). No ffmpeg.
  `video-to-gif` needs a GIF encoder. Big feature; own epic; feature-detect and
  degrade gracefully.
- `screen-recorder` / `webcam-recorder` — `getDisplayMedia` / `getUserMedia` +
  `MediaRecorder` → download WebM. Live UI; own small epic. Strong "no upload"
  story.
- `audio-recorder` — `MediaRecorder` mic → WAV/WebM. Live UI.
- `spectrogram` / `waveform` viewer — canvas render from decoded audio.
- `audio-visualizer` (offline render to a video via WebCodecs — advanced).
- `midi-to-notes` — parse a `.mid` file → a note list (pure JS binary parse).
- `wav-to-c-array` / `image-to-c-array` — embed binary as a C/Rust array
  (embedded-dev niche, cheap).

### 10.7 More DOCUMENT / PDF / OFFICE (local)

- `pdf-compress` — recompress embedded images (needs pdfjs to extract + canvas to
  re-encode + pdf-lib to rebuild). Medium-hard; high demand.
- `pdf-crop` / `pdf-resize-pages` / `pdf-n-up` (2/4 pages per sheet) /
  `pdf-booklet` (imposition) / `pdf-add-blank-pages`.
- `pdf-form-fill` — list form fields, fill them, flatten.
- `pdf-form-extract` — dump form field values to JSON/CSV.
- `pdf-split-by-bookmarks` — one PDF per top-level outline entry.
- `pdf-attachments-extract` — pull embedded files.
- `pdf-redact` — draw opaque boxes AND remove the underlying text/image (true
  redaction, not just a black rectangle) — a real differentiator; hard.
- `pdf-sign-visual` — place a signature image/date stamp (not cryptographic).
- `pdf-ocr` — **tesseract.js** (Apache-2.0, ~2 MB WASM + ~10 MB language model,
  lazy). Deferred; would be a flagship. Clearly label the model download.
- `docx-to-text` / `docx-to-markdown` / `docx-to-html` — DOCX is a zip of XML;
  `fflate` + a DIY XML walk can extract text and basic structure. `xlsx-to-csv` /
  `xlsx-to-json` similarly (SheetJS community `xlsx` is MIT but big — DIY the
  common case). `pptx-to-text`. `odt`/`ods` are also zipped XML.
- `epub-to-text` / `epub-metadata` — EPUB is a zip; extract text + OPF metadata.
- `rtf-to-text` — RTF control-word stripping (pure JS).
- `mbox-viewer` / `eml-viewer` — parse an `.eml` (RFC 822) → headers + body +
  attachments; **local, no upload** — strong privacy angle for "read this
  suspicious email safely". File tool + report.
- `ics-viewer` — parse a `.ics` → an event table (pairs with `ical-event`).
- `vcf-viewer` — parse a multi-contact `.vcf` → a table (pairs with `vcard`).
- `csv-to-vcard` / `csv-to-ics` — bulk generate.
- `markdown-to-pdf` — `marked` → HTML → a simple pdf-lib layout (text only,
  basic). Hard to do well; consider `markdown-to-docx` (zip+XML) instead.
- `text-to-pdf` — paste text → a clean paginated PDF (pdf-lib + a monospace or
  Helvetica layout, page numbers). Genuinely useful, moderate effort.

### 10.8 More NETWORK / DEV-OPS

- `dns-record-format` — build/validate SPF, DKIM, DMARC, MX, TXT, CAA records
  (pure logic; no lookups).
- `spf-flattener` / `spf-explain` — parse an SPF string, explain each mechanism.
- `url-shortener-preview` — decode common shortener params / UTM without
  following (no network). Detect tracking params and offer a "clean URL".
- `tracking-param-stripper` — remove `utm_*`, `fbclid`, `gclid`, `mc_eid`, etc
  from a URL. Very popular; trivial.
- `user-agent-builder` — compose a UA string from parts.
- `robots-tester` — given a `robots.txt` + a path + a UA, is it allowed?
- `sitemap-validator` / `sitemap-generator` (from a pasted URL list).
- `htaccess-generator` (redirects, gzip, cache headers) / `nginx-config-snippet`.
- `csp-builder` — assemble a Content-Security-Policy from checkboxes; explain
  each directive; report the header + a `<meta>` form.
- `jwt-cookie-decoder` — decode a `Set-Cookie` header / a cookie string into a
  table (flags, expiry, samesite).
- `curl-header-analyzer` — paste response headers → security-header scorecard
  (HSTS, CSP, X-CTO, etc), like securityheaders.com but local.
- `ip-geolocation` — **needs data or a service**; the only privacy-safe option is
  embedding a coarse IP-range→country table (MaxMind GeoLite is CC-BY-SA and
  ~6 MB). Deferred / probably skip.
- `whois-format` — parse a pasted WHOIS response into fields (no lookup).
- `mac-vendor-lookup` — needs the OUI database (~3 MB). Deferred; or a curated
  top-500 subset.
- `cidr-merge` / `cidr-overlap` / `ip-list-dedupe` — set operations on IP lists.
- `port-scan-explainer` — (education only — describe common ports/services).

### 10.9 More GENERATORS / MISC

- `barcode-generator` — Code128 / EAN-13 / UPC-A / Code39 as SVG (pure JS
  encoders, ~150 lines each). High demand.
- `barcode-reader` — `BarcodeDetector` API where available; fall back to a note.
- `qr-reader` — `BarcodeDetector`; fallback: a bundled `jsQR` (MIT, ~40 KB) —
  possible dep.
- `credit-card-generator` (Luhn-valid **test** numbers, clearly labelled) /
  `credit-card-validator` (Luhn + brand detection) / `iban-generator` /
  `iban-validator` (mod-97) / `bic-validator` / `isbn-validator` (ISBN-10/13
  check digit) / `issn` / `ean-validator` / `vat-number-validator` (per-country
  format + checksum) / `imei-validator` (Luhn).
- `us-ssn` / `uk-ni-number` / `aadhaar` / `pan` **format** validators (checksum
  only, never "generate a real one").
- `slug-history` — n/a.
- `name-generator` (fantasy / band / startup / project codename) — word lists.
- `username-generator` / `handle-availability-format` (just formatting rules).
- `password-strength-meter` — DIY entropy + pattern penalties (no zxcvbn).
- `diceware` (already `passphrase`) — add EFF long list as an option if the ~40 KB
  is acceptable.
- `gradient-noise` / `perlin-preview` — generate a noise texture PNG.
- `identicon` / `gravatar-hash` — deterministic avatar from a string (identicon
  is a small algorithm; gravatar is just `md5(email.trim().toLowerCase())` + the
  URL pattern — show the hash, not a fetch).
- `jdenticon` / `blockies` (Ethereum-style) avatars — small MIT algorithms.
- `qr-art` — QR with a logo overlaid (compose in canvas).
- `wifi-qr` (folded into `qr-code`), `crypto-address-qr`.
- `mnemonic-phrase` — BIP-39 mnemonic generate/validate (needs the 2048-word
  list ~13 KB + PBKDF2). Clearly label "for testing / education".
- `lorem-picsum-local` — `placeholder-svg` with a seeded abstract pattern instead
  of text.
- `ascii-table` — a reference of ASCII 0–127 (dec/hex/oct/char/name) `render:table`.
- `html-entity-reference` — searchable table of named entities.
- `keycode-reference` — `event.key` / `event.code` / `keyCode` lookup (needs a
  live-capture island).
- `regex-cheatsheet` / `crontab-cheatsheet` / `git-cheatsheet` — **content
  pages**, not tools (Epic E6-S4).
- `color-names-reference`, `mime-types-reference`, `http-headers-reference`,
  `status-codes-reference` — reference tables / content pages.

### 10.10 Platform features (beyond tools)

- **Tool favourites / recents** — pin tools; `localStorage`; a "Recent" row on
  the home page.
- **Command palette** — extend the search dialog to also run actions ("toggle
  theme", "open privacy", "copy link").
- **Batch / pipeline mode** — chain tools (output of A → input of B), CyberChef
  "recipe"-style. Big feature; own epic. Keep each step a pure `run()`.
- **Tool embedding** — a documented `<iframe>` / web-component embed of a single
  tool for other sites (still 100% client-side).
- **Keyboard-first "quick tool"** — `/` then type "b64 encode hello" → runs it
  inline. Natural-language-lite command bar.
- **Share via URL** (E7-T7) and **share via file** (download a `.toolbench.json`
  of input+options).
- **Dark/light/high-contrast themes**, **font-size control**, **dyslexia-friendly
  font toggle**.
- **PWA file handlers** — register as a handler for `.json`, `.csv`, `.pdf`,
  `image/*` so "Open with Toolbench" appears in the OS. `file_handlers` in the
  manifest + a landing route that routes to the best tool.
- **Web Share Target** — accept shared files/text from other apps (Android).
- **Offline-first tool packs** — let the user pre-cache a whole category for
  flights.
- **i18n** (Epic E9) — start with the chrome; community translations.
- **Accessibility statement** page; **VPAT**-lite.
- **Public JSON API of the catalogue** (`/tools-index.json` exists) — document it;
  add `/tools/<id>/meta.json`.
- **"How we're different" page** — the verified privacy story vs Smallpdf/iLovePDF
  et al., with the DevTools-Network screenshot recipe.
- **Changelog** page (generated from git tags).
- **Status/telemetry**: none by default; if ever added, a single self-hosted
  aggregate counter, documented, opt-in, CSP-listed (E10-T5).
- **Contribution flow**: "Suggest a tool" form that just opens a pre-filled
  GitHub issue (a link, no backend).

### 10.11 Quality / infra ideas

- **Visual regression** — Playwright screenshot snapshots for the home + 10 tool
  pages, per theme, per breakpoint.
- **Mutation testing** (`stryker`) on `src/tools/**` `run()` functions — high ROI
  for pure logic. `stryker` is a devDep (get sign-off).
- **Bundle analyzer** in CI artefacts (`rollup-plugin-visualizer`).
- **`size-limit`** budgets per tool chunk.
- **Type-coverage** gate (`type-coverage` ≥ 99%).
- **`knip`** to find dead exports/files.
- **Renovate/Dependabot** config (grouped, pinned) once public.
- **Pre-commit hook** (husky + lint-staged) — was in the old draft; re-add.
- **CONTRIBUTING "add a tool" codemod** — a `plop`/`hygen` generator that scaffolds
  the 3 files from a prompt. (`scripts/new-tool.mjs`, Node only, no dep.)
- **`docs/BROWSER-MATRIX.md`** kept current.
- **Fuzzing corpus** committed under `test/corpus/` for the parser tools.
- **Perf**: precompute the search index at build (done) and consider a tiny
  client-side fuzzy matcher upgrade (`uFuzzy`, MIT, ~5 KB — possible dep).
- **A11y**: automated `axe` on every tool page in e2e (currently a sample).
- **SEO**: an `llms.txt` at the root describing the catalogue for AI crawlers.

---

## 11. GLOSSARY

- **Tool** — a `run()` function + `meta`, discovered from `src/tools/**`.
- **Workbench** — the shared UI (`TextWorkbench` / `FileWorkbench`) that renders
  a tool's options, input, output, and controls. You never write one per tool.
- **`render` kind** — how the workbench displays `output` (`text` / `code` /
  `image` / `colors` / `table` / `diff` / `audio`). All XSS-safe.
- **`report`** (after E2-S1) — an inline text/table result for a **file** tool
  (metadata, listings) that does not produce a downloadable file.
- **`ToolError`** — a thrown error meant for the user, with an optional `hint`;
  the workbench shows it in a friendly box. Import from `@/lib/types`.
- **`resolveOptions(meta, values)`** — merges the caller's option values over the
  declared `default`s so `run()` behaves the same from the UI and from a test.
- **Gate** — `npm run check && npm run lint && npm test && npm run build`, all
  green. Nothing is "done" until the gate passes.
- **On-device** — runs entirely in the browser tab; no server, no network
  request, works offline. The whole point.

---

_End of backlog. When every box in §7 and §8 is `[x]` and §10's promoted items
are scheduled, this file is the finished specification of Toolbench._
