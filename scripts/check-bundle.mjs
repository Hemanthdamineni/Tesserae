#!/usr/bin/env node
// Bundle budget check. Run after `npm run build`.
//
// Usage: node scripts/check-bundle.mjs
//
// Reports every emitted JS chunk (raw + gzip, sorted descending), identifies the
// chunks a sample tool page loads eagerly, flags the known eager-bundle defect
// (a non-PDF tool page pulling in a chunk that contains `PDFDocument`), and
// PASS/FAILs against the budget below. Exits non-zero on failure. A missing
// `dist/` prints a warning and exits 0 so this never breaks an unbuilt tree.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// Budget — named thresholds, tune here first.
//
// T004 (board): the eager entry chunk that every tool page loads must stay well
// under 120 KB gzip. The whole promise of this site is that opening one tool
// downloads one small module, so an entry chunk that creeps past the budget is a
// regression for every page, not just the heaviest tool.
// ---------------------------------------------------------------------------
const EAGER_TOOL_ENTRY_GZIP_KB = 120; // eager JS for a single tool page, gzip
const ANY_SINGLE_CHUNK_GZIP_KB = 1200; // safety cap on any one emitted chunk
const TOTAL_ASTRO_GZIP_KB = 2048; // sum of all emitted JS, gzip
// A representative tool page whose <script type="module"> /
// <link rel="modulepreload"> references define the eager set.
const SAMPLE_TOOL_PAGE = 'tools/base64/index.html';
// How many tool pages to inspect (strided across the whole list).
const SAMPLE_LIMIT = 40;
// Rows printed before the table is truncated.
const TABLE_LIMIT = 50;
// Token that marks a chunk as carrying the PDF engine (pdf.js `PDFDocument`).
const PDF_TOKEN = 'PDFDocument';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const astroDir = join(dist, '_astro');

const kb = (bytes) => bytes / 1024;
const fmtKb = (bytes) => kb(bytes).toFixed(1);

if (!existsSync(dist)) {
  console.warn('[check-bundle] dist/ not found — nothing to check.');
  console.warn(
    '[check-bundle] Run `npm run build` first. Exiting 0 (never break an unbuilt tree).',
  );
  process.exit(0);
}
// --- Emitted JS chunks ------------------------------------------------------
function listFiles(dir, filter, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, filter, out);
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}

const chunks = listFiles(astroDir, (name) => name.endsWith('.js'))
  .map((full) => {
    const buf = readFileSync(full);
    return {
      ref: relative(dist, full).split(/[\\/]/).join('/'),
      bytes: buf.length,
      gzip: gzipSync(buf, { level: 9 }).length,
      hasPdf: buf.includes(PDF_TOKEN),
      eagerOn: new Set(),
    };
  })
  .sort((a, b) => b.gzip - a.gzip);
if (!chunks.length) {
  console.warn('[check-bundle] No JS chunks found in dist/_astro — nothing to check. Exiting 0.');
  process.exit(0);
}
const byRef = new Map(chunks.map((c) => [c.ref, c]));

// --- HTML reference parsing -------------------------------------------------
function attr(tag, name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return m ? (m[1] ?? m[2]) : null;
}

/** `/_astro/x.js` (or a nested path) → `_astro/x.js`, ignoring query/hash. */
function chunkRef(url) {
  const clean = String(url ?? '').split(/[?#]/)[0];
  const m = /(?:^|\/)(_astro\/.+\.js)$/.exec(clean);
  return m ? m[1] : null;
}

function parseRefs(html) {
  const entries = [];
  const preloads = [];
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if ((attr(tag, 'type') ?? '').toLowerCase() !== 'module') continue;
    const ref = chunkRef(attr(tag, 'src'));
    if (ref) entries.push(ref);
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
    if (!rel.includes('modulepreload')) continue;
    const ref = chunkRef(attr(tag, 'href'));
    if (ref) preloads.push(ref);
  }
  return { entries: [...new Set(entries)], preloads: [...new Set(preloads)] };
}
// --- Walk sample tool pages ------------------------------------------------
const toolPages = listFiles(join(dist, 'tools'), (name) => name === 'index.html').sort();
const sample = SAMPLE_TOOL_PAGE.split('/')[1];
const sampleTail = join('tools', sample, 'index.html');
const samplePage = toolPages.find((p) => p.endsWith(sampleTail));
const rest = toolPages.filter((p) => p !== samplePage);
const stride = Math.max(1, Math.floor(rest.length / (SAMPLE_LIMIT - 1)));
const sampled = rest.filter((_, i) => i % stride === 0).slice(0, SAMPLE_LIMIT - 1);
if (samplePage) sampled.unshift(samplePage);

const pages = [];
for (const file of sampled) {
  const ref = relative(dist, file).split(/[\\/]/).join('/');
  const { entries, preloads } = parseRefs(readFileSync(file, 'utf8'));
  const keep = (r) => byRef.has(r);
  const info = {
    ref,
    id: ref.split('/')[1],
    isPdf: /^pdf-|^pdf$|-pdf$/.test(ref.split('/')[1]),
    entries: entries.filter(keep),
    preloads: preloads.filter(keep),
  };
  pages.push(info);
  for (const r of [...info.entries, ...info.preloads]) byRef.get(r).eagerOn.add(ref);
}

// --- Report -----------------------------------------------------------------
console.log('[check-bundle] Emitted JS (sorted by gzip size):');
console.log(
  '  #  ref(relative)                             raw(KB)  gzip(KB)  pdf   eagerly-loaded-by',
);
for (const [i, c] of chunks.slice(0, TABLE_LIMIT).entries()) {
  const where = c.eagerOn.size
    ? c.eagerOn.size > 3
      ? `${c.eagerOn.size} tool pages`
      : [...c.eagerOn].map((p) => p.split('/')[1]).join(', ')
    : '-';
  console.log(
    `  ${String(i + 1).padStart(2)}  ${c.ref.padEnd(42)} ${fmtKb(c.bytes).padStart(7)} ` +
      `${fmtKb(c.gzip).padStart(7)}  ${(c.hasPdf ? 'YES' : 'no').padEnd(3)}  ${where}`,
  );
}
if (chunks.length > TABLE_LIMIT) {
  console.log(`  ... ${chunks.length - TABLE_LIMIT} more chunk(s) not shown`);
}
const totalGzip = chunks.reduce((sum, c) => sum + c.gzip, 0);
const base = pages.find((p) => p.id === SAMPLE_TOOL_PAGE.split('/')[1]);

// The "eager entry chunk" is what a tool page pulls in via
// <script type="module" src>; if a page has only modulepreload hints, its
// largest preload stands in as the entry.
const entryChunks = new Map();
for (const page of pages) {
  const refs = page.entries.length
    ? page.entries
    : [...page.preloads]
        .sort((a, b) => (byRef.get(b)?.gzip ?? 0) - (byRef.get(a)?.gzip ?? 0))
        .slice(0, 1);
  for (const ref of refs) {
    if (!entryChunks.has(ref)) entryChunks.set(ref, new Set());
    entryChunks.get(ref).add(page.id);
  }
}

console.log('');
console.log(`[check-bundle] Emitted chunks: ${chunks.length}, ${fmtKb(totalGzip)} KB gzip total.`);
console.log(`[check-bundle] Sampled ${pages.length} of ${toolPages.length} tool pages.`);
if (base) {
  const refs = [...base.entries, ...base.preloads];
  const gz = refs.reduce((sum, r) => sum + byRef.get(r).gzip, 0);
  console.log(`[check-bundle] ${base.ref}: entry = ${base.entries.join(', ') || '(none)'}`);
  console.log(
    `[check-bundle]   ${refs.length} eager chunk(s), ${fmtKb(gz)} KB gzip — ` +
      refs.map((r) => `${r} (${fmtKb(byRef.get(r).gzip)} KB)`).join(', '),
  );
}
if (entryChunks.size) {
  const worst = [...entryChunks.keys()].sort(
    (a, b) => (byRef.get(b)?.gzip ?? 0) - (byRef.get(a)?.gzip ?? 0),
  )[0];
  console.log(
    `[check-bundle] Eager entry chunks: ${entryChunks.size}; worst ${worst} = ` +
      `${fmtKb(byRef.get(worst).gzip)} KB gzip (budget ${EAGER_TOOL_ENTRY_GZIP_KB} KB).`,
  );
} else {
  console.warn('[check-bundle] No eager chunk references found in sampled tool pages.');
}

// --- Verdict ----------------------------------------------------------------
const failures = [];
const warnings = [];
const eagers = [...entryChunks.entries()];

// 1. Worst eager entry chunk (the JS a tool page pulls in first). HARD FAIL:
//    this is the T004 defect — the entry every tool page pays for.
if (eagers.length) {
  const worst = eagers.sort(
    (a, b) => (byRef.get(b[0])?.gzip ?? 0) - (byRef.get(a[0])?.gzip ?? 0),
  )[0];
  const gz = byRef.get(worst[0]).gzip;
  if (kb(gz) > EAGER_TOOL_ENTRY_GZIP_KB) {
    failures.push(
      `Eager entry chunk ${worst[0]} is ${fmtKb(gz)} KB gzip ` +
        `(budget ${EAGER_TOOL_ENTRY_GZIP_KB} KB) — loaded by: ${[...worst[1]].slice(0, 8).join(', ')}`,
    );
  }
}

// 2. Any single chunk over its safety cap (advisory — scale of the largest
//    one-off chunk, not what a page pays on entry).
for (const c of chunks) {
  if (kb(c.gzip) > ANY_SINGLE_CHUNK_GZIP_KB) {
    warnings.push(
      `Chunk ${c.ref} is ${fmtKb(c.gzip)} KB gzip (cap ${ANY_SINGLE_CHUNK_GZIP_KB} KB).`,
    );
  }
}

// 3. Total emitted JS over budget (advisory — the sum of everything, including
//    lazy per-tool modules that only download on demand).
if (kb(totalGzip) > TOTAL_ASTRO_GZIP_KB) {
  warnings.push(
    `Total emitted JS is ${fmtKb(totalGzip)} KB gzip (budget ${TOTAL_ASTRO_GZIP_KB} KB).`,
  );
}

// 4. PDF engine leaking into a non-PDF tool page's eager set (HARD FAIL — the
//    known eager-bundle defect: a non-PDF page pays for the whole PDF engine).
const pdfEagerNonPdf = [];
for (const page of pages) {
  if (page.isPdf) continue;
  const eager = [...page.entries, ...page.preloads].filter((r) => byRef.get(r)?.hasPdf);
  if (eager.length) pdfEagerNonPdf.push({ id: page.id, refs: eager });
}
if (pdfEagerNonPdf.length) {
  const cap = 8;
  const shown = pdfEagerNonPdf.slice(0, cap);
  const more = pdfEagerNonPdf.length - shown.length;
  failures.push(
    `PDF engine (contains "${PDF_TOKEN}") is eagerly loaded by non-PDF tool page(s): ` +
      shown.map((p) => `${p.id} (${p.refs.map((r) => r.split('/').pop()).join(', ')})`).join('; ') +
      (more > 0 ? `; … and ${more} more` : ''),
  );
}

console.log('');
if (warnings.length) {
  console.log('[check-bundle] Advisory (does not fail the build):');
  for (const w of warnings) console.log(`  ! ${w}`);
  console.log('');
}
if (failures.length) {
  console.log('[check-bundle] FAIL');
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(
    '[check-bundle] Budget: ' +
      JSON.stringify(
        { EAGER_TOOL_ENTRY_GZIP_KB, ANY_SINGLE_CHUNK_GZIP_KB, TOTAL_ASTRO_GZIP_KB },
        null,
        2,
      ),
  );
  process.exit(1);
}
console.log('[check-bundle] PASS');
console.log(
  '[check-bundle] Budget: ' +
    JSON.stringify({ EAGER_TOOL_ENTRY_GZIP_KB, ANY_SINGLE_CHUNK_GZIP_KB, TOTAL_ASTRO_GZIP_KB }),
);
