# Deployment

The build output is a plain folder of static files. Any static host works.

```bash
SITE_URL=https://your-domain.example BASE_PATH=/ npm run build   # writes dist/
```

Two environment variables drive the build:

| Variable    | Default                                                    | Meaning                                            |
| ----------- | ---------------------------------------------------------- | -------------------------------------------------- |
| `SITE_URL`  | `https://hemanthdamineni.github.io/browser-tools-platform` | Canonical origin. Sets Astro's `site`.             |
| `BASE_PATH` | `/browser-tools-platform`                                  | Path the site is served from. Sets Astro's `base`. |

`SITE_URL` must be the final public origin — it is baked into canonical URLs,
the sitemap, `robots.txt`, JSON-LD and the OpenSearch descriptor. `BASE_PATH` is
prefixed to every internal asset, link, the web manifest and the service
worker's precache list; it is normalised to a leading slash with no trailing
slash (`/my-repo/` and `my-repo` both become `/my-repo`), and `/` means the
domain root.

At the domain root, always set `BASE_PATH=/` — e.g.
`SITE_URL=https://your-domain.example BASE_PATH=/ npm run build`.

## GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `master`
(and on manual _Run workflow_). It sets `SITE_URL` and `BASE_PATH` from the
repository, so renaming the repo needs no edit:

```yaml
SITE_URL: https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}
BASE_PATH: /${{ github.event.repository.name }}
```

One-time setup:

1. Repo → **Settings → Pages**.
2. **Build and deployment → Source: GitHub Actions** (not "Deploy from a branch").
3. Push to `master`; the workflow uploads `dist/` and deploys it.

The workflow holds `contents: read`, `pages: write` and `id-token: write`, is
serialised by a `concurrency: pages` group, and is skipped when the repository
is a fork.

## Netlify / Cloudflare Pages

Zero config. `netlify.toml` and `public/_headers` are already in the repo.

- Build command: `npm run build`
- Publish directory: `dist`
- Environment: `SITE_URL=https://your-domain` and `BASE_PATH=/` (the site is
  served from the domain root)

## Vercel

`vercel.json` is included (static build + header rules). Set
`SITE_URL=https://your-domain` and `BASE_PATH=/` in the project's environment
variables.

## Self-hosting (S3 / nginx / Caddy)

Serve `dist/` as-is. Apply the headers from `public/_headers` in your server
config. The important ones:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Cache-Control: public, max-age=31536000, immutable        # only for /_astro/*
Cache-Control: no-cache                                    # for /sw.js
```

`Content-Type: application/manifest+json` for `/manifest.webmanifest`.

### nginx snippet

```nginx
location /_astro/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
location = /sw.js { add_header Cache-Control "no-cache"; }
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
```

## Custom domain + PWA

- Serve the site at the domain root: set `BASE_PATH=/` and
  `SITE_URL=https://yourdomain` (no trailing slash), then rebuild. GitHub Pages
  also needs the domain in **Settings → Pages → Custom domain** and a
  `CNAME`-style DNS record at your registrar.
- HTTPS is required for the service worker and install prompt.
- After changing `site.name` / `site.themeColor` in `src/lib/site.ts`, re-run
  `node scripts/gen-icons.mjs` if you also change the brand colour.
- `og.png`, icons and favicons are committed; regenerate with the same script.

## Rollback

Static output — redeploy the previous build.

- **GitHub Pages**: open the workflow run for the last known-good commit
  (**Actions → Deploy to GitHub Pages → that run**) and use **Re-run all jobs**,
  or run the workflow manually from the good commit with **Run workflow**.
  Rolling back the commit and pushing is equivalent and keeps history clean.
- **Other hosts**: redeploy the previous `dist/` (Netlify and Vercel both keep
  an immutable deploy history with one-click _Publish deploy_).

The service worker is network-first for navigations and versioned (`VERSION` in
`public/sw.js`); bump it when the shell changes so clients drop stale caches.
