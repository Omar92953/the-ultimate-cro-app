# Prompt: finish the website, demos, SEO/GEO and articles (cloud session)

Paste into a Claude Code **cloud** session connected to `github.com/Omar92953/the-ultimate-cro-app`:
"Read docs/prompts/finish-website-cloud.md and do it." Written by the lead session on 2026-10-20.

---

You own everything outside the Shopify app for CRO Toolbox: the website `site/` (crotoolbox.com, Astro,
Cloudflare Pages, deploys on every push to `main`), the live demos `demos/` (crotoolbox.com/demo, hidden from
search), SEO and GEO, the blog, and content for other websites. Work until every section below is done.

## Start

1. `git fetch --prune && git checkout main && git pull`
2. Read `CLAUDE.md`, `docs/TEAM.md`, `docs/WORKBOARD.md` (sections "Website", "App Store listing images", "Omar"),
   `docs/prompts/build-website.md` (the full website brief: honesty, design, pages), `docs/website.md` (how the site
   and demos build, the visibility checklist), `docs/plans/seo-geo.md` (the SEO/GEO plan), `docs/listing.md`
   (shared wording), `branding/listing/README.md` (the approved image style), then `gh pr list`.
3. You run in the cloud: you can code, run checks, open and merge PRs. You **cannot** reach Shopify, deploy the
   app, sign in to Google, Bing or any other service, or post on other websites. Anything needing a login goes
   on a checklist for Omar (exact clicks, one step at a time).

## House rules (from CLAUDE.md, don't break them)

- One `claude/<topic>` branch per change, draft PR first, small PRs merged quickly, `git merge origin/main`
  before merging. Area prefix in titles: `Website:`, `Demos:`, `Docs:`.
- **Don't touch `app/`, `extensions/`, `theme/`, `prisma/`, `shopify.app.toml`.** Another session is building the
  CRO section library there (PR #211 and follow ups). Exceptions: none without asking Omar. `app/lib/plans.ts`,
  `catalog.ts`, `bundle-recipes.ts` are read by the site; never change prices or features to suit the site.
- No dashes in visible text. Neutral wording, never "we will" promises or first person in UI copy. No invented
  numbers, reviews, customer logos, rankings or claims about competitors (facts only, dated, with sources).
- Checks before every merge: `npm --prefix site ci && npm --prefix site run build`, `npm --prefix demos run build`
  when demos or storefront code changed, `npm run check:links` if it exists, plus `npm run test:storefront`
  (the demos share `test/storefront/engine.mjs`). Look at changed pages at 1440 px and 375 px: no horizontal
  scroll, no broken links or images.
- Tick the matching line in `docs/WORKBOARD.md` in each PR. If you stop early, write in the PR what's done,
  what's left and how to test.

## 1. Visible on every search engine, not only Google (highest priority)

Omar searched outside Google and the site doesn't show up. Bing's index also feeds DuckDuckGo, Yahoo, Ecosia,
ChatGPT search and Copilot, so Bing first.
- Diagnose from the repo and the live site: fetch `https://crotoolbox.com/robots.txt`, `/sitemap-index.xml` and
  each sitemap, a sample of pages (status 200, one canonical each, no `noindex`, unique title and description,
  real text in the HTML, not only in JavaScript), `_headers` and `_redirects` (www and http redirect once to
  `https://crotoolbox.com/`, no chains), and `.github/workflows/indexnow.yml` (does the IndexNow request get
  200 or 202 from `api.indexnow.org`; does it send every changed URL; is the key file live).
- Fix what's wrong in code: IndexNow on every deploy for every new or changed URL, a `lastmod` per URL in the
  sitemap, `<link rel="alternate">`/canonical consistency, internal links so no page is orphaned, a real
  About page (who runs CRO Toolbox, contact), JSON-LD Organization with `sameAs` links once profiles exist.
- Make a checklist for Omar in `docs/website.md` ("Search engines") with exact steps for: Bing Webmaster Tools
  (URL inspection, "Request indexing" for the home page and the keyword pages, check the sitemap shows
  "Success", site scan), Yandex Webmaster (add site, verify by DNS on Cloudflare, submit sitemap), Brave Search
  (no submission tool: just confirm it isn't blocked; it finds sites through links), and how to check each
  engine with `site:crotoolbox.com`. Write down why new domains take weeks on Bing and what speeds it up
  (links from other sites, see section 5).
- Recheck after your fixes and note the result per engine in `docs/research/search-visibility.md` (date,
  query, found yes or no).

## 2. Live demos with a real product collection

Omar wants every demo to show one real product collection instead of the drawn candle, serum, cream, mug and
soap ("Lumen Goods"). Ask Omar first which kind of store (for example skincare, coffee, apparel) unless the
workboard says. Use photos that are free for commercial use with no attribution required and no people or
brands (for example Shopify's free stock photos at burst.shopify.com, or Unsplash/Pexels licence images);
record each image's source and licence in `demos/IMAGES.md`. Optimise them (WebP, sized for their slot).
Replace product names, prices and descriptions consistently in every demo, keep each demo's design count and
behaviour, keep them hidden from search, and keep `npm --prefix demos run build` and `test:storefront` green.
When the CRO section library from the other session merges (new features in `catalog.ts`), add their demos
the same way (the demo build fails if `DEMOS` in `app/lib/site.ts` and the built demos differ: in that case
ask the app session to add the keys, don't edit `app/` yourself).
Also: replace the sample clips in the video carousel demo once Omar provides his videos (ask).

## 3. Pages and pricing

- Pricing page: plans, prices, yearly prices, trials and limits come from `app/lib/plans.ts` (Free, Starter
  $5.99 or $59 a year, Growth $19.99 or $199, Pro $39.99 or $399, 14 day trial; billed by Shopify, no one time
  purchases). Make sure every page that mentions a price or plan reads it from there, the comparison table
  shows every limit, and the FAQ explains trials, upgrades, downgrades and cancelling in Shopify.
- A page for every feature in `catalog.ts` (including the Header, Tracking & Returns, and every new CRO
  section when it lands), every bundle recipe, every use case, and the keyword pages in `seo-geo.md` section 2.
  Every page: answer first, real screenshots (not the demos' drawn products once section 2 is done), a link to
  the App Store listing.
- An About page and a Changelog page (from merged app PRs, plain words, dated).
- Accessibility: alt text, contrast, headings in order, keyboard focus.

## 4. SEO and GEO (finish `docs/plans/seo-geo.md`)

- Sections 2 to 6 of the plan: anything not done yet. Keyword pages, alternative pages (facts with sources and
  "checked on" dates), JSON-LD (Organization, SoftwareApplication with prices from plans.ts and no rating until
  real App Store reviews exist, FAQPage, BreadcrumbList, Article), `llms.txt` and `llms-full.txt` generated
  from catalog.ts and plans.ts, the one paragraph description from `docs/listing.md` repeated word for word.
- Measuring (section 9): a "GEO check" doc with 10 fixed questions and how to ask them monthly; log the first
  run in `docs/research/geo-checks.md`.

## 5. Articles: on our website and on other websites

- Our blog (`site/src/content/blog/`): 12 more genuinely useful articles from real searches in seo-geo.md
  section 4 (how to raise AOV on Shopify, upsell vs cross sell, bundle ideas by industry, post purchase upsell
  examples, return policy template, order tracking page that sells, free shipping threshold maths, A/B testing
  offers…). Real steps with the app, honest, dated, each linking to its keyword page and the listing. No mass
  produced filler (Google's scaled content policy). Publish them in PRs of 2 to 3.
- Other websites (Omar posts them himself; never automate posting): drafts in `docs/outreach/`, one file per
  piece, with where to post it and the exact title: 3 Shopify Community answers to common questions, 3 Reddit
  r/shopify style posts that help first and mention the app only where relevant, 2 guest post pitches with
  full drafts for Shopify agency blogs, 1 LinkedIn article, 1 Medium or dev.to article, 1 Product Hunt launch
  text, and profile texts for G2, Capterra, Crunchbase, Shopify Partner directory (same facts everywhere).
  These links are also what gets the site found faster on Bing and Brave (section 1).

## 6. Listing images (after section 2)

When the demos show the real collection: re-capture the widgets (`scripts/listing/capture.sh`, needs headless
Chrome; if the cloud machine has none, say so and leave it for the Mac), render the feature image again and
design the 6 listing screenshots in the approved style (`branding/listing/README.md`, templates in
`branding/listing/templates/`), then tell Omar they're ready to upload.

## Reporting

After each merged PR, tell Omar in two or three plain sentences what's new and the link to check on
crotoolbox.com. At the end, one list: what's done, what Omar must do (logins and posting), and what's waiting on
the app session.
