import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/**
 * The signing flow is a panel rather than the generic workbench, so it gets
 * its own end-to-end test: pick a PDF, type a signature, sign, and check that
 * the downloaded PDF really carries a flattened image and no annotation.
 */
test('pdf-sign signs a PDF with a typed signature', async ({ page, baseURL }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  const externalRequests: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(`${baseURL}/`) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      externalRequests.push(url);
    }
  });

  await page.goto(`${baseURL}/tools/pdf-sign/`);
  await expect(page.locator('h1')).toContainText('Sign PDF');

  // 1. Choose the PDF.
  await page
    .locator('input[type="file"][accept="application/pdf"]')
    .setInputFiles(fixture('one-page.pdf'));
  await expect(page.locator('[data-file-list] li')).toHaveCount(1);

  // 2. Type a signature - the keyboard-reachable alternative to drawing.
  await page.locator('[data-signature-tab="type"]').click();
  await page.locator('[data-signature-text]').fill('Ada Lovelace');
  await expect(page.locator('[data-signature-status]')).toContainText(/signature/i);

  // 3. The sign button unlocks and the page preview shows the mark.
  await expect(page.locator('[data-run]')).toBeEnabled();
  await expect(page.locator('[data-page-canvas]')).toBeVisible();
  await expect(page.locator('[data-signature-box]')).toBeVisible();

  // 4. Sign it.
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('[data-error]')).toBeHidden();

  // 5. A signed PDF is offered for download.
  const item = page.locator('[data-outputs] li').first();
  await expect(item).toBeVisible();
  await expect(item).toContainText(/\.pdf/);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    item.getByRole('button', { name: 'Save' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  // 6. The signature is flattened into the page: an image, not an annotation.
  const bytes = readFileSync(await download.path());
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(bytes.toString('latin1')).toContain('/Image');
  expect(bytes.toString('latin1')).not.toContain('/Annots');

  expect(externalRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
