import { defineConfig, devices } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Whether the Playwright **WebKit** build is installed *and* can run here.
 *
 * The chromium project points at the system browser (`CHROMIUM_PATH`), so only
 * the `mobile-safari` project needs a downloaded binary. A download alone is not
 * enough on Linux: Playwright's WebKit build links against the Ubuntu libraries
 * it was built for (ICU 74, libjxl 0.8, flite voices), which a distribution such
 * as Arch does not provide. Probing the binary with `ldd` turns that into a
 * clear skip instead of a wall of launch errors. Use the Playwright container
 * (`npm run test:e2e:webkit`) when the host cannot run the bundled build.
 */
function webkitState(): 'ok' | 'missing' | 'unusable' {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), '.cache', 'ms-playwright'),
    // `PLAYWRIGHT_BROWSERS_PATH=0` installs browsers beside the package.
    join(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers'),
  ].filter((root): root is string => Boolean(root) && root !== '0');
  for (const root of roots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    const dir = entries.find((entry) => entry.startsWith('webkit-'));
    if (!dir) continue;
    if (process.platform !== 'linux') return 'ok';
    const exe = [
      join(root, dir, 'minibrowser-gtk', 'MiniBrowser'),
      join(root, dir, 'minibrowser-gtk', 'bin', 'MiniBrowser'),
      join(root, dir, 'minibrowser-wpe', 'bin', 'MiniBrowser'),
      join(root, dir, 'pw_run.sh'),
    ].find((candidate) => existsSync(candidate));
    if (!exe) return 'unusable';
    const probe = spawnSync('ldd', [exe], { encoding: 'utf8' });
    // If ldd is unavailable the check is inconclusive; let Playwright decide.
    if (probe.error || probe.status !== 0) return 'ok';
    return probe.stdout.includes('not found') ? 'unusable' : 'ok';
  }
  return 'missing';
}

const webkit = webkitState();
if (webkit !== 'ok') {
  console.warn(
    webkit === 'missing'
      ? '[playwright] Skipping the "mobile-safari" project: the WebKit browser binary is not installed.\n' +
          '            Run `npx playwright install webkit` to enable Safari (iOS) coverage.'
      : '[playwright] Skipping the "mobile-safari" project: the WebKit binary is installed but its\n' +
          '            system libraries are missing. Run `npm run test:e2e:webkit` to use the\n' +
          '            Playwright container, which bundles them.',
  );
}

/**
 * E2E + privacy assertions. Builds the static site and serves the `dist/`
 * output, then runs smoke + "no network egress" checks against real tools.
 */
const hasWebkit = webkit === 'ok';

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
