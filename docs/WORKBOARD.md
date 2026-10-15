# Workboard

The backlog for all accounts (see `docs/TEAM.md`). What's being worked on right now is in the open
pull requests (`gh pr list`). Update this file in the PR that finishes or adds an item.
Updated 2026-10-15.

## App

- [x] Bundles overhaul Phases 0 to 5 (`docs/plans/bundles-overhaul.md`)
- [x] **Phase 6 testing on Testing2**: recipes 1 to 6 and checkout (no stacking) verified (2026-10-15). Status in `docs/PROJECT-GUIDE.md` §10.
- [ ] "Show live preview" buttons in the app, linking to the website demos (`demoUrl()`), after
      the website's demo pages exist (website PR 2)
- [ ] Review request in the app ("Enjoying CRO Toolbox?"), after launch
- [ ] Known gap: a bare mix and match bundle product can still be bought alone through a theme's own
      quick add (our quick add now opens its page). A checkout validation can't tell it apart: Shopify
      shows the validation a merged bundle as one line with no picks under it, so the "bundle guard"
      (PR #45) refused real bundles and is switched off. Idea: let the cart transform give a bare
      bundle line a price that makes no sense to buy, or hide bundle products from collections.
- [x] Checkout rejects a bundle product picked inside a bundle (PR #46, cro-toolbox-19)
- [ ] Add to theme places the builder below the theme's Add to cart: the theme editor link can't
      choose a position (PR #47 adds a hint in the app)

## Website (`site/`, brief: `docs/prompts/build-website.md`, next steps: `docs/prompts/continue-website.md`)

- [x] PR 1: scaffold, home, pricing, legal pages, sitemap, llms.txt (PR #36)
- [ ] PR 2: live demo pipeline and a demo page per feature
- [ ] PR 3: bundles hub, features, use cases, comparisons
- [ ] PR 4: blog (6 articles), help center, tutorials page
- [ ] PR 5 (app): "Show live preview" buttons
- [x] Live on Cloudflare Pages (free plan): project `crotoolbox`, root `site`, build `npm run build`, output `dist`,
      NODE_VERSION 22; https://crotoolbox.com and www, rebuilds on every push to `main` (2026-10-15)

## Omar (outside the code)

- [x] Buy crotoolbox.com at Cloudflare Registrar, connect Cloudflare Pages to the repo
- [ ] Google Search Console and Bing Webmaster Tools once the site is live
- [ ] Partner Dashboard: protected customer data request, App Pricing plans, distribution
- [ ] App Store listing: screenshots, video, support email; tutorial videos
