# Handoff: read this first

Written 2026-10-15 by the cloud Claude session that built the website (PRs 1 to 5) and fixed the
countdown timer bug. For whichever Claude session works on this repo next (any of Omar's three
accounts). Everything is in the repo; don't rely on old chats.

## How to start

1. `git fetch --prune && git checkout main && git pull` (on the Mac: `bash scripts/sync.sh`).
2. Read `CLAUDE.md`, `docs/TEAM.md`, `docs/WORKBOARD.md`, then `docs/PROJECT-GUIDE.md` (app) or
   `docs/website.md` (website and demos).
3. Do the urgent item below first if you are on Omar's Mac.

## URGENT: one Shopify deploy is waiting (Mac only)

**The bug:** the app's cart drawer and the countdown timer both used the CSS class `ucs-cd` in
`extensions/cro-storefront/assets/ucs-sections.css`. The drawer rule
`.ucs-cd { position: fixed; inset: 0; z-index: 2147483000 }` made every countdown timer an invisible
full screen layer over the page, so shoppers couldn't click anything (Add to cart included) on any page
with a CRO Toolbox countdown. The other way round, the timer's `visibility: hidden` hid the cart drawer.

**The fix (PR #58, merged to `main`):** the cart drawer's classes are renamed to `ucs-cdr`
(`ucs-cdr`, `ucs-cdr__panel`, `ucs-cdr--left`, `ucs-cdr-open`, id `ucs-cdr-title`…) in
`ucs-cart.js`, the cart drawer section of `ucs-sections.css` and the admin preview
`app/components/CartToolsPreview.tsx`. The timer keeps `ucs-cd`. The drawer's CSS variables
(`--ucs-cd-bg`, `--ucs-cd-w`…) are unchanged on purpose: they come from saved settings and are set on
the drawer element itself, so they don't clash. The two demo workarounds are removed.

**Omar asked to merge before the deploy**, against the usual "deploy before merge" rule
(`docs/TEAM.md`). So `main` is ahead of what Shopify serves: shops still have the bug until this runs.
The admin on Render already matches `main` (it reads the CSS from the repo), and old storefront files
keep working together until the deploy, so nothing is half switched.

On Omar's Mac:

```
git checkout main && git pull
npm run build:theme && npm run test:storefront && npm run test:functions
NODE_OPTIONS=--dns-result-order=ipv4first shopify app deploy --allow-updates --message "Fix countdown timer blocking clicks (cart drawer class ucs-cdr)"
```

Then on **Testing2** only (never the live store `ms6vwv-3n`): turn on a countdown timer (header bar
and product page), check you can click Add to cart and links under it, then open the app's cart drawer
and check it slides in. Tick the URGENT line in `docs/WORKBOARD.md`. Rollback if needed:
`shopify app release --version=<previous version>` (`shopify app versions list` shows them).

How it was checked in the cloud: `npm run build:theme`, `npm run test:storefront`, the demo build, and
a browser test on the demo pages (all 8 countdown designs: timer is a small static element and
`elementFromPoint` over Add to cart hits the button; the cart drawer opens and is visible, also with a
countdown timer on the same page). `npm run test:functions` was not run (needs the Mac).

## What this session did

| PR | What |
|---|---|
| #36 | Website PR 1: Astro site in `site/`, home, pricing, legal pages, sitemap, llms.txt, share images |
| #43 | Website PR 2: hidden live demos in `demos/` for every feature and bundle recipe (demo.crotoolbox.com, noindex, never linked from the site), `app/lib/site.ts` (`DEMOS`, `demoUrl()`), shared Liquid engine `test/storefront/engine.mjs` |
| #50 | Website PR 3: bundles hub, a page per feature and area, use cases, 8 honest comparisons (`site/src/lib/competitors.ts`, facts with sources, "Not checked" otherwise) |
| #56 | Website PR 4: blog (6 articles, `site/src/content/blog/`), help center (13 guides), tutorials page, IndexNow (`.github/workflows/indexnow.yml`), shared description `site/src/lib/brand.ts`, visibility checklist in `docs/website.md` |
| #57 | App: "See live demo" buttons (`app/components/DemoButton.tsx`) on every feature page, design pages (opens the template in use, `DEMO_TEMPLATES` in `app/lib/site.ts`, checked by the demo build), bundle recipe cards, each Conversion boosters card |
| #58 | Storefront: the countdown timer and cart drawer class fix above |

The website is live at **https://crotoolbox.com** (Cloudflare Pages project `crotoolbox`, rebuilds
on every push to `main`).

## Waiting on Omar

- **The Shopify deploy above** (or a Claude session on his Mac).
- **Create the demos project on Cloudflare** (`cro-toolbox-demos`, root `demos`, domain
  demo.crotoolbox.com). Steps in `docs/website.md` → "The live demos". Until then the app's
  "See live demo" buttons open a page that doesn't exist.
- Visibility checklist in `docs/website.md`: Google Search Console, Bing Webmaster Tools, Cloudflare
  Web Analytics, then the off site list.
- When the App Store listing is live: set `INSTALL_URL` in `site/src/lib/site.ts` (the site's install
  buttons say "coming soon" until then) and confirm `APP_STORE_URL` in `app/lib/site.ts`.
- Check the competitors' listings and update `site/src/lib/competitors.ts`.
- Older items (Partner Dashboard, listing, test products for recipe 6) are in `docs/WORKBOARD.md`.

## Not verified yet

- The "See live demo" buttons were never seen in the real Shopify admin (the cloud can't load it).
  Look at them on Testing2: a feature page, a design page, Bundles → Create bundle, Conversion boosters.
- The IndexNow workflow runs after website changes on `main`; check its first run under GitHub Actions.

## Good to know

- Website: `npm --prefix site ci && npm --prefix site run dev`; check with `npm --prefix site run build`.
  Demos: `npm --prefix demos run build`. Website screenshots of features come from
  `npm --prefix demos run screenshots` (needs Playwright).
- The demo build fails on purpose when the app and the demos drift (`DEMOS`, `DEMO_RECIPES`,
  `DEMO_TEMPLATES`, invalid block JSON, a page without noindex). Its message says what to change.
- House rules that bite: never touch the live store `ms6vwv-3n.myshopify.com`, never
  `shopify app dev clean`, never type passwords, ask before anything paid, no dashes in visible text,
  only claim what the app really does.
