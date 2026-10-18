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

- [ ] Later: a returns webhook (`returns/close`) so credit also goes out when the merchant closes the return in Shopify's own admin, not only from the "Items received: give the credit" button (G10 follow up, #147). Needs a toml change, so a Shopify deploy.

- [ ] Block G (2026-10-17): G4 to G8 are open draft PRs stacked in order (#110 to #114, G9 design doc next).
      Needs a Shopify deploy and Omar's steps in each PR: read_returns and write_returns scopes on Render
      and the TOML (G4), request read_all_orders in the Partner Dashboard, test on Testing 3 with
      `docs/testing-checklist.md`. G9: Omar approves `docs/plans/mcp-server.md` before any MCP code.

- [ ] Block G11 (2026-10-18, open draft PRs, Omar reviews on Testing 3): Track page selling in #137 (prices), #139
      (next order discount), #140 (buy again), #142 (after delivery), #143 (delay), #149 (offer slots, Pro), and
      the editor "What to show", sample orders, Analytics "Track & Returns" card and copy (this PR). Then the MCP
      discounts tools and the MCP bundles tools.

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

## Testing 3 run 2026-10-18 (cro-toolbox-30): open bugs

`[~]` = fixed in an open draft PR (#159 offer discount, #160 size guide, #161 wishlist, #162 texts and refunds), waiting for Omar's check on Testing 3.

- [~] Next order / friend / delay codes don't apply when the cart already has the app's own offer discount
      (automatic "CRO Toolbox offers"): Shopify says not applicable. #157 makes new codes combine with product
      discounts; also check the existing automatic app discount's combinesWith on old stores (update it on sync).
- [~] Size guide shows on every product (Gift Card, Ski Wax): show it only where a chart is assigned or the
      product has a size option.
- [~] Wishlist saves the product, not the chosen variant: the page shows the lowest price ($9.95) for a $24.95 pick.
- [~] Floating wishlist heart still at bottom left 18px over footer links and payment icons (#135 fix didn't take).
- [~] Track page and Wishlist editors' intro text still says to create the page by hand (the app makes it now).
- [~] Track page "Late orders" select text is cut off ("Just the apol...").
- [~] Track page prices: a "Refunded" line when the order is refunded or partly refunded (#162).
- [ ] Not tested (need the Pro test plan): Track page offer slots, exchanges, store credit and gift card, A/B tests,
      live tracking with a provider key.

## Pro run on Testing 3, 2026-10-18 (cro-toolbox-31 + #164)

Worked: store credit (shopper picks "Get $27.45 store credit instead of a $24.95 refund", 10% bonus; "Items received:
give the credit" credits the customer $27.45 in Shopify), Track page offer (cross sell with its own TRACK- code and expiry,
shown with after delivery, prices, next order code, buy again), exchange approval after #164 (returnReasonNote).

- [ ] **CRITICAL, money:** order #1003 on Testing 3. R1 ($24.95) paid back with store credit, then R2 exchange of the
      $9.95 item for the $24.95 one (shopper owes $15). On "Items arrived: ship the exchange" the app refunded the $9.95
      AND released the $24.95 item, without the $15. Cause: store credit is given outside the order (storeCreditAccountCredit),
      so Shopify still counts R1's $24.95 as paid and the exchange outcome used it. Fix both: give return credit through
      Shopify's refund to store credit (returnProcess financialTransfer with a store credit refund method) so the order's
      money is right; and for an exchange where the shopper owes more, never refund the returned item and keep the hold
      until the invoice is paid (check the order's outstanding balance before releasing).
- [ ] Shopper Returns page shows R1 as "Approved" after the credit was given (app says "Store credit given").
- [ ] Return saving rules "How it works" text still says credit is given when you approve (default is now items received).
- [ ] Deploy warning: LiquidHTMLSyntaxError in cro-storefront ("'script' was closed", the A/B snippet ucro-ab.liquid).
- [ ] Not tested yet: A/B tests (Pro), gift card and discount code fallbacks (guest orders), live tracking with a provider key.
