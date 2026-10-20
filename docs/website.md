# Website and live demos

The website and the live demos are built together and deployed as **one** Cloudflare Pages project
(`crotoolbox`, free plan). The demos are served under `/demo/`.

| | Website | Live demos |
|---|---|---|
| Folder | `site/` (Astro) | `demos/` (Node script, renders the real theme blocks) |
| Address | https://crotoolbox.com | https://crotoolbox.com/demo/ |
| Public? | Yes: sitemap, robots.txt, llms.txt, made to rank | **No**: every page `noindex, nofollow`, `X-Robots-Tag` header and `Disallow: /demo/` in robots.txt, not in the sitemap or llms.txt, `/demo/` redirects to `/` |
| Opened from | search, AI assistants, links | **only** the app's "See live demo" buttons (`demoUrl()` in `app/lib/site.ts`) |
| Counted in analytics | yes | yes (same domain, so Cloudflare Web Analytics sees the visits) |

`npm --prefix site run build` runs `astro build`, then `site/scripts/with-demos.mjs`, which builds the demos
(`npm --prefix demos ci && run build`) and copies `demos/dist/demo` into `site/dist/demo`. If the demos build
fails (or is out of sync with the app, see below), the website build fails too.

The website links to the demos only from the keyword pages (`site/src/keywords/`, "See it on a demo store", `rel="nofollow"`, new tab; Omar, 2026-10-18). Everywhere else it never links to them, and the demos don't link to each other or to the website pages
(only the "Install CRO Toolbox" button to the App Store listing). Every address the demos write starts
with `/demo` (`demos/src/base.mjs`, the build fails on any other absolute address), so a demo never
resolves to a website page (`/bundles/` is the website's, `/demo/bundles/<recipe>/` is a demo).

## Run and check locally

From the repo root:

```bash
npm --prefix site ci && npm --prefix site run dev          # website at http://localhost:4321
npm --prefix site run build                                 # must pass before merging (type check + build)

npm --prefix demos ci && npm --prefix demos run build       # demos only, into demos/dist/demo (fails if out of sync, see below)
npm --prefix demos run preview                              # http://localhost:4322/demo/upsell/ etc.
python3 -m http.server -d site/dist 4323                    # the website with the demos, after the site build: http://localhost:4323/demo/upsell/

# After the site build: checks on the built pages (both exit 1 on a problem)
node site/scripts/check-pages.mjs --all-links "/shopify-upsell-app/=shopify upsell app"   # one h1, keyword in title and description, JSON-LD, links, dashes
node site/scripts/check-a11y.mjs                                                         # alt text, headings in order, link and button names, labels, contrast
```

Add a line to `site/src/lib/changelog.ts` (shown on `/changelog/`) when an app change merges.

The demo build needs Node 22.18 or newer (it loads the app's TypeScript files directly).

Product photos: real photos in `site/public/products/` (free Burst stock photos; source and licence of
each in `demos/IMAGES.md`) are used by the demos and the website's product pictures. After changing
photos or a demo, refresh the website screenshots: `npm --prefix demos run build && PLAYWRIGHT_CHROMIUM=<chromium path>
npm --prefix demos run screenshots` (writes `site/src/assets/features/` and `bundles/`; CRO sections are
scrolled into view automatically).

## The live demos

- Addresses: `/<feature>/` for every feature key of `app/lib/catalog.ts`, underscores as hyphens
  (`cross_sell` → `/cross-sell/`), each design as `#design-1`, `#design-2`…; bundle recipes at
  `/bundles/<recipe>/` (`fbt`, `kit`, `mixmatch`, `growing`, `browse`, `any-n`). Build them in code with
  `demoUrl(featureKey, design?, recipe?)` from `app/lib/site.ts`.
- Each page: a top bar (feature name, Desktop/Phone, Install CRO Toolbox), then every design stacked,
  each one a demo store page ("Lumen Goods") in an iframe. Interactions work: add to cart, bundles,
  carousels, countdowns, tabs; a fake store backend in the page answers the storefront scripts.
- What is real: the Liquid blocks from `theme/`, the JS and CSS from `extensions/cro-storefront/assets`,
  the designs made with the app's own templates and save functions (`app/lib/*-design.ts`). Checkout
  features (payment and delivery rules, order limits, thank-you page, after-purchase offer) are faithful
  pictures, since checkout only runs inside Shopify.
- Product pictures are drawn as SVG (`site/src/lib/art.ts`); the video carousel uses public domain
  (CC0) sample clips from MDN until Omar has product videos.
- Kept in sync: `DEMOS` and `DEMO_RECIPES` in `app/lib/site.ts` list what has a demo (the app shows the
  button only for those). The demo build fails when a catalog feature has no demo, a demo isn't in
  `DEMOS`, or `DEMOS` lists something without a demo. It also fails on invalid JSON passed to a
  storefront script and on any page without `noindex`.

### Screenshots for the website

The website's feature, bundle and use case pages show pictures of the demos (only the keyword pages link to them):
`npm --prefix demos run build && npm --prefix demos run screenshots` writes
`site/src/assets/features/<feature>.jpg` and `site/src/assets/bundles/<recipe>.jpg`. It needs Playwright
with Chromium on your computer (see the top of `demos/screenshots.mjs`). Commit the pictures.

## Website content

- Feature pages: `site/src/lib/features.ts` (who it's for, what you can set, related features); the
  one line description comes from `app/lib/catalog.ts`, the template names from the app's design files.
- Use case and industry pages: `site/src/lib/usecases.ts`.
- Comparisons: `site/src/lib/competitors.ts`. Only facts with a source and the date checked; anything
  else shows "Not checked". Check the listings yourself from time to time and update the file.

### Adding an article (the blog at /blog/)

One Markdown file in `site/src/content/blog/`. The file name is the address: `my-question.md` becomes
`/blog/my-question/`. Copy an existing article and change the top block:

```
---
title: "How to add frequently bought together to Shopify"   # the question people search for
description: "One or two sentences, under 200 characters. Shown in Google and on the card."
date: 2026-10-20
category: "Bundles & AOV"   # Bundles & AOV, Product pages, Cart & checkout, Store design, Guides
cover: "features/upsell"    # a picture from site/src/assets (features/<feature> or bundles/<recipe>)
coverAlt: "What the picture shows"
feature: "upsell"           # the app feature the call to action at the end points to
---
```

Then write the article: answer the question in the first sentence, use `##` headings phrased as
questions, give the real steps in the app, and only claim what the app really does. No dashes in the
text. The table of contents, reading time, related articles, share image, sitemap and llms.txt entry
are made for you. Check it with `npm --prefix site run dev` and open `http://localhost:4321/blog/`.
The build (`npm --prefix site run build`) refuses a missing field or a wrong category.

Help center guides are the same, in `site/src/content/help/` (fields: title, description, order,
features). Tutorial videos come from `app/lib/tutorials.ts`: when a tutorial gets a `youtubeId`, it
plays on `/tutorials/` too.

### Adding or changing a demo

- The app's "See live demo" button (`app/components/DemoButton.tsx`) opens `demoUrl()` from
  `app/lib/site.ts`. On a design page it opens the demo design of the template in use: a feature's
  first demo designs are its templates in the app's order (tagged `template: p.key` in
  `demos/src/features.mjs`), and `DEMO_TEMPLATES` says how many. The demo build tells you the right
  number when they drift.
- A new feature: add it to `demos/src/features.mjs` (render its block with the app's templates, like
  the others) and to `DEMOS` in `app/lib/site.ts`, then `npm --prefix demos run build` and look at it.
- Demo products, reviews, questions: `demos/src/data.mjs`. The demo store page: `demos/src/shell.mjs`.
  The viewer page (top bar): `demos/src/viewer.mjs`. Checkout pictures: `demos/src/checkout.mjs`.
- The shared Liquid engine is `test/storefront/engine.mjs` (also used by `npm run test:storefront`).

## Deploying on Cloudflare Pages (Omar does this once in the dashboard)

Never type passwords for Claude; these are clicks in your own Cloudflare account.

### 1. The website (crotoolbox.com): live since 2026-10-15

Cloudflare Pages project `crotoolbox`: root directory `site`, build command `npm run build`, output
directory `dist`, environment variable `NODE_VERSION` = `22`, custom domains crotoolbox.com and
www.crotoolbox.com. It rebuilds on every push to `main`.

The live demos need **no second project**: the same project builds and serves them at
https://crotoolbox.com/demo/. Needed in that one project: `NODE_VERSION` = `22` (the demos build needs
22.18 or newer; `22` gives the newest 22). If a `cro-toolbox-demos` project was created before, delete it.

Build watch paths (optional, saves build minutes): the website now also depends on `demos/*`, `theme/*`,
`extensions/cro-storefront/*`, `app/lib/*`, `test/storefront/*`, so leave the default (build on every push).

### Check after the deploy

- `https://crotoolbox.com/demo/` goes to `https://crotoolbox.com/`.
- `https://crotoolbox.com/robots.txt` has `Disallow: /demo/`.
- Response headers of any demo page include `X-Robots-Tag: noindex, nofollow`.
- `https://crotoolbox.com/sitemap-index.xml` and `/llms.txt` don't mention demos.
- `npm run check:links` shows every demo page 200.

## Visibility plan (Omar, outside the code)

AI assistants find apps through web search (ChatGPT uses Bing, Google's AI answers use Google) and
through what other sites say about the app. Tick these off in `docs/WORKBOARD.md`.

### Search engines (once, about 20 minutes)

1. **Google Search Console**: search.google.com/search-console → **Add property** → **Domain** →
   `crotoolbox.com`. Choose **Cloudflare** as the provider when asked and approve; Google adds the DNS
   record for you. (If you prefer the HTML tag method, send Claude the `content` value and it goes in
   `GOOGLE_SITE_VERIFICATION` in `site/src/lib/site.ts`.)
2. In Search Console → **Sitemaps** → submit `https://crotoolbox.com/sitemap-index.xml`
   (`/sitemap.xml` also works, it forwards there).
3. **Bing Webmaster Tools**: bing.com/webmasters → sign in → **Import from Google Search Console**
   (fastest), or add the site and verify by DNS. (Tag method: the value goes in
   `BING_SITE_VERIFICATION`.) Submit the same sitemap.
4. **IndexNow** is already set up: the key file `https://crotoolbox.com/6f1c2b9e4a7d4c8f9b3e5a1d7c2f8e40.txt`
   and the GitHub workflow `.github/workflows/indexnow.yml`, which tells Bing about every page a few
   minutes after each website change reaches `main`. Nothing to do; it shows under Actions on GitHub.
5. **Cloudflare Web Analytics** (free, no cookies, no banner): Cloudflare dashboard → Workers & Pages →
   `crotoolbox` → **Metrics** → **Web Analytics** → **Enable**. Look at referrers for chatgpt.com,
   perplexity.ai and gemini.google.com. Install clicks carry UTM tags (`utm_medium` is the page type,
   `utm_campaign` the page), which the App Store listing analytics shows.

### Search engines beyond Google (Bing, Yandex, Brave, DuckDuckGo)

Bing's index also feeds DuckDuckGo, Yahoo, Ecosia, ChatGPT search and Copilot, so Bing comes first. The
code side is done (checked 2026-10-20, `docs/research/search-visibility.md`): every page answers 200
with one canonical, no noindex, unique titles, real text, a `<lastmod>` in the sitemap, and IndexNow
sends every address after each website change (Bing answered 200). These steps need your logins.

**1. Send www to the main address (Cloudflare, 2 minutes, most important).** Today
`https://www.crotoolbox.com/` shows a second copy of the site. The pages already tell engines the main
address and the copy is marked noindex, but a real redirect is better.
1. dash.cloudflare.com → click **crotoolbox.com** → left menu **Rules** → **Overview**.
2. **Create rule** → **Redirect Rule**.
3. Pick the template **Redirect from WWW to root**. Check it shows: Request URL `https://www.*`,
   Target URL `https://${1}`, Status code **301**, **Preserve query string** ticked.
4. **Deploy**.
5. Test: open `https://www.crotoolbox.com/pricing/`. The address bar must end on `https://crotoolbox.com/pricing/`.

**2. Bing Webmaster Tools** (bing.com/webmasters, pick crotoolbox.com):
1. Left menu **Sitemaps**: `https://crotoolbox.com/sitemap-index.xml` must show **Success** and about 120
   URLs discovered. If it says Pending or an error, click **Resubmit**.
2. Left menu **URL Inspection**: paste `https://crotoolbox.com/`, click **Inspect**, then **Request indexing**.
   Do the same for these (Bing limits how many a day; if it says the limit is reached, carry on tomorrow):
   `/pricing/`, `/features/`, `/shopify-upsell-app/`, `/shopify-cross-sell/`, `/shopify-bundles/`,
   `/increase-aov-shopify/`, `/shopify-cro/`, `/post-purchase-upsell-shopify/`,
   `/shopify-order-tracking-page/`, `/shopify-returns-app/`.
3. Left menu **Site Scan** → **Start new scan** → name `crotoolbox`, URL `https://crotoolbox.com/`,
   limit 500 pages → **Accept and scan**. When it finishes, send Claude any errors it lists.
4. Left menu **IndexNow**: the addresses sent from GitHub after each change appear here.

**3. Yandex Webmaster** (also receives IndexNow):
1. webmaster.yandex.com → sign in → **Add site** → `https://crotoolbox.com`.
2. Choose **DNS record**, copy the value it shows (`yandex-verification: …`).
3. Cloudflare → crotoolbox.com → **DNS** → **Records** → **Add record**: Type **TXT**, Name `@`, Content:
   the value from step 2 → **Save**. Back in Yandex click **Check**.
4. **Indexing** → **Sitemap files** → add `https://crotoolbox.com/sitemap-index.xml`.

**4. Brave Search:** there is no submission tool. Brave finds sites through links from other sites and its
own crawler; `robots.txt` allows every crawler, so nothing blocks it.

**5. DuckDuckGo, Yahoo and Ecosia** show Bing's results: nothing to submit, they follow once Bing has the pages.

**How to check each engine** (write the result in `docs/research/search-visibility.md`): search
`site:crotoolbox.com` on google.com, bing.com, duckduckgo.com, yandex.com and search.brave.com. Found = at
least one crotoolbox.com result.

**Why it takes weeks:** the domain is new (2026-10-15) and no other site links to it yet. Bing indexes
new domains slowly and starts with a few pages. What speeds it up: links from other sites (the App Store
listing's website link, profiles on G2, Capterra, Crunchbase, LinkedIn and Product Hunt, community answers
and guest posts: drafts in `docs/outreach/`), Request indexing in Bing (step 2), and new articles, which
IndexNow announces on each change.

### The one shared description

Use this sentence word for word everywhere (App Store, YouTube, social profiles, directories):

> CRO Toolbox is a Shopify app for bundles, upsells and cross sells.

It lives in `site/src/lib/brand.ts` (the website uses it) and in `docs/listing.md`.

### Off site work (ongoing)

- [ ] App Store listing: put the main words in the name line, for example "CRO Toolbox: Bundles & Upsell".
- [ ] Ask happy merchants for a review (after a success, never pushy).
- [ ] Write to authors of "best Shopify bundle apps" lists and ask to be considered.
- [ ] Answer real questions on r/shopify and the Shopify Community when the app helps. No spam.
- [ ] Short YouTube tutorials (they show up on `/tutorials/` once their ID is in `app/lib/tutorials.ts`).
- [ ] Product Hunt on launch day.
- [ ] Free profiles on G2, Capterra and SaaSworthy, with the shared description.
- [ ] Once a month ask ChatGPT, Gemini and Perplexity "best Shopify bundle app" and note what they say.
- [ ] 1 or 2 articles a week, each answering one real merchant question (see "Adding an article").
