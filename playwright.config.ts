import { defineConfig, devices } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Whether the Playwright **WebKit** build is installed.
 *
 * The chromium project points at the system browser (`CHROMIUM_PATH`), so only
 * the `mobile-safari` project needs a downloaded binary. Rather than letting
 * every run die with "Executable doesn't exist", that project is skipped with a
 * clear message when WebKit is absent.
 */
function webkitInstalled(): boolean {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), '.cache', 'ms-playwright'),
    // `PLAYWRIGHT_BROWSERS_PATH=0` installs browsers beside the package.
    join(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers'),
  ].filter((root): root is string => Boolean(root) && root !== '0');
  return roots.some((root) => {
    try {
      return readdirSync(root).some((entry) => entry.startsWith('webkit-'));
    } catch {
      return false;
    }
  });
}

const hasWebkit = webkitInstalled();
if (!hasWebkit) {
  console.warn(
    '[playwright] Skipping the "mobile-safari" project: the WebKit browser binary is not installed.\n' +
      '            Run `npx playwright install webkit` to enable Safari (iOS) coverage.',
  );
}

/**
 * E2E + privacy assertions. Builds the static site and serves the `dist/`
 * output, then runs smoke + "no network egress" checks against real tools.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath:
            process.env.CHROMIUM_PATH ||
            (process.platform === 'linux' ? '/usr/bin/chromium' : undefined),
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
    // Only registered when the WebKit binary is present — see `webkitInstalled`.
    ...(hasWebkit ? [{ name: 'mobile-safari', use: { ...devices['iPhone 13'] } }] : []),
  ],
  webServer: {
    // The suite addresses pages from the site root (`/tools/...`), so build the
    // e2e copy with a root base rather than the GitHub Pages project path.
    // Astro 7 daemonizes `astro preview` (returns immediately) and `vite
    // preview` applies SPA fallback (returns the homepage for a missing tool
    // page), so the e2e server is the tiny static server in
    // scripts/serve-static.mjs: exact directory-per-page serving, no fallback.
    command: 'BASE_PATH=/ npm run build && node scripts/serve-static.mjs',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    // A cold build of this catalogue takes minutes.
    timeout: 600_000,
  },
});
