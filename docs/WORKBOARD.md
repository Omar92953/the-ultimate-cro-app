# Workboard

The backlog for all accounts (see `docs/TEAM.md`). What's being worked on right now is in the open
pull requests (`gh pr list`). Update this file in the PR that finishes or adds an item.
Updated 2026-10-15.

## App

- [x] Bundles overhaul Phases 0 to 5 (`docs/plans/bundles-overhaul.md`)
- [x] **Phase 6 testing on Testing2**: recipes 1 to 6 and checkout (no stacking) verified (2026-10-15). Status in `docs/PROJECT-GUIDE.md` §10.
- [x] "See live demo" buttons in the app (`app/components/DemoButton.tsx`): every feature page, design
      pages open the template in use, bundle recipe cards, each Conversion boosters card (website PR 5)
- [ ] Review request in the app ("Enjoying CRO Toolbox?"), after launch
- [ ] Known gap: a bare mix and match bundle product can still be bought alone through a theme's own
      quick add (our quick add now opens its page). A checkout validation can't tell it apart: Shopify
      shows the validation a merged bundle as one line with no picks under it, so the "bundle guard"
      (PR #45) refused real bundles and is switched off. Idea: let the cart transform give a bare
      bundle line a price that makes no sense to buy, or hide bundle products from collections.
- [x] Checkout rejects a bundle product picked inside a bundle (PR #46, cro-toolbox-19)
- [ ] Add to theme places the builder below the theme's Add to cart: the theme editor link can't
      choose a position (PR #47 adds a hint in the app)
- [x] Countdown timers blocking every click / cart drawer hidden (class clash `ucs-cd`; drawer is now
      `ucs-cdr`): fixed in PR #59, **deployed as cro-toolbox-21** from the Mac (build:theme,
      test:storefront, test:functions all passed), then merged (2026-10-15).
- [ ] Check cro-toolbox-21 on Testing2: turn on a countdown timer (header bar and product page), click
      Add to cart and links under it, open the app's cart drawer. Needs the storefront unlocked
      (password is back on; Omar types it). Rollback: `shopify app release --version=cro-toolbox-20`.

- [x] Blocks check 2026-10-16: build:theme 30 of 30 blocks, 86.3 KB of 100 KB Liquid; `shopify theme check` 37 files, no offenses; `npm run test:storefront` passes (every block and embed rendered). No fixes needed.

- [ ] After launch: own style for every offer type (D5 did upsell, cross sell and mix and match bundles; the
      other types still share one style per group, and plans cap styles at 5). Omar agreed to ship as is.
- [ ] Next Shopify deploy: theme editor texts still say "Cross-sell" and "Design" (theme/blocks/ucro-cart-offers.liquid
      and others); change to "Cross sell" and "Style".

- [ ] Block G (2026-10-17): G4 to G8 are open draft PRs stacked in order (#110 to #114, G9 design doc next).
      Needs a Shopify deploy and Omar's steps in each PR: read_returns and write_returns scopes on Render
      and the TOML (G4), request read_all_orders in the Partner Dashboard, test on Testing 3 with
      `docs/testing-checklist.md`. G9: Omar approves `docs/plans/mcp-server.md` before any MCP code.

## Website (`site/`, brief: `docs/prompts/build-website.md`, next steps: `docs/prompts/continue-website.md`)

- [x] PR 1: scaffold, home, pricing, legal pages, sitemap, llms.txt (PR #36)
- [x] PR 2: hidden live demos for every feature in `demos/` (crotoolbox.com/demo), `app/lib/site.ts`,
      no demo links on the website, `docs/website.md` (PR #43)
- [x] PR 3: bundles hub, feature and area pages, use cases, comparisons (PR #50)
- [ ] Comparisons: check each app's listing yourself and update `site/src/lib/competitors.ts` (marked "Not checked" until then)
- [x] PR 4: blog (6 articles), help center (13 guides), tutorials page, IndexNow, search engine
      verification support, visibility checklist in `docs/website.md` (PR #56)
- [x] PR 5 (app): "See live demo" buttons
- [x] Live on Cloudflare Pages (free plan): project `crotoolbox`, root `site`, build `npm run build`, output `dist`,
      NODE_VERSION 22; https://crotoolbox.com and www, rebuilds on every push to `main` (2026-10-15)
- [x] Live demos at crotoolbox.com/demo/ (PR #96): `npm run check:links` on 2026-10-17, 59 pages, all 200
- [ ] SEO & GEO (`docs/plans/seo-geo.md`): keyword pages PR 1 of 5 merged (#131, upsell and cross sell);
      PR 2 to 4 (bundles, AOV, CRO, post purchase, tracking, returns), PR 5 alternative pages; website account (cloud)
- [x] AI crawlers named in robots.txt, fuller llms.txt (#133); listing text with search words (#134)
- [ ] After keyword pages: blog routine (drafts as PRs), monthly GEO check routine, MCP listing in the Claude
      and ChatGPT directories (after the MCP is tested on Testing 3)
- [ ] Demos: replace the MDN sample clips in the video carousel demo with Omar's product videos

## Omar (outside the code)

- [x] Buy crotoolbox.com at Cloudflare Registrar, connect Cloudflare Pages to the repo
- [x] Google Search Console: Domain property crotoolbox.com verified through Cloudflare DNS (keep the
      `google-site-verification` TXT record), sitemap-index.xml submitted (2026-10-16)
- [x] Bing Webmaster Tools: crotoolbox.com added, sitemap-index.xml submitted (2026-10-16); IndexNow runs from GitHub
- [ ] Check both show the sitemap as Success (Google showed "Couldn't fetch" right after adding, normal for a new property)
- [ ] Cloudflare Web Analytics (`docs/website.md`, "Visibility plan")
- [ ] Off site visibility checklist (`docs/website.md`, "Off site work")
- [ ] Partner Dashboard: protected customer data request, App Pricing plans, distribution
- [ ] App Store listing: screenshots, video, support email; tutorial videos
