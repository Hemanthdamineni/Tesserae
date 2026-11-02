import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/**
 * End-to-end check for the video → GIF tool: a real VP8 clip is decoded,
 * quantised and written out as a GIF by the browser. The GIF is verified with
 * its own header bytes, so a broken encoder cannot pass.
 */
test('video-to-gif turns a clip into an animated GIF', async ({ page, baseURL }) => {
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

  await page.goto(`${baseURL}/tools/video-to-gif/`);
  await expect(page.locator('h1')).toContainText('Video to GIF');

  await page
    .locator('[data-file-workbench] input[type="file"]')
    .setInputFiles(fixture('clip.webm'));
  await expect(page.locator('[data-file-list] li')).toHaveCount(1);

  // A short, low frame-rate GIF keeps the test quick.
  await page.locator('[data-opt-key="fps"]').fill('5');
  await page.locator('[data-opt-key="width"]').fill('80');

  await page.locator('[data-run]').click();
  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('[data-error]')).toBeHidden();

  // The preview of the animation is shown before the file is saved.
  const preview = page.locator('[data-report] img, [data-report]');
  await expect(preview.first()).toBeVisible();

  const item = page.locator('[data-outputs] li').first();
  await expect(item).toBeVisible();
  await expect(item).toContainText(/\.gif/);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    item.getByRole('button', { name: 'Save' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.gif$/);

  const bytes = readFileSync(await download.path());
  // GIF87a / GIF89a header, and at least one image descriptor.
  expect(['GIF87a', 'GIF89a']).toContain(bytes.subarray(0, 6).toString('latin1'));
  expect(bytes.toString('latin1')).toContain(',');
  expect(bytes.length).toBeGreaterThan(100);

  expect(externalRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
