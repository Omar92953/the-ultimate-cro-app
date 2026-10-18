# Workboard

The backlog for all accounts (see `docs/TEAM.md`). What's being worked on right now is in the open
pull requests (`gh pr list`). Update this file in the PR that finishes or adds an item.
Updated 2026-10-18.

## App

- [x] Bundles overhaul Phases 0 to 5 (`docs/plans/bundles-overhaul.md`)
- [x] **Phase 6 testing on Testing2**: recipes 1 to 6 and checkout (no stacking) verified (2026-10-15). Status in `docs/PROJECT-GUIDE.md` §10.
- [x] "See live demo" buttons in the app (`app/components/DemoButton.tsx`): every feature page, design
      pages open the template in use, bundle recipe cards, each Conversion boosters card (website PR 5)
- [ ] Review request in the app ("Enjoying CRO Toolbox?"), after launch
- [x] A bare mix and match bundle product bought alone through a theme's quick add: fixed in #183 (cro-toolbox-35): merged lines are stamped, the bundle guard refuses an unstamped one at checkout (`docs/plans/bare-bundle-gap.md`). Verified on Testing 3.
- [x] Checkout rejects a bundle product picked inside a bundle (PR #46, cro-toolbox-19)
- [ ] Add to theme places the builder below the theme's Add to cart: the theme editor link can't
      choose a position (PR #47 adds a hint in the app)
- [x] Countdown timers blocking every click / cart drawer hidden (class clash `ucs-cd`; drawer is now
      `ucs-cdr`): fixed in PR #59, **deployed as cro-toolbox-21** from the Mac (build:theme,
      test:storefront, test:functions all passed), then merged (2026-10-15).

- [x] Blocks check 2026-10-16: build:theme 30 of 30 blocks, 86.3 KB of 100 KB Liquid; `shopify theme check` 37 files, no offenses; `npm run test:storefront` passes (every block and embed rendered). No fixes needed.

- [ ] After launch: own style for every offer type (D5 did upsell, cross sell and mix and match bundles; the
      other types still share one style per group, and plans cap styles at 5). Omar agreed to ship as is.
- [x] Theme editor texts say "Cross sell" and "Style" (#178, deployed).
- [x] Later: a returns webhook (`returns/close`) so credit also goes out when the merchant closes the return in Shopify's own admin, not only from the "Items received: give the credit" button (G10 follow up, #147). Needs a toml change, so a Shopify deploy. Done in #171 (`returns/close` in shopify.app.toml, `app/routes/webhooks.returns.close.tsx`), deployed. Verified on Testing 3 (Pro) 2026-10-18 with #1005: approved in the app, closed in Shopify admin, the request turned "Store credit given" by itself: $49.95 refunded to store credit inside the order, $5.00 bonus credited once.

- [x] Block G (2026-10-17 to 18): G1 to G11 and the MCP read/build tools are merged and deployed (Returns with Shopify returns,
      store credit, exchanges, Track page selling, MCP offers, discounts and bundles). Tested on Testing 3, see the runs below.
      Still Omar's: request `read_all_orders` in the Partner Dashboard (Shopify only shows the last 60 days of orders until then).

- [x] Block G11 (Track page selling: prices, next order discount, buy again, after delivery, delay message, offer slots (Pro), editor
      "What to show", sample orders, Analytics "Track & Returns" card) merged and deployed; tested on Testing 3.

## Website (`site/`, brief: `docs/prompts/build-website.md`, next steps: `docs/prompts/continue-website.md`)

- [x] PR 1: scaffold, home, pricing, legal pages, sitemap, llms.txt (PR #36)
- [x] PR 2: hidden live demos for every feature in `demos/` (crotoolbox.com/demo), `app/lib/site.ts`,
      no demo links on the website, `docs/website.md` (PR #43)
- [x] PR 3: bundles hub, feature and area pages, use cases, comparisons (PR #50)
- [x] Comparisons: check each app's listing yourself and update `site/src/lib/competitors.ts` (marked "Not checked" until then)
- [x] PR 4: blog (6 articles), help center (13 guides), tutorials page, IndexNow, search engine
      verification support, visibility checklist in `docs/website.md` (PR #56)
- [x] PR 5 (app): "See live demo" buttons
- [x] Live on Cloudflare Pages (free plan): project `crotoolbox`, root `site`, build `npm run build`, output `dist`,
      NODE_VERSION 22; https://crotoolbox.com and www, rebuilds on every push to `main` (2026-10-15)
- [x] Live demos at crotoolbox.com/demo/ (PR #96): `npm run check:links` on 2026-10-17, 59 pages, all 200
- [x] SEO & GEO (`docs/plans/seo-geo.md`): keyword pages (#131, #144 to #146) and the alternative pages in /compare (#148) are live.
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

Ticked = fixed and merged (#159 to #172); Omar re-checks on Testing 3 when he next tests.

- [x] Next order / friend / delay codes don't apply when the cart already has the app's own offer discount
      (automatic "CRO Toolbox offers"): Shopify says not applicable. #157 makes new codes combine with product
      discounts; also check the existing automatic app discount's combinesWith on old stores (update it on sync).
- [x] Size guide shows on every product (Gift Card, Ski Wax): show it only where a chart is assigned or the
      product has a size option.
- [x] Wishlist saves the product, not the chosen variant: the page shows the lowest price ($9.95) for a $24.95 pick.
- [x] Floating wishlist heart still at bottom left 18px over footer links and payment icons (#135 fix didn't take).
- [x] Track page and Wishlist editors' intro text still says to create the page by hand (the app makes it now).
- [x] Track page "Late orders" select text is cut off ("Just the apol...").
- [x] Track page prices: a "Refunded" line when the order is refunded or partly refunded (#162).
- [ ] Not tested (need the Pro test plan): Track page offer slots, exchanges, store credit and gift card, A/B tests,
      live tracking with a provider key.

## Pro run on Testing 3, 2026-10-18 (cro-toolbox-31 + #164)

Worked: store credit (shopper picks "Get $27.45 store credit instead of a $24.95 refund", 10% bonus; "Items received:
give the credit" credits the customer $27.45 in Shopify), Track page offer (cross sell with its own TRACK- code and expiry,
shown with after delivery, prices, next order code, buy again), exchange approval after #164 (returnReasonNote).

- [x] **CRITICAL, money (fixed in #166, cro-toolbox-32, verified on #1004 2026-10-18: refund to store credit $24.95 inside the order + $2.50 bonus; exchange refused to ship while $15 owed, shipped once paid):** order #1003 on Testing 3. R1 ($24.95) paid back with store credit, then R2 exchange of the
      $9.95 item for the $24.95 one (shopper owes $15). On "Items arrived: ship the exchange" the app refunded the $9.95
      AND released the $24.95 item, without the $15. Cause: store credit is given outside the order (storeCreditAccountCredit),
      so Shopify still counts R1's $24.95 as paid and the exchange outcome used it. Fix both: give return credit through
      Shopify's refund to store credit (returnProcess financialTransfer with a store credit refund method) so the order's
      money is right; and for an exchange where the shopper owes more, never refund the returned item and keep the hold
      until the invoice is paid (check the order's outstanding balance before releasing).
- [x] Shopper Returns page shows R1 as "Approved" after the credit was given (fixed, #167) (app says "Store credit given").
- [x] Return saving rules "How it works" text still says credit is given when you approve (default is now items received).
- [x] Deploy warning: LiquidHTMLSyntaxError (fixed, #168) in cro-storefront ("'script' was closed", the A/B snippet ucro-ab.liquid).
- [ ] Not tested yet: A/B tests (Pro), gift card and discount code fallbacks (guest orders), live tracking with a provider key.
- [x] App Returns card: "Paid back with store credit: 27.45 USD (done)" shows the internal step marker "(done)".
- [x] App Returns card: after the shopper paid the difference and the exchange shipped, it still says "The shopper owes 15.00 USD".
