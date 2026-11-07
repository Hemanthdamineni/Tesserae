# Getting Tesserae into search results and AI answers

The site is live at <https://hemanthdamineni.github.io/Tesserae/> with its
[sitemap](https://hemanthdamineni.github.io/Tesserae/sitemap.xml),
[robots.txt](https://hemanthdamineni.github.io/Tesserae/robots.txt) (AI crawlers
explicitly allowed), [llms.txt](https://hemanthdamineni.github.io/Tesserae/llms.txt)
and [llms-full.txt](https://hemanthdamineni.github.io/Tesserae/llms-full.txt)
already published. Every URL below is verified reachable. What remains is the part only the
account owner can do: proving ownership in the search consoles and submitting.

All four steps together take roughly 20 minutes. Do them in this order.

---

## 1. Google Search Console (primary)

1. Open <https://search.google.com/search-console> and sign in with the Google account that owns
   the `Hemanthdamineni` GitHub account.
2. Add property → choose **URL prefix** → enter
   `https://hemanthdamineni.github.io/Tesserae/`
   (Use the URL-prefix type; the Domain type cannot verify a github.io subdomain.)
3. Verify ownership — two working methods, pick one:
   - **HTML file**: download the `googleXXXX.html` file Google offers, drop it in `public/`,
     commit to `master`, wait for the Pages deploy to finish (~3 min), then click Verify.
     The file must be reachable at the site root.
   - **HTML tag**: Google gives a `<meta name="google-site-verification" content="…">` tag. Add
     it to `src/components/BaseHead.astro` next to the other meta tags, commit, deploy, Verify.
4. Once verified: **Sitemaps** → enter `sitemap.xml` → Submit. Google should report
   "Discovered URLs: 423" within a day or two.
5. **URL inspection** (the search bar at the top): paste
   `https://hemanthdamineni.github.io/Tesserae/tools/base64/` → Request indexing.
   Do the same for `/`, `/guides/`, and 5–10 of the most-searched tools
   (json-format, qr-code, password, uuid, image-compress, pdf-merge). Requesting ~15 URLs gets
   the rest of the site crawled much faster; Google follows internal links from there.

### What to expect

- First tool pages typically appear in Google within 2–7 days; a full catalogue sweep takes
  2–6 weeks. Rankings for long-tail queries ("json to typescript online", "yaml lint browser")
  usually land first; single-word head terms take longer.
- Check **Performance → Queries** weekly. Pages getting impressions but weak positions are the
  candidates for new guides (see `docs/ROADMAP.md`).

## 2. Bing Webmaster Tools (feeds DuckDuckGo, Yahoo, Ecosia and many AI answer engines)

1. Open <https://www.bing.com/webmasters> and sign in with a Microsoft account.
2. Add site → the easiest path is **Import from Google Search Console** (one click if step 1 is
   done). Otherwise verify the same way as Google (HTML file in `public/`, deploy, verify).
3. **Sitemaps** → Submit `https://hemanthdamineni.github.io/Tesserae/sitemap.xml`.
4. Bing also has a bulk submission API reachable from the dashboard ("URL submission" → quota of
   10,000 URLs/month for new sites) — submit the tool-page URLs in batches of a few hundred.

## 3. IndexNow (instant pings to Bing + friends)

The repo has the machinery; it needs a one-time key file:

1. Generate a key: any 32-hex-char string, e.g. `openssl rand -hex 16`.
2. Put the key in `public/<key>.txt` (file content = the key, one line).
3. From the Bing dashboard (step 2), submit the key for verification, then start POSTing changed
   URLs to `https://api.indexnow.org/indexnow?key=<key>` after each deploy. This can be added as
   a final step in `.github/workflows/deploy.yml` once the key exists.

## 4. AI answer engines (ChatGPT, Perplexity, Claude, Gemini)

These do not have submission consoles — they discover via crawlers, which `robots.txt` already
invites (`GPTBot`, `ClaudeBot`, `Claude-User`, `PerplexityBot`, `Google-Extended`, `Applebot`
are explicitly allowed). Two levers speed discovery up:

- **llms-full.txt** gives a crawler the entire catalogue in one request; it is linked from
  `robots.txt`-adjacent convention and from the home page footer, so most AI crawlers find it on
  the first visit.
- **Perplexity** indexes mainly from Bing's index — completing step 2 is the direct lever.
- **ChatGPT search** uses Bing's index too. Same lever.
- **Google AI Overviews / Gemini** use Google's index — step 1 is the lever.

So: finish steps 1–2 and the AI engines inherit the work.

---

## Verification checklist (run after each step)

```bash
SITE=https://hemanthdamineni.github.io/Tesserae
curl -s -o /dev/null -w "%{http_code}\n" $SITE/sitemap.xml            # 200
curl -s $SITE/robots.txt | grep -c User-agent                        # > 10 (AI crawlers allowed)
curl -s -o /dev/null -w "%{http_code}\n" $SITE/.well-known/<key>.txt # 200 once IndexNow is set
```

## If the site moves to a custom domain

Set `SITE_URL` in the deploy workflow (`SITE_URL: https://<domain>`, `BASE_PATH: ''`), update the
`sites` list in Search Console / Bing (a new property is needed), and re-submit. All canonical
URLs are generated from those two variables, so nothing else changes.
