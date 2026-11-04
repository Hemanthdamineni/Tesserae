import { expect, test } from '@playwright/test';

test.describe('recently used tools', () => {
  test('a visited tool appears on the home page', async ({ page }) => {
    await page.goto('/tools/base64');
    await page.goto('/');

    const section = page.locator('#recent-tools');
    await expect(section).toBeVisible();
    await expect(section.getByRole('link', { name: 'Base64 Encode / Decode' })).toBeVisible();
    await expect(section.getByRole('link')).toHaveAttribute('href', /\/tools\/base64$/);
  });

  test('the row stays hidden for a first-time visitor', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#recent-tools')).toBeHidden();
  });
});
