import { test, expect, request as pwRequest, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * Full-catalogue runtime audit — a permanent regression gate.
 *
 * The fast smoke sweep (`e2e/smoke.spec.ts`) only clicks the first example of
 * each text tool and never runs file tools or panels. This spec clicks EVERY
 * example of every text/panel tool, runs a representative fixture through every
 * file tool, and asserts each run finishes without a page/console error or a
 * visible `[data-error]`. It is excluded from the default `test:e2e` and runs as
 * its own CI job via the `test:audit` npm script (`--grep deep-audit`).
 *
 * One Playwright test is created per shard, and each test loops its slice of the
 * catalogue sequentially, appending one JSON line per tool to
 * `test-results/deep-audit-report.jsonl` as it goes — so a single hanging tool
 * can never eat the whole budget or lose the partial report.
 */

interface ToolEntry {
  id: string;
  name: string;
  href: string;
  input: 'text' | 'file';
  hasExamples: boolean;
}

type AuditOutcome = { out: 'pass' | 'fail' | 'skip'; detail: string };

/**
 * Deliberate validators: they show a friendly `[data-error]` for the audit's
 * generic fixture, or need interaction the generic audit cannot drive. A
 * failure whose id is in this map is counted as "expected", never a bug.
 */
const ALLOWLIST: Record<string, string> = {
  'pdf-protect': 'needs a password',
  'pdf-unlock': 'needs a password',
  'pdf-merge': 'needs 2 files',
  'image-diff': 'needs 2 files',
  'audio-merge': 'needs 2 files',
  'image-blur-redact': 'needs drawn redaction regions first',
  'pdf-redact': 'needs drawn redaction regions first',
  'image-add-text': 'needs a text caption added first',
  'svg-to-png': 'audit fixture is a PNG, not SVG',
  'svg-sanitizer': 'audit fixture is a PNG, not SVG',
  'id3-tag-reader': 'fixture has no ID3 tag',
  'qr-scanner': 'fixture has no QR code',
  'video-extract-audio': 'fixture clip has no audio track',
  'pdf-fill-form': 'fixture has no form fields',
  'pdf-delete-pages': 'needs explicit pages',
  'speech-to-text': 'model download exceeds the wait budget',
  'background-remover': 'model download exceeds the wait budget',
  'pdf-sign': 'needs a signature drawn',
  'pdf-ocr': 'benign Tesseract "Estimating resolution" console message during OCR',
  stopwatch: 'live-UI panel; example click skipped',
  'html-playground': 'live-UI panel; example click skipped',
};

/** Tools whose example click is skipped: live-UI panels with no result pane. */
const SKIP_EXAMPLE_CLICKS: Record<string, true> = {
  stopwatch: true,
  'html-playground': true,
};

/** Per-tool hard cap so one hanging tool cannot eat the shard budget. */
const TOOL_CAP_MS = 60_000;
/** How long a single text/panel example may take to settle. */
const EXAMPLE_BUDGET_MS = 6_000;
/** How long a single file run may take to produce a result or error. */
const FILE_BUDGET_MS = 12_000;
/** How long a page may take to load before the tool is skipped. */
const NAV_BUDGET_MS = 15_000;

const fixturePath = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** Per-tool fixtures for strict format inspectors, whose accept list is a wildcard. */
const FIXTURE_BY_TOOL: Record<string, string> = {
  'aiff-inspector': 'sample.aiff',
  'avi-inspector': 'tiny.avi',
  'bmp-inspector': 'sample.bmp',
  'css-transform-inspector': 'sample.css',
  'dds-inspector': 'sample.dds',
  'flac-inspector': 'sample.flac',
  'gif-inspector': 'sample.gif',
  'icns-inspector': 'sample.icns',
  'ico-inspector': 'sample.ico',
  'jpeg-inspector': 'sample.jpg',
  'midi-inspector': 'sample.mid',
  'mp4-box-inspector': 'sample.mp4',
  'mpegts-inspector': 'sample.ts',
  'netpbm-inspector': 'tiny.pgm',
  'ogg-inspector': 'sample.ogg',
  'pcapng-inspector': 'tiny.pcapng',
  'psd-inspector': 'tiny.psd',
  'qoi-inspector': 'sample.qoi',
  'tar-inspector': 'sample.tar',
  'tga-inspector': 'sample.tga',
  'tiff-inspector': 'sample.tiff',
  'webp-inspector': 'sample.webp',
  'xcf-inspector': 'sample.xcf',
};

/** Pick a fixture whose extension/MIME the `accept` attribute covers, or null. */
function fixtureForAccept(accept: string | null): string | null {
  const a = (accept ?? '').toLowerCase();
  if (/pdf/.test(a)) return 'one-page.pdf';
  if (/heic|heif/.test(a)) return 'sample.heic';
  if (/docx|wordprocessingml|msword/.test(a)) return 'sample.docx';
  // Format-specific fixtures come before the generic video/image checks, since
  // their accept lists also mention video/* or image/*.
  if (a.includes('.pcap')) return 'tiny.pcapng';
  if (/\.pnm|\.pbm|\.pgm|\.ppm|portable/.test(a)) return 'tiny.pgm';
  if (a.includes('.avi') || a.includes('x-msvideo')) return 'tiny.avi';
  if (a.includes('.psd') || a.includes('.psb') || a.includes('photoshop')) return 'tiny.psd';
  if (/video|webm/.test(a)) return 'clip.webm';
  if (/audio|wav|mpeg|aac/.test(a)) return 'tone.wav';
  if (/image|png|jpeg|jpg|webp|svg|gif|avif|bmp/.test(a)) return 'tiny.png';
  return null;
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function record(report: string, line: Record<string, unknown>): void {
  appendFileSync(report, JSON.stringify(line) + '\n');
}

interface Captured {
  pageErrors: string[];
  consoleErrors: string[];
}

/** Attach error collectors for one tool run; returns a detach fn. */
function captureErrors(page: Page, captured: Captured): () => void {
  const onPageError = (err: Error) => captured.pageErrors.push(String(err.message || err));
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') captured.consoleErrors.push(msg.text());
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  return () => {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  };
}

/** True while a workbench run is in flight (run button disabled or skeleton up). */
async function isBusy(page: Page): Promise<boolean> {
  const runBtn = page.locator('[data-run]').first();
  const skeleton = page.locator('[data-skeleton]').first();
  const disabled = (await runBtn.count()) ? await runBtn.isDisabled().catch(() => false) : false;
  const skeletonVisible = (await skeleton.count())
    ? await skeleton.isVisible().catch(() => false)
    : false;
  return disabled || skeletonVisible;
}

/**
 * After triggering a run, wait for it to settle without burning the whole
 * budget on fast tools. A quick run finishes inside the initial settle window,
 * so it is never observed "busy" — the stale-result risk is avoided because we
 * only read the final state once the workbench is not busy (or the budget ends).
 * Returns 'result' | 'error' | 'idle' (no run/no pane) | 'timeout' (still busy).
 */
async function waitSettled(
  page: Page,
  budget: number,
): Promise<'result' | 'error' | 'idle' | 'timeout'> {
  const deadline = Date.now() + budget;
  // Fast runs start and finish inside this window; give them a beat to land.
  await delay(Math.min(300, budget));
  while (Date.now() < deadline) {
    if (await visibleErrorText(page)) return 'error';
    if (!(await isBusy(page))) {
      const shown = await page
        .locator('[data-result-wrap]')
        .first()
        .isVisible()
        .catch(() => false);
      return shown ? 'result' : 'idle';
    }
    await delay(100);
  }
  return 'timeout';
}

/** The visible `[data-error]` text, or '' when no error pane is shown. */
async function visibleErrorText(page: Page): Promise<string> {
  const error = page.locator('[data-error]').first();
  const shown = (await error.count()) ? await error.isVisible().catch(() => false) : false;
  if (!shown) return '';
  return ((await error.textContent().catch(() => '')) ?? '').trim();
}

function firstError(captured: Captured): string {
  return captured.pageErrors[0] || captured.consoleErrors[0] || '';
}

async function auditExamples(page: Page): Promise<AuditOutcome> {
  // Matches the generic text workbench's example buttons and the panel tools'
  // example chips (which live outside `[data-text-workbench]`).
  const examples = page.locator('[data-example]:visible');
  const n = await examples.count();
  if (n === 0) return { out: 'skip', detail: 'no examples' };
  const isPanel = (await page.locator('[data-panel-workbench]').count()) > 0;

  for (let i = 0; i < n; i++) {
    const captured: Captured = { pageErrors: [], consoleErrors: [] };
    const detach = captureErrors(page, captured);
    await examples
      .nth(i)
      .click()
      .catch(() => {});
    const settled = await waitSettled(page, EXAMPLE_BUDGET_MS);
    detach();

    const errText = await visibleErrorText(page);
    if (errText || firstError(captured)) {
      return { out: 'fail', detail: `example ${i}: ${firstError(captured) || errText}` };
    }
    // A panel may render its output live instead of in a result pane; only a
    // visible error (checked above) is a failure there.
    if (settled === 'idle' && !isPanel) {
      return { out: 'fail', detail: `example ${i}: no result pane appeared` };
    }
    if (settled === 'timeout') {
      return { out: 'fail', detail: `example ${i}: run still in flight` };
    }
  }
  return { out: 'pass', detail: `${n} example(s)` };
}

async function auditFile(page: Page, tool: ToolEntry): Promise<AuditOutcome> {
  const drop = page.locator('[data-drop]').first();
  if ((await drop.count()) === 0) return { out: 'skip', detail: 'no file drop zone' };
  const fileInput = drop.locator('input[type="file"]').first();
  if ((await fileInput.count()) === 0) return { out: 'skip', detail: 'no file input' };
  const accept = (await fileInput.getAttribute('accept').catch(() => null)) ?? '';
  const fixtureName = FIXTURE_BY_TOOL[tool.id] ?? fixtureForAccept(accept);
  if (!fixtureName) return { out: 'skip', detail: `no fixture for accept "${accept}"` };
  if ((await page.locator('[data-run]').count()) === 0)
    return { out: 'skip', detail: 'no run button' };

  const captured: Captured = { pageErrors: [], consoleErrors: [] };
  const detach = captureErrors(page, captured);
  await fileInput.setInputFiles(fixturePath(fixtureName)).catch(() => {});
  await page
    .locator('[data-run]')
    .first()
    .click()
    .catch(() => {});
  const settled = await waitSettled(page, FILE_BUDGET_MS);
  detach();

  const errText = await visibleErrorText(page);
  if (errText || firstError(captured)) {
    return { out: 'fail', detail: firstError(captured) || errText };
  }
  const produced = await page.evaluate(() => {
    const wrap = document.querySelector('[data-result-wrap]');
    const visible = !!wrap && wrap.getBoundingClientRect().height > 0;
    const links = document.querySelectorAll('[data-outputs] a').length;
    return visible || links > 0;
  });
  if (!produced) {
    const why = settled === 'timeout' ? 'run still in flight' : 'no result produced';
    return { out: 'fail', detail: `${why} (${fixtureName})` };
  }
  return { out: 'pass', detail: fixtureName };
}

const shardTotal = Number(process.env.AUDIT_SHARDS || '1');
const shardIndex = Number(process.env.AUDIT_SHARD || '0');

test.describe('deep-audit', () => {
  // The shard loops a slice of the catalogue itself; give it no wall clock and
  // rely on the per-tool cap to bound each iteration.
  test(`full-catalogue audit (shard ${shardIndex + 1}/${shardTotal})`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(0);
    mkdirSync('test-results', { recursive: true });
    const report = join('test-results', 'deep-audit-report.jsonl');

    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${baseURL}/tools-index.json`);
    const all = (await res.json()) as ToolEntry[];
    await ctx.dispose();

    // Interleaved slicing keeps every shard's mix of tool kinds representative.
    const slice = all.filter((_, i) => i % shardTotal === shardIndex);

    let passed = 0;
    let expected = 0;
    let skipped = 0;
    const realFailures: string[] = [];

    for (const tool of slice) {
      const started = Date.now();
      // The cap and the body race; the guard keeps exactly one record per tool
      // even when a tool is cut mid-flight and its body settles afterwards.
      let recorded = false;
      const commit = (
        kind: 'pass' | 'expected' | 'skip' | 'fail',
        reason: string | undefined,
        detail: string,
      ) => {
        if (recorded) return;
        recorded = true;
        if (kind === 'pass') {
          record(report, { id: tool.id, result: 'pass', ms: Date.now() - started, detail });
          passed++;
        } else if (kind === 'skip') {
          record(report, { id: tool.id, result: 'skip', reason, detail });
          skipped++;
        } else if (kind === 'expected') {
          record(report, { id: tool.id, result: 'expected', reason, detail });
          expected++;
        } else {
          record(report, { id: tool.id, result: 'fail', detail });
          realFailures.push(`${tool.id}: ${detail}`);
        }
      };

      const cap = delay(TOOL_CAP_MS).then(() => 'cap');

      // Hard per-tool cap: a hanging tool is cut and reported, never allowed to
      // eat the whole shard budget.
      const body = (async (): Promise<string | null> => {
        const navTimedOut = await Promise.race([
          page.goto(`${baseURL}${tool.href}`).then(() => false),
          delay(NAV_BUDGET_MS).then(() => true),
        ]);
        if (navTimedOut) {
          commit('skip', 'page load timeout', '');
          return null;
        }
        await page.waitForLoadState('domcontentloaded');
        // Panels mount their controls lazily; wait for the first one to exist
        // before probing, so a slow mount is not misread as "no examples".
        await page
          .locator('[data-example], [data-run], [data-drop]')
          .first()
          .waitFor({ state: 'attached', timeout: 5_000 })
          .catch(() => {});

        if (SKIP_EXAMPLE_CLICKS[tool.id]) {
          commit('expected', 'live-UI panel', '');
          return null;
        }

        const outcome =
          tool.input === 'file' ? await auditFile(page, tool) : await auditExamples(page);

        if (outcome.out === 'pass') {
          commit('pass', undefined, outcome.detail);
        } else if (outcome.out === 'skip') {
          commit('skip', outcome.detail, '');
        } else if (ALLOWLIST[tool.id]) {
          commit('expected', ALLOWLIST[tool.id], outcome.detail);
        } else {
          commit('fail', undefined, outcome.detail);
        }
        return null;
        // A capped run is abandoned mid-flight; swallow its late rejection.
      })().catch((err: unknown) => (err instanceof Error ? err.message : String(err)));

      const winner = await Promise.race([body, cap]);
      if (winner === 'cap') {
        // Tear the live document down so the abandoned run cannot pollute the
        // next tool's page.
        await page.goto('about:blank').catch(() => {});
        if (ALLOWLIST[tool.id]) {
          commit('expected', ALLOWLIST[tool.id], `per-tool cap (${TOOL_CAP_MS}ms) exceeded`);
        } else {
          commit('fail', undefined, `per-tool cap (${TOOL_CAP_MS}ms) exceeded`);
        }
      } else if (typeof winner === 'string' && winner !== 'cap') {
        if (ALLOWLIST[tool.id]) {
          commit('expected', ALLOWLIST[tool.id], winner);
        } else {
          commit('fail', undefined, winner);
        }
      }
    }

    console.log(
      `[deep-audit] shard ${shardIndex + 1}/${shardTotal}: audited=${slice.length} ` +
        `passed=${passed} expected=${expected} skipped=${skipped} realFailures=${realFailures.length}`,
    );
    if (realFailures.length) {
      console.log(`[deep-audit] real failures:\n  ${realFailures.join('\n  ')}`);
    }

    expect(realFailures, `real failures:\n${realFailures.join('\n')}`).toEqual([]);
  });
});
