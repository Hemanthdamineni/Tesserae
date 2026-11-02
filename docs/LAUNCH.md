# Launch: getting indexed by search engines and AI assistants

This is the operator checklist for making Toolbench discoverable. It covers what is already automated in the
repository, what only a human with account access can do, and how to verify each step.

Everything in the "Already in the repository" section ships with the code — nothing there needs an account.

## Already in the repository

| Artifact          | Route               | What it does                                                                                                                                                                                                                          |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sitemap           | `/sitemap.xml`      | Every visible tool, category, guide, and the static pages. Emits `<lastmod>` only when a tool carries a real `updated` date. Hidden aliases are excluded.                                                                             |
| Crawler policy    | `/robots.txt`       | Allows everything, names the AI crawlers explicitly (`GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `CCBot`, `Bytespider`), and points at the sitemap. |
| LLM catalogue     | `/llms.txt`         | [llmstxt.org](https://llmstxt.org)-shaped index: site summary, categories, and one line per tool with its absolute URL.                                                                                                               |
| LLM full text     | `/llms-full.txt`    | Same catalogue plus each tool's description, options, examples, and FAQ answers, so an assistant can answer questions without crawling 400 pages.                                                                                     |
| Machine catalogue | `/tools-index.json` | Per-tool JSON: id, name, category, input/render kinds, options, examples, FAQ, privacy, absolute URL.                                                                                                                                 |
| Structured data   | every page          | `WebSite` + `SearchAction` and `Organization` on the home page, `ItemList` on the tools and category listings, `SoftwareApplication` + `FAQPage` + `BreadcrumbList` per tool page, `HowTo` where a tool carries article steps.        |
| Social cards      | `/og/<id>.png`      | One 1200×630 card per tool, generated at build time by `npm run bundle:check`'s sibling script `scripts/gen-og.mjs`.                                                                                                                  |
| Canonical URLs    | every page          | Self-canonical absolute URLs built from `SITE_URL`; alias pages are `noindex,nofollow` and canonicalise to their replacement.                                                                                                         |

Each tool page also carries unique editorial content (`article`, ≥3 examples, ≥3 FAQ) — this is what stops the
catalogue reading as thin, duplicate utility pages. Two tests enforce it:
`src/lib/contract.test.ts` and `src/lib/related-tools.test.ts`.

## Deploying (GitHub Pages)

The workflow `.github/workflows/deploy.yml` builds and publishes on every push to `master`, and on manual
dispatch. Two variables define the canonical origin:

| Variable    | Meaning                                                | Value for GitHub Pages                 |
| ----------- | ------------------------------------------------------ | -------------------------------------- |
| `SITE_URL`  | Absolute canonical origin, **including** the base path | `https://<owner>.github.io/<repo>`     |
| `BASE_PATH` | The path the site is served from                       | `/<repo>` (or `/` for a custom domain) |

One-time setup, by the repository owner:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.** Without this the deploy job cannot
   publish.
2. Push to `master` (or run the workflow manually). The job prints the published URL.
3. Confirm the two variables were injected correctly by opening `/sitemap.xml` on the live site — every `<loc>`
   must start with the live origin.

### Custom domain later

Nothing in the code changes. The domain attaches to the Pages site, then:

1. Set `SITE_URL=https://yourdomain` and `BASE_PATH=/` (edit the env block in the workflow, or the Pages
   settings), and re-run the deploy.
2. Update `src/lib/site.ts` (`name`, `shortName`, `repository`, `social`) if the product name changes.
3. Re-submit the sitemap (below). Canonical URLs change with the domain, so expect a short re-index window.

## Submitting to search engines (needs your account)

These cannot be automated from the repository; they need a signed-in owner.

### Google Search Console

1. Go to <https://search.google.com/search-console> and add a **URL prefix** property for the exact live origin
   (e.g. `https://<owner>.github.io/<repo>/`).
2. Verify ownership. The easiest method for Pages is the **HTML tag** option: copy the `<meta name="google-site-verification" …>`
   tag and add it to `src/components/BaseHead.astro` (it already supports extra head content via the `head`
   slot), then redeploy. The **HTML file** method also works: drop the file into `public/`.
3. **Sitemaps → Add a new sitemap** → `sitemap.xml`.
4. Use **URL Inspection → Test live URL** on one tool page and one guide, then **Request indexing**. Expect a
   few days for the catalogue to be crawled; the bulk of the value comes from tools being linked from the
   category and listing pages, which are all in the sitemap.

### Bing Webmaster Tools

1. <https://www.bing.com/webmasters> → add the site. You can import verification directly from Search Console.
2. Submit `sitemap.xml`.
3. Bing also powers DuckDuckGo and (via index consumption) some AI answers, so it is worth the five minutes.

### AI assistants

There is no submission form. Being cited depends on being crawlable and quotable:

- `/llms.txt` and `/llms-full.txt` are the machine-readable entry points; the AI crawlers are explicitly allowed
  in `robots.txt`.
- `OAI-SearchBot` (ChatGPT search) is separate from `GPTBot` (training) — both are allowed deliberately.
- The unique per-tool prose and FAQ answers are what an assistant can quote; keep them accurate when a tool
  changes, since a wrong FAQ answer is worse than none.

## Verifying a deployment

Run these after every deploy:

```bash
ORIGIN=https://<owner>.github.io/<repo>
curl -sS "$ORIGIN/robots.txt"            | head -20   # sitemap line + named AI crawlers
curl -sS "$ORIGIN/sitemap.xml" | grep -c '<url>'     # expect ~400+ entries
curl -sS "$ORIGIN/llms.txt"              | head -20   # catalogue header + categories
curl -sS "$ORIGIN/tools-index.json" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)), "tools")'
curl -sSI "$ORIGIN/tools/base64" | head -5            # 200, canonical page
# One page with structured data, checked by eye or a validator:
curl -sS "$ORIGIN/tools/base64" | grep -o 'application/ld+json' | wc -l
```

Then the browser checks that cannot be curled:

- `/tools` renders the grid and the search dialog finds a tool by a keyword.
- One file tool from each of `image`, `pdf`, `video`, `archive` runs to a finished download.
- The install prompt appears (Chromium), and `/offline` lists cached tools after a reload with the network off.
- Lighthouse (mobile) on the home page and one tool page: Performance and SEO in the green.

## Rollback

Re-run the previous successful workflow run (Actions → the run → _Re-run all jobs_). The build is fully static,
so a rollback is just publishing the older artifact. If a bad service worker is cached in visitors' browsers,
bump the cache `VERSION` in `public/sw.js` and redeploy — the update flow prompts the visitor to reload.

## Monthly maintenance

`npm outdated` and `npm audit --omit=dev` before any dependency bump. The full gate is:

```bash
npm ci
npm run verify        # check, lint, format:check, unit tests, build, bundle budget, playwright
npm run docs:tools    # regenerate docs/TOOLS.md after adding or changing a tool
```

`npm run verify` includes the e2e sweep, so a red run means a real regression — do not push past it.
