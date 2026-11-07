/*
 * Tesserae service worker — dependency-free, no build step.
 *
 * Strategy:
 *   - Precache the app shell on install.
 *   - Same-origin GET: stale-while-revalidate (instant loads, fresh in the
 *     background). Hashed assets under /_astro/ are cache-first forever.
 *   - Navigation offline: fall back to the cached page, then /offline.
 *   - Never touches cross-origin requests — there are none in normal use.
 */

const VERSION = 'v3';
const RUNTIME = `tess-runtime-${VERSION}`;
const PRECACHE = `tess-precache-${VERSION}`;

// Base path derived from the service worker's own registration scope, so the
// worker works whether the app is served at the root or under a subpath (e.g.
// GitHub Pages project sites). Trailing slash dropped: `/my-repo/` -> `/my-repo`;
// at the root the scope is `/` and stays `/`.
const BASE = (self.registration.scope || '/').replace(/\/+$/, '') || '/';
// Absolute, scope-prefixed route: '/tools' -> '/my-repo/tools'; root -> '/tools'.
const route = (path) => (BASE === '/' ? path : `${BASE}${path}`);
// The immutable hashed assets directory, always under the base path.
const ASTRO_PREFIX = route('/_astro/');

// Machine-readable catalogue. Generated at build time from the tool registry
// (src/pages/tools-index.json.ts), so the precache list below always matches
// what actually shipped — no hand-maintained list to drift.
const TOOLS_INDEX = route('/tools-index.json');
// How many tool pages to precache. The index is alphabetical, so this is a
// stable, deterministic slice; the rest cache on first visit at runtime.
const TOOL_PRECACHE_LIMIT = 20;

const PRECACHE_URLS = [
  '/',
  '/tools',
  '/categories',
  '/privacy',
  '/about',
  '/offline',
  '/favicon.svg',
  '/tools-index.json',
].map(route);

/**
 * Precache the first N tool pages listed in the build-time index.
 *
 * Best-effort: each page is added on its own, so one missing or renamed route
 * can never fail the whole install (unlike `cache.addAll`). Extending the list
 * is a one-line change to `TOOL_PRECACHE_LIMIT`.
 */
async function precacheTopTools(cache) {
  const res = await fetch(TOOLS_INDEX, { cache: 'no-store' });
  if (!res.ok) return;
  const list = await res.json();
  if (!Array.isArray(list)) return;
  const urls = list
    .slice(0, TOOL_PRECACHE_LIMIT)
    .map((tool) => (tool && typeof tool.href === 'string' ? route(tool.href) : null))
    .filter(Boolean);
  await Promise.allSettled(urls.map((url) => cache.add(url)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(PRECACHE);
        try {
          await cache.addAll(PRECACHE_URLS);
        } catch {
          // A single missing shell URL must not abort the install.
        }
        try {
          await precacheTopTools(cache);
        } catch {
          // The tool index is an optimisation; offline still works without it.
        }
      } catch {
        // Storage was unavailable — still activate so the fetch handlers run.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('tess-') && k !== RUNTIME && k !== PRECACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable hashed assets: cache-first.
  if (url.pathname.startsWith(ASTRO_PREFIX)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations: network-first, fall back to cache, then /offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Only cache healthy responses; a 404/error must not poison the
          // runtime cache for a URL that may become valid later.
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match(route('/offline')) || Response.error()),
        ),
    );
    return;
  }

  // Everything else same-origin: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
