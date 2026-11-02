# Adding a tool

A tool is **three co-located files** under `src/tools/<category>/`:

| File           | Purpose                                          | Loaded                                          |
| -------------- | ------------------------------------------------ | ----------------------------------------------- |
| `<id>.meta.ts` | metadata only (`export const meta`)              | eagerly, at build (cards, search, SEO, routing) |
| `<id>.tool.ts` | implementation (`export default` a `ToolModule`) | lazily, only when someone runs the tool         |
| `<id>.test.ts` | Vitest unit tests for `run()`                    | test run only                                   |

**Rules the registry enforces at build time** (`src/lib/registry.ts`):

- `meta.id` is unique, kebab-case, and **equals the filename base** (`base64` ⇒ `base64.meta.ts` / `base64.tool.ts`).
- `meta.id` never changes once shipped (it is the URL).
- `meta.category` is one of the ids in `src/lib/categories.ts`.
- `<id>.tool.ts` imports `meta` from `<id>.meta.ts` — **single source of truth**, no copy.
- `meta.summary` ≤ 120 characters.

## Contract

`run()` is a **pure function**: no DOM, no `window`, no `document`, no network.
It must work when called directly from a test with options omitted — so always
start with `resolveOptions`:

```ts
import { resolveOptions } from '@/lib/options';
const o = resolveOptions(meta, input.options);
```

Throw `ToolError(message, hint?)` for expected, user-facing failures (bad input,
unsupported format). Anything else is a bug and will surface as a generic error.

### Text tool (`input: 'text'`)

```ts
// src/tools/text/reverse.tool.ts
import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './reverse.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };
  const output = [...input.text].reverse().join('');
  return { output, stats: { characters: input.text.length } };
}

const tool: TextToolModule = { meta, run };
export default tool;
```

`TextRunResult.render` picks how the shared workbench displays `output` (all
variants are XSS-safe — `output` is never parsed as HTML):

| `render`           | `output` shape                                                       |
| ------------------ | -------------------------------------------------------------------- |
| `'text'` (default) | plain string                                                         |
| `'code'`           | plain string; set `language` for a label                             |
| `'image'`          | a `data:` URL                                                        |
| `'audio'`          | a `data:` or `blob:` audio URL; set `filename` for the download link |
| `'colors'`         | `JSON.stringify(string[])` of CSS colours                            |
| `'table'`          | `JSON.stringify({ headers: string[], rows: string[][] })`            |
| `'diff'`           | a unified-diff string                                                |

### File tool (`input: 'file'`)

```ts
import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { ToolError } from '@/lib/types';
import { meta } from './example.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) throw new ToolError('Choose a file.');
  input.signal?.throwIfAborted?.();
  input.onProgress?.(0, 'Reading');
  // ... produce Blobs ...
  return { outputs: [{ filename: 'out.txt', blob: new Blob(['hi']) }] };
}

const tool: FileToolModule = { meta, run };
export default tool;
```

File tools run in a Web Worker automatically. Honour `input.signal` (abort) and
call `input.onProgress(fraction 0..1, message)` for anything that isn't instant.

#### Inline reports (`report`)

A file tool that only needs to show text, a table, a colour list, etc. (metadata,
inspection, palette, audio-info …) can return `report` instead of — or in
addition to — downloadable files:

```ts
return {
  outputs: [], // may be empty when `report` is set
  report: {
    output: JSON.stringify({ headers: ['Algorithm', 'Hash'], rows: [['SHA-256', '…']] }),
    render: 'table', // any TextRunResult render kind ('audio' included)
    language: 'json', // only used by render: 'code'
  },
};
```

The report renders at the top of the results area, above any `outputs`.

### Metadata

```ts
import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'reverse', // === filename base
  name: 'Reverse Text',
  category: 'text',
  summary: 'Reverse a string character by character.', // <= 120 chars
  description: 'One or two sentences shown at the top of the page.',
  keywords: ['reverse', 'backwards', 'mirror', 'string'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'byWord', label: 'Reverse word order instead', type: 'boolean', default: false },
  ],
  examples: [{ title: 'Reverse "abc"', input: 'abc' }],
  faq: [{ q: 'Does it handle emoji?', a: 'Yes — it splits on code points.' }],
  related: ['case-convert', 'sort-lines'],
  status: 'stable',
};
```

If the tool bundles a third-party library, add it to `credits` **and** to
`NOTICE`:

```ts
credits: [{ name: 'pdf-lib', url: 'https://github.com/Hopding/pdf-lib', license: 'MIT' }],
```

Only libraries already in `package.json` may be used. If you need a new one, stop
and flag it — new dependencies are reviewed centrally for licence and weight.

## Options schema

`type` is one of `select | boolean | number | range | text | textarea`. Every
option needs `key`, `label`, `default`. `showWhen: { key, value }` hides a field
until another option matches.

## Tests

Cover, at minimum: a normal case with a known-good expected value, empty input,
invalid input (expect `ToolError`), and every option branch. Import the tool
directly:

```ts
import tool from './reverse.tool';
const out = (opts = {}) => (tool.run({ text: 'abc', options: opts }) as { output: string }).output;
```

## Checklist

- [ ] `npm run check` — 0 errors
- [ ] `npm run lint` — clean
- [ ] `npm test` — new tests pass, registry test still green
- [ ] `npm run build` — tool page renders
- [ ] Tool page: examples work, options work, errors are friendly, output copies/downloads
