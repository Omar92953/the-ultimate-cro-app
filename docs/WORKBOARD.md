# Workboard

The backlog for all accounts (see `docs/TEAM.md`). What's being worked on right now is in the open
pull requests (`gh pr list`). Update this file in the PR that finishes or adds an item.
Updated 2026-10-19.

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

## CRO sections (Omar, 2026-10-19; plan `docs/plans/cro-sections.md`, PR #211)

- [x] One shared block `ucs-section` (29 of 30 blocks, 93.2 KB Liquid) and 9 sections: comparison table, benefits row,
      product details tabs, guarantee, before and after, shoppable image, recently viewed, how it works, email pop up (in the
      Conversion boosters embed). Editors with templates and live preview, demos, tests.
- [x] Verified on Testing 3, 2026-10-20 (cro-toolbox-45): all 9 editors open and save, templates and previews draw; on the store
      home page benefits, how it works, before and after (drag works), shoppable image (live price, Add to cart with _source);
      product page product tabs, guarantee, comparison table, recently viewed (live price, Add to cart). Pop up sign up with
      popup-test-1020@example.com: customer created, SUBSCRIBED (single opt in), tag cro-popup; code WELCOME-UKESLR is 10%, once,
      only for that customer, 14 days; applied to the cart ($749.95 to $674.96); the same email gets the same code back.
      Not checked on the store: the Details tab (no Testing 3 product has a description; covered by the harness).
- [x] Fix #220: Shopify wrapped the ucs-dk snippet output in BEGIN/END comments on the home page, so the block found no design.
- [ ] Check the 14 other blocks that capture `render 'ucs-dk'` (they worked on other pages; the comments seem context dependent).
- [ ] Omar: protected customer data form: add Email for the pop up ("creates the store's customer with marketing consent").

## Website (`site/`, brief: `docs/prompts/build-website.md`, everything left: `docs/prompts/finish-website-cloud.md`)

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
- [x] Search visibility (finish-website-cloud §1, #218): sitemap `<lastmod>`, IndexNow also on app file changes,
      www and pages.dev copies noindex, 404 without canonical, `/about/`, Organization contact and `sameAs`;
      log in `docs/research/search-visibility.md`, checklist in `docs/website.md` ("Search engines beyond Google")
- [x] A page per bundle recipe (`/bundles/<recipe>/`, copy in `site/src/lib/recipes.ts`), every plan limit in the
      pricing table, pricing FAQ on upgrading and cancelling (finish-website-cloud §3, #221)
- [x] `/changelog/` (site/src/lib/changelog.ts) and an accessibility pass: `site/scripts/check-a11y.mjs` (alt text, heading
      order, names, labels, contrast), hidden heading for the pricing plan cards, keyboard focus checked (finish-website-cloud §3, #222)
- [x] SEO/GEO finish (finish-website-cloud §4): alternative pages show each app's own App Store listing (developer,
      launch date, plans, what it says it does), checked 2026-10-20 with the link; llms.txt and llms-full.txt list the
      keyword answers, bundle types, alternatives and recent changes; GEO check (10 fixed questions, monthly) with run 1
      in `docs/research/geo-checks.md`
- [x] Outreach drafts in `docs/outreach/` (finish-website-cloud §5, #226): 3 Shopify Community answers, 3 r/shopify posts,
      2 guest post pitches with full drafts, a LinkedIn article, a dev.to/Medium article, Product Hunt text, profile texts
- [ ] Omar: post the outreach drafts by hand (one or two a week, from `docs/outreach/README.md`) and create the
      G2, Capterra, Crunchbase, LinkedIn page and Partner directory profiles (`docs/outreach/profiles.md`); paste each
      profile URL into `PROFILES` in `site/src/lib/site.ts`
- [x] Articles (finish-website-cloud §5), 1 of 4: upsell vs cross sell, bundle ideas by industry, free shipping threshold maths
- [x] Articles (finish-website-cloud §5), 2 of 4: post purchase upsell examples, thank you page ideas, A/B testing offers
- [ ] Omar: run the GEO check in ChatGPT, Perplexity, Gemini, Copilot and Claude once a month (steps in
      `docs/research/geo-checks.md`) and add the columns
- [x] Demos with real product photos (finish-website-cloud §2): 29 free Burst photos in `site/public/products/`
      (sources and licences in `demos/IMAGES.md`), new website screenshots from the demos incl. the 12 features that had
      none (CRO sections, size guide, return saving, A/B tests); product pictures on the website sized for photos
- [ ] Demos: replace the MDN sample clips in the video carousel demo with Omar's product videos

## Omar (outside the code)

- [x] Buy crotoolbox.com at Cloudflare Registrar, connect Cloudflare Pages to the repo
- [x] Google Search Console: Domain property crotoolbox.com verified through Cloudflare DNS (keep the
      `google-site-verification` TXT record), sitemap-index.xml submitted (2026-10-16)
- [x] Bing Webmaster Tools: crotoolbox.com added, sitemap-index.xml submitted (2026-10-16); IndexNow runs from GitHub
- [ ] Check both show the sitemap as Success (Google showed "Couldn't fetch" right after adding, normal for a new property)
- [ ] Cloudflare: Redirect Rule www to root (`docs/website.md`, "Search engines beyond Google", step 1)
- [ ] Bing Webmaster Tools: sitemap Success, Request indexing for the home and keyword pages, Site Scan (step 2)
- [ ] Yandex Webmaster: add the site, verify by DNS TXT on Cloudflare, submit the sitemap (step 3)
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
      live tracking with a provider key. (Done since, see "Verified on Testing 3, 2026-10-18 (supervisor)" below.)

## Review run 2026-10-19 (supervisor)

- [x] Shopify AI self review (AI Toolkit "App Store Review", 100 rules): 2 likely rejections fixed and deployed
      (cro-toolbox-37, #192/#193): 1.1.15 refunds only via returnProcess (no gift card / discount code paybacks,
      write_gift_cards removed) and 2.3.1 no typed store address on /mcp/authorize (pairing code).
- [x] Follow ups (cro-toolbox-38, #194/#195): guest orders get "Refund to my original payment" or "Sign in to get
      store credit"; Connect Claude is one click ("Open CRO Toolbox in Shopify", store-less admin link, code as
      backup); /auth/callback added to redirect_urls (Gemini audit).
- [x] All 54 admin pages open on Testing 3 (titles checked); 8 storefront pages show no app errors (only the demo
      theme's own selling-plans.js error).
- [ ] Not testable by hand: whether signing in links a guest order to the customer (needs a real guest checkout);
      the full Connect Claude flow (needs adding the connector in Claude).
- [x] Omar, 2026-10-19: post-purchase access (5.8.1) and read_all_orders both approved at once (Partner Dashboard →
      API access requests). read_all_orders added to scopes (cro-toolbox-39, #200); accepted on Testing 3, Tracking &
      Returns setup "Orders older than 60 days" shows Done. App Pricing handles checked (see "Plans page only").
- [x] Protected customer data form: 16 of 16 answered honestly (2026-10-19), checklist shows it complete. Made true by
      #212 (cro-toolbox-41): A/B tests wait for analytics consent, retention periods with daily cleanup
      (app/lib/retention.ts), Terms data processing section, docs/security/incident-response.md, and free nightly
      encrypted backups in the private repo Omar92953/cro-toolbox-backups (docs/security/backups.md; first run OK).
- [x] 2026-10-20: AI self review marked done (audit re-run after the CRO sections, docs/submission-review.md);
      Embedded and Online Store app checks green; capabilities: checkout UI extension, online store, post purchase;
      protected customer data reasons now include "Marketing or advertising" (email pop up).
- [ ] Left before Submit: listing feature image + 6 screenshots (after the demos show real products, cloud
      session), screencast URL (Omar), automated check (run last), then Submit for review.

## App Store listing images (Omar, 2026-10-19)

- [x] Feature image style approved: `branding/feature/feature-banner.png` (dark green to black background, logo,
      headline, real widgets as white cards with green tags; design system: `branding/listing/README.md`). Keep this style.
- [ ] Demos (`demos/`): replace the drawn products (candle, serum, mug, soap) with a real product collection's photos.
      Omar decides when the demos are final.
- [ ] After that: re-capture the widgets, redo the feature image, and design all 6 listing screenshots (1600x900) in
      the same style, then Omar uploads them. Don't upload the current feature image before then.

## Header back, 2026-10-19 (#208, cro-toolbox-40)

- [x] Header restored in the Section library (Sections group, Starter plan), design page `/app/designs/header`,
      theme block `ucs-header` in the Header area. Own block by Omar's choice: **28 of 30 blocks** now, so 2 slots
      left for the bigger section library (new sections should share blocks or embeds). Footer and Contact stay removed.
      No new scope (menu handle typed in the app, read in Liquid). Website page `/features/header` and demo are back.
- Note for all sessions: a970482 (#209) committed another session's uncommitted edits from the shared folder and broke
  main until #208. Use `git worktree add` for parallel work in one clone; never `git commit -a` there.
- [x] Verified on Testing 3 (2026-10-19): Header card in Section library → Sections ("Needs setup" until saved), design page
      and live preview work, Save, "Add to header" put the block in the theme's Header area; the storefront shows the app's
      header (desktop pill menu, phone burger) and the theme's header is hidden. Not tested: mega menu with a nested menu, overlay settings.

## Plans page only, 2026-10-19 (lead)

- [x] Every in-app plan button (Upgrade to X, Change plan, See plans and upgrade, limit messages) opens
      `/app/plans`; the AI assistant pages and MCP replies link to the Plans page inside the admin (#198).
      Test: no file in app/, extensions/, theme/, site/src links to `pricing_plans`.
- [x] Testing 3: Settings → Change plan opens our Plans page. Approval pages open for all 4 handles (free,
      starter, growth, pro); prices match plans.ts: $5.99/$59, $14.99/$149, $24.99/$249 a year. Nothing approved.
- Shopify controls (cannot change): its hosted pricing_plans page still exists and Shopify may link to it from
  its own screens (App Store listing, Settings → Apps). The app never sends anyone there. Welcome link per plan
  (Partner Dashboard → App Pricing → plan → Welcome link) can be `/app/plans` or `/app`; `?plan_handle` refreshes
  the plan either way.

## Verified on Testing 3, 2026-10-18 (supervisor)

- [x] Returns close webhook: credit given when the return is closed in Shopify admin (#1005).
- [x] A/B test on an upsell: A and B shown and counted, "Use version B" applied (test ab_352qcb6s).
- [x] Cheaper exchange: $25.00 refunded at approval, exchange held until items arrived, then shipped (#1006).
- [x] Bundle guard (#183, cro-toolbox-35): a real bundle checks out; a bare bundle and a forged stamp are refused at
      /cart/add with "is a bundle"; a normal product is fine. Kit not checked (Testing 3's kit is sold out).
- [x] Live tracking: TRACKING_KEY_SECRET (generated on Render) and TRACKING_PROVIDER_KEY (17TRACK API trial, 200 numbers,
      account 17track@crotoolbox.com) set; Testing 3 on Live tracking; #1006 with a UPS test number registered
      (17TRACK counted 1).
- [x] Check against orders (#189): a found order ticks Verified buyer, an unknown email says no order. A check that finds
      nothing now unticks a tick an earlier check made (never the merchant's own tick).
- [ ] Not testable by hand: gift card and discount code fallback (needs a guest order with no customer).

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
- [x] A/B tests (Pro) and live tracking with a provider key: verified, see below.
- [ ] Gift card and discount code fallbacks: not testable by hand (needs a guest order with no customer).
- [x] App Returns card: "Paid back with store credit: 27.45 USD (done)" shows the internal step marker "(done)".
- [x] App Returns card: after the shopper paid the difference and the exchange shipped, it still says "The shopper owes 15.00 USD".
