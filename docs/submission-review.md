# App Store submission review: CRO Toolbox (2026-10-17, last run 2026-10-24)

## Final audit (2026-10-24): before submission (cro-toolbox-72)

**Verdict: the code is ready for review.** Nothing in the code fails a requirement. What is left is Omar's: the Partner
Dashboard (prices, usage meters, protected customer data, read_all_orders, network access), the listing (pick 6 of the
9 screenshots), the Render keys, and the review screencast.

Requirements fetched again today with `shopify doc fetch` (self review list and App Store requirements). Two items were
new to the checklist and apply: **2.3.17** (customer data the app collects must be visible in the admin or the app)
and **3.2.1** (read_all_orders needs a reason). The groups for payments, purchase options, product sourcing, sales
channels and mobile app builders don't apply.

Deterministic checks (`check_app.mjs`): compliance webhooks subscribed and handled, no REST Admin API, no theme file
writes or ScriptTags, 69 theme editor deep links, 29 of 30 theme blocks, 92.1 of 100 KB Liquid, every storefront JS
file under 10 KB gzipped (largest `ucs-orders.js` 9.7, `ucs-reviews.js` 8.5, `ucs-loyalty.js` 7.7), every Function
input query under 3,000 bytes. Its one ❌ is not a finding: `webhooks.postmark.tsx` is Postmark's webhook (not
Shopify's), checked with a secret key in its address and a constant time compare. `webhooks.orders.create.tsx` is
switched off in the toml and verifies HMAC. Project checks all pass on main: typecheck, lint, test:app (327), build,
graphql-codegen, build:theme, test:storefront, test:functions (18), site build, `shopify app build`.

| New since the last run | Requirement | Status |
|---|---|---|
| Loyalty program on Growth and Pro, with usage limits and extras billed as App Pricing usage events (`app/lib/usage.server.ts`) | 1.2.x billing | ✅ Every charge through Shopify (plans and App Events usage). Extras off until the store turns them on, usage bars warn at 80% |
| Loyalty widget, Rewards page, points shop on the storefront | 1.1.4 factual, 5.1.x | ✅ Points, rewards and prices come from the store's settings and the member's ledger; nothing made up |
| Customer account, thank you, checkout (Plus redeem) and POS blocks | 5.6.2, 5.6.3, 5.6.6, 5.6.9 | ✅ Placed and removed by the merchant in Shopify's editors, no app promotion, no timers, no payment fields |
| Points shop checkout guard (cart validation Function) | 2.x, 5.6 | ✅ Refuses only products the merchant set "only with points" without their code; message names the product |
| Points shop collection, Unlisted products | 2.x | ✅ Only on the merchant's switch; only the collection and statuses the app set are changed back |
| Loyalty emails (Postmark) with unsubscribe and the store's address | 1.1.x, privacy | ✅ Reminders only to members subscribed to email marketing; one click unsubscribe; privacy page names Postmark |
| Klaviyo, Omnisend, Judge.me, Shopify Flow | 3.x data use | ✅ Only with the store's own keys, stated in the privacy page |
| Customer data the app keeps (2.3.17) | 2.3.17 | ✅ Loyalty members and history (Members page), back in stock requests (Stock page with CSV), return requests (Returns), reviews (Customer reviews), email pop up sign ups (Shopify customers), birthday and points written to the customer's metafield |
| read_all_orders (3.2.1) | 3.2.1 | ⚠️ Needed for orders older than 60 days on the Track and Returns pages and the loyalty look back. Omar requests it in the Partner Dashboard with that reason (`docs/scopes.md`) |
| Downgrades | 1.2.x | ✅ Locked features switch off on the store with settings kept and come back after an upgrade (#286, #291) |

### Omar's steps before submitting
- [ ] Partner Dashboard, once: the new plan prices (`app/lib/plans.ts`), usage meters `live-shipments`, `loyalty-orders`,
  `loyalty-emails` (prices in `METERS`), protected customer data reasons (loyalty: email, orders), read_all_orders
  request, network access for the Plus checkout block.
- [ ] Render: `POSTMARK_SERVER_TOKEN`, `POSTMARK_ACCOUNT_TOKEN` (emails), `APP_EVENTS_CLIENT_ID`,
  `APP_EVENTS_CLIENT_SECRET` (usage billing).
- [ ] Listing: pick 6 of the 9 screenshots in `branding/screenshots/storefront/` (alt text in
  `branding/listing/README.md`), feature image `branding/feature/feature-banner.png`.
- [ ] Review screencast in English: install, the setup guide, one offer, a bundle, the Track page, the loyalty program.
- [ ] Testing instructions: Testing 3 is a dev store; the reviewer installs on their own store, nothing to log in to.

### Needs a live check with a customer account (Testing 3)
- A member with points gets a Points shop product (points taken, code applied, the cart line at its money part,
  checkout passes) and a reward from the widget.
- A guest who ordered creates an account with the same email and sees their points.
- An Arabic store page shows the widget right to left.

## Audit update (2026-10-20, afternoon): after the 9 CRO sections (cro-toolbox-45, #211, #220)

**Verdict: code ready for review.** All 12 checks pass (typecheck, lint, test:app, build, graphql-codegen,
build:theme, test:storefront, test:functions, site and demos builds, config validate, theme check). Theme: 29 of 30
blocks, 93.3 of 100 KB Liquid (enforced limit: little room left, so new storefront features must reuse the shared
`ucs-section` block and stay small).

| New piece | Requirement | Status |
|---|---|---|
| Comparison table, benefits, tabs, guarantee, before and after, shoppable image, how it works | 1.1.4 factual, 5.1.4 branding | ✅ Merchant entered content only, no random numbers or app branding |
| Recently viewed | Privacy, consent | ✅ Product handles in the shopper's browser only, never sent to our server |
| Email pop up (`app/routes/proxy.subscribe.tsx`) | Consent, 5.1.5, abuse | ✅ Unticked consent box required, signed app proxy, bot field, 5 per hour per visitor, customer created in the store with SINGLE_OPT_IN consent, one use code only for that customer, nothing stored by the app |
| `write_customers` scope | 3.2.x, protected customer data | ✅ Documented in docs/scopes.md and both privacy pages. ⚠️ Partner Dashboard: "Marketing or advertising" added to the Email and customer data reasons (2026-10-20) |

## Audit update (2026-10-20): re-run on main after the Header, privacy and scope changes (cro-toolbox-41)

### Verdict
**Code ready for review.** No ❌ in the code. What's left is listing assets and Partner Dashboard steps only.

### Summary
Requirements re-fetched with `shopify doc fetch` (self review list + App Store requirements). Deterministic checks
(`check_app.mjs`): compliance webhooks subscribed and handled, no REST Admin API, no theme file writes or ScriptTags,
55 theme editor deep links, theme extension 28 of 30 blocks, 90.3 of 100 KB Liquid, every JS file under 10 KB gz,
Function input queries well under 3,000 bytes. Project checks all pass: typecheck, lint, test:app (176), build,
graphql-codegen, build:theme, test:storefront, test:functions, site build, `shopify app config validate`,
`shopify theme check`.

### What changed since the 2026-10-19 run, and the verdict for each
| Change | Requirement | Status |
|---|---|---|
| Plan links open our Plans page (#198) | 1.2.x billing, up and downgrade in app | ✅ Plans page buttons open Shopify's approval page per plan; no own charges |
| `read_all_orders` (#200) | 3.2.x demonstrated need | ✅ Approved by Shopify 2026-10-19 (Track page, Returns, Check against orders) |
| Post purchase access | 5.8.1 | ✅ Granted 2026-10-19 ("full access to the post-purchase extensions") |
| Header restored (#208) | 1.1.4, 5.1.4, 5.1.3 | ✅ No storefront app branding, no invented data, deep link from its design page |
| Privacy fixes (#212) | Protected customer data, consent | ✅ A/B snippet waits for analytics consent; retention cleanup; uninstall deletes every table (sessions, stock, returns, reviewer emails, feature requests, MCP, tracking, A/B views, Track codes and stats) |
| New self review rule **5.8.4** (max 3 consecutive post purchase requests) | 5.8.4 | ✅ One offer, then `done()` to the Thank you page. 5.8.2/5.8.3/5.8.6/5.8.7 also pass (fixed Pay now and Decline buttons, store product data, one CalloutBanner) |

### Needs live verification (dev store)
- [x] Partner Dashboard Online Store app checks: green on 2026-10-20.
- [ ] Lighthouse impact with the Header block on (product, collection, home) stays well under 10 points.
- [ ] A/B test on a storefront with a cookie banner: before consent version A and no `/apps/ucro/ab` request; after
      accepting, the version is kept from the next page.
- [ ] Re-run the automated checks in the Partner Dashboard last, right before submitting.

### Left before submitting (Omar, Partner Dashboard)
- [ ] Feature image + 6 screenshots in the approved style (`branding/listing/`), after the demos show real products.
- [ ] Screencast URL (3 to 8 minutes, English, setup + every core feature).
- [x] AI self review: re-run after the CRO sections and marked done (2026-10-20).
- [ ] Automated check, then Submit for review.
- Coming: the CRO sections work adds `write_customers` (email pop up). Re-run this audit and update the
  protected customer data form before submitting if it lands first.

## Audit update (2026-10-18): Built for Shopify pass

**Passing**
- App Bridge loaded from the Shopify CDN (latest), `s-app-nav` navigation.
- Contextual save bar in all 39 editors.
- Compliance webhooks with HMAC; no REST Admin API, no Asset API, no ScriptTag.
- Extension limits respected; every requested scope is used (`docs/scopes.md`).
- Server timings low; about 100 KB of JS on first load.
- Sales pop-ups, stock urgency and timers show real data only.

**Fixed in this PR (`claude/app-store-fixes`, needs a Shopify deploy)**
1. Trust badges: the default shows only "Secure checkout". Fast delivery, Free returns and Cash on
   delivery are choices the merchant ticks (help text: "Only show what your store really offers.").
   Saved settings are unchanged.
2. Reviews "Verified buyer": the per review flag and the card's verified display now default to off
   (a review with no flag no longer shows as verified). Help text on the flag: "Tick only if this
   person bought from your store." Not done: "Check against orders" (needs a review email field and
   order lookup; not cheap).
3. Back links (breadcrumb) on Tracking source (to Tracking & Returns), Assistant and MCP connect (to Settings).

**Live checks still to do (need a real store)**
- Lighthouse: storefront impact under 10 points, on a store without a password.
- Web Vitals in the Partner Dashboard after 100 loads.
- Mobile: open the admin in the Shopify mobile app.

**Storefront check on Testing 3, 2026-10-19 (supervisor, browser timings, not Lighthouse):** home 7 app files about 18 KB, product page 10 files about 35 KB gzipped; all app JS deferred, CLS 0, no long tasks, home LCP 1.8 s. Render blocking: only `ucs-boosters.css` (~3 KB gz) and `ucro.css` (~6 KB gz); nice to have: load booster CSS only where used. Expected well under the 10 point Lighthouse limit; confirm with Lighthouse on a store without a password.

**Decided 2026-10-19 (Omar): keep all scopes required at install for launch** (the reviewer tests every feature with no extra approval step; every scope is used). Revisit after launch if installs drop at the permission screen.

**Proposal (kept for later): optional scopes.** Today `shopify.app.toml` requires `read_returns`,
`write_returns`, `read_store_credit_accounts`, `write_store_credit_account_transactions`,
and `write_merchant_managed_fulfillment_orders`. Reviewers prefer a short list at
install, so these could move to `optional_scopes` and be requested when the merchant turns on returns,
store credit or fulfillment holds (`shopify.app.toml` `[access_scopes] optional_scopes`,
requested with App Bridge `scopes.request()`). It needs a "grant this feature" step in each of those
screens, so do it as its own PR.

Replaces the 2026-10-07 review (all its code findings are fixed: no 404 deal pages, privacy
webhooks act on stored data, sales pop-ups show each purchase once, no evergreen countdown, no
review markup for typed reviews). Requirements re-fetched today with `shopify doc fetch`
(app-store-requirements and app-store-ai-self-review-requirements).

## Verdict

**Not ready to submit yet.** The code passes every check, and the Shopify-side basics (session
tokens, GraphQL only, App Pricing, theme app extension only, compliance webhooks with HMAC, TLS)
are in place. Three things would get it rejected, plus the Partner Dashboard steps only Omar can do:

1. **After purchase offer had no CalloutBanner** (rule 5.8.7). Fixed in PR #95; needs a Shopify deploy.
2. **"See live demo" buttons open a dead page** (2.1.1): `crotoolbox.com/demo` does not exist.
3. **Post purchase extensions need Shopify's approval** (5.8.1: `write_checkout_extensions_apis`
   is granted by Shopify after a request). Until it's approved, the after purchase offer can't
   run on merchants' stores.

## Summary

Checks (2026-10-16/17, all pass): typecheck, lint, test:app 35, build, graphql-codegen,
build:theme (29 of 30 blocks, 86.9 KB of 100 KB Liquid), test:storefront, test:functions 71,
`shopify theme check`, `shopify app build`. Storefront JS ≤ 8.2 KB gzipped per file (limit 10).
Function input queries ≤ 805 bytes (limit 3000). No parser blocking scripts, no REST Admin API,
no ScriptTags or theme file writes, 56 theme editor deep links.
Production: `/` 200 in 0.5 s, `/privacy` 200, crotoolbox.com `/privacy/` and `/support/` 200;
`/webhooks/compliance` and `/webhooks/app/uninstalled` answer 401 without a valid HMAC.

## Findings

| # | Severity | Where | What's wrong | Fix |
|---|---|---|---|---|
| 1 | Fixed (#95) | `extensions/cro-post-purchase/src/index.jsx` | 5.8.7: the offer must show exactly one CalloutBanner at the top with intro text, product name and discount. D6 removed it. | PR #95 brings it back (app preview too). Deploy, then merge. |
| 2 | Fixed (#96) | `app/lib/site.ts` (`DEMO_URL`), `app/components/DemoButton.tsx` | 2.1.1: every "See live demo" button opens `crotoolbox.com/demo`, which does not resolve. | Create the Cloudflare Pages project `cro-toolbox-demos` (`docs/website.md`), or hide the buttons until it's live. |
| 3 | **Blocker** (Partner Dashboard) | `extensions/cro-post-purchase` | 5.8.1: post purchase extensions need Shopify's access approval (`write_checkout_extensions_apis`). | Request access in the Partner Dashboard, or leave the after purchase offer out of the first submission. |
| 4 | Should fix | `shopify.app.toml` (`read_orders`), `webhooks.orders.create.tsx` | Protected customer data not requested; the `orders/create` subscription is commented out until it is. | Request it (answers in `docs/listing.md` section 4), then turn the webhook back on and deploy. |
| 5 | Should fix | Admin after a save | First page load after a save or plan change takes about 15 s on Testing 3 (repeat visits under 5 s). A reviewer clicking around may see long blank pages (2.1.2). | Block D follow up F3 (terminal account). |
| 6 | Should fix | `app/components/DeleteOffer.tsx` | Deleting an offer with unsaved edits leaves Shopify's "Unsaved changes" bar stuck with a spinning Save (2.1.2 minor error). | Block D follow up F1. |

Passing on review of the code: sales pop-ups use real orders and show each once
(`ucs-boosters.js:185`); countdowns have no per-visitor restart; reviews emit no Review JSON-LD
(only FAQPage on the FAQ block); `Math.random` is used only for element ids and cart line ids;
the after purchase offer has preset "Pay now" / "Decline this offer" buttons, the price
breakdown (subtotal, shipping, taxes, total), one offer at a time and returns via `done()`.

## Partner Dashboard checklist (state on 2026-10-17)

The listing is a **Draft**; distribution is public (App Store).

- [x] Supported API versions, configuration issues fixed
- [ ] Emergency developer contact (email and phone) — Omar types it
- [ ] Listing content (English): text in `docs/listing.md` section 1, icon `branding/app-icon.png`,
      3 to 6 screenshots 1600 x 900, feature image or video, screencast (section 3)
- [ ] Protected customer data request (section 4 answers)
- [ ] Post purchase extension access request (finding 3)
- [ ] Select the app's capabilities, then the embedded app checks
- [ ] AI self review: done as this report; tick "I've reviewed all the App Store Requirements"
- [ ] Automated checks (install, redirect, webhooks, HMAC, TLS): run last, they expire after 30 days
- [ ] Submit for review

## Needs live verification (Testing 3)

Install and reinstall (OAuth straight away, lands in the app), uninstall cleans sessions,
storefront blocks on a product page (needs the storefront password), checkout discounts,
Lighthouse impact of the embeds (≤ 10 points), the setup guide ticking itself (D8).
