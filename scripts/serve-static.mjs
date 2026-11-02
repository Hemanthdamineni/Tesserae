/**
 * Minimal static file server for the e2e suite.
 *
 * Astro 7 daemonizes `astro preview` (it returns immediately and serves in a
 * background process), which Playwright reads as the webServer "exiting early".
 * `vite preview` stays in the foreground but applies SPA fallback, so a request
 * for `/tools/<id>` that hits no file returns `index.html` (the homepage)
 * instead of 404 — which breaks the directory-per-page static layout the smoke
 * sweep asserts on. This server serves the built `dist/` exactly: an exact
 * file, or `index.html` under the directory, or 404. No fallback, no rewrite.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(process.env.DIST_DIR || 'dist');
const PORT = Number(process.env.PORT || '4321');
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

function contentType(path) {
  const ext = extname(path).toLowerCase();
  return MIME[ext] ?? 'application/octet-stream';
}

/** Resolve a request path under ROOT, refusing traversal. */
function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const candidate = normalize(join(ROOT, decoded));
  // A normalized join already drops `..`, but guard anyway and forbid any path
  // that escapes the root.
  if (!candidate.startsWith(ROOT + sep) && candidate !== ROOT) return null;
  return candidate;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${HOST}`);
    const base = resolvePath(url.pathname);
    if (!base) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }

    // Exact file, else `index.html` under the directory, else 404.
    // `404.astro` builds as `404.html` (a file); a route with children builds
    // as a directory. Try the exact path, then `<path>.html`, then the
    // directory index, then 404.
    let file = base;
    const paths = [base, `${base}.html`, join(base, 'index.html')];
    let served = false;
    for (const candidate of paths) {
      try {
        const info = await stat(candidate);
        if (info.isFile()) {
          file = candidate;
          served = true;
          break;
        }
      } catch {
        /* try the next candidate */
      }
    }

    const data = await readFile(file);
    res.writeHead(200, { 'content-type': contentType(file) });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`static e2e server on http://${HOST}:${PORT} serving ${ROOT}`);
});
