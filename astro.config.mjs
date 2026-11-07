import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

/**
 * Public site URL. Override at build time with SITE_URL for your deployment,
 * e.g. `SITE_URL=https://your-domain npm run build`.
 */
const SITE_URL = process.env.SITE_URL || 'https://hemanthdamineni.github.io/Tesserae';

/**
 * Path the site is served from. Override at build time with BASE_PATH for a
 * subpath deployment (a GitHub Pages project site), e.g. `BASE_PATH=/my-repo`.
 */
const BASE_PATH = process.env.BASE_PATH || '/Tesserae';

/**
 * Normalise a base path to a leading slash and no trailing slash, so Astro's
 * `BASE_URL` never produces a doubled slash. `/` stays `/`.
 */
function normaliseBase(value) {
  const trimmed = value.trim();
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const stripped = withLeading.replace(/\/+$/, '');
  return stripped === '' ? '/' : stripped;
}

const base = normaliseBase(BASE_PATH);

const srcAlias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

// https://astro.build
export default defineConfig({
  site: SITE_URL,
  base,
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto',
    format: 'directory',
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  integrations: [],
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: srcAlias },
    build: {
      target: 'es2022',
      cssCodeSplit: true,
    },
    worker: {
      format: 'es',
      rollupOptions: {
        // Worker sub-build needs the alias too.
        plugins: [],
      },
    },
  },
  compressHTML: true,
});
