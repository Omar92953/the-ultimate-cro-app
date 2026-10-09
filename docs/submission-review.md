# App Store submission review — The Ultimate CRO App (2026-10-07)

Reviews run: `/code-review high` (whole project), a manual security review with the
`/security-review` focus list (the slash command needs the session to start in the repo
folder), deploy checklist (Render + Supabase), accessibility review (WCAG 2.2 AA, code-level),
the new `shopify-app-store-audit` skill (checklist built from Shopify's docs fetched today with
`shopify doc fetch`), and the project's own checks.

## Verdict: **not ready to submit**

The code is in good shape: all checks pass, there are no security holes, it's GraphQL-only, it
uses session-token auth and App Bridge, theme changes go only through the theme app extension,
the compliance webhooks are subscribed and HMAC-checked, and there are deep links into the
theme editor. Five things would still get it rejected or block the submission:

1. **Unfinished bundle-deal pages return 404s.** Shopify rejects any error page on the
   reviewer's path (requirement 2.1.1).
2. **The privacy webhooks ignore data the app now stores.** The sales pop-ups keep order-derived
   data (purchase time, optional shipping city), and `customers/redact` doesn't delete it.
3. **Protected customer data isn't approved.** `read_orders` plus the `orders/create` webhook
   need approval in the Partner Dashboard before a version can be released. That request needs
   a distribution method, which is your permanent choice.
4. **There is no production host yet.** `application_url` is still `https://example.com`, and the
   server must be up and fast for the whole review (Render Starter + a paid database = your
   decision).
5. **Listing items only you can provide are missing:** privacy policy URL, screenshots,
   screencast, and test instructions (see the checklist below).

Three more aren't hard blockers but are real rejection risks under "factual information"
(1.1.4): the sales pop-up repeats the same purchase, the per-visitor "evergreen" countdown, and
hand-typed reviews published as Google review markup.

## Fix status (updated 2026-10-07, after review)

- **#15 (name):** renamed to **CRO Toolbox** on 2026-10-09 (checked: no app with this or a similar name in the App Store; "CROkit" exists, so "CRO Kit" was avoided). Takes effect in Shopify after the next `shopify app deploy`.
- **Fixed:** #1 (deal editor built for all 4 types; no more 404s), #2 (redact/data_request now act on the sales pop-up list, which keeps the order id per entry), #5, #8, #9, #10, #11, #12 (+ tests), #13, #17, #18, #19, #21, #24.
- **#3 workaround:** the `orders/create` subscription is commented out in `shopify.app.toml`. Without protected-data approval Shopify refused to start even `shopify app dev`. Turn it back on after approval. Until then, "Load recent orders" on the Boosters page shows the approval message.
- **Also changed:** review cards in a row now share one height, with name, badge and product aligned at the bottom.
- **Still open (need your decision):** #3 approval, #4 hosting, #6 evergreen countdown, #7 review markup, #14 Liquid budget (98.5/100 KB), #15 name, #16 billing, plus nice-to-haves #20, #22, #23, #25.

## Summary

| | |
|---|---|
| App Store audit (local requirements) | ✅ 30 likely passing · ❌ 3 likely failing · ⚠️ 4 need review · ⏭️ 9 groups skipped (5.2–5.11: not a payments, purchase-option, checkout, channel, post-purchase or donation app) |
| `npm run test:functions` | ✅ 26 + 9 tests pass |
| `npm run typecheck` | ✅ (1 error in the in-progress deals list page; fixed, see note) |
| `npm run lint` | ✅ |
| `npm run build` | ✅ (only React Router v8 future-flag notices) |
| `npm run graphql-codegen` | ✅ all operations valid against Admin API 2025-10 |
| `npm run test:storefront` | ✅ harness checks pass |
| `shopify theme check` (cro-storefront) | ✅ 20 files, no offenses |
| Theme extension limits | Liquid **97.8 KB / 100 KB** (enforced, 2.2 KB left) · 14/30 blocks · schema locale 9.8/15 KB (239 keys / 250) · every JS file ≤ 5.4 KB gz (limit 10) · CSS ≤ 9.4 KB gz · no parser-blocking scripts |
| Function limits | Input queries 805 B and 382 B (limit 3000) · config metafields capped at 9,500 B in code |

Note: the one typecheck error was in `app/routes/app.deals.$kind._index.tsx`, the page I was
writing when the review started. I changed its React `key` so the checks could run. That is the
only code change. Everything below is proposed, not applied.

## Findings

Severity: **Blocker** = likely rejection or a broken reviewer path · **Should fix** = risk,
policy grey area, security or quality · **Nice to have**.

| # | Severity | Where | What's wrong | Proposed fix |
|---|---|---|---|---|
| 1 | **Blocker** | `app/routes/app.deals.$kind._index.tsx:50`, `app/components/BundleTabs.tsx:6` | Bundles → "Fixed bundles / Buy X get Y / Volume / Gift" tabs link to `/app/deals/:kind/new` and `/app/deals/:kind/:handle`. Those routes don't exist yet, so they return 404s (2.1.1). | Finish the deal editor and storefront widgets (already planned), or hide the deal tabs until they're done. |
| 2 | **Blocker** | `app/routes/webhooks.compliance.tsx:19-25`, `app/lib/boosters.server.ts:96-103` | `customers/redact` and `customers/data_request` do nothing, and the comment says the app stores no customer data. It now does: `$app:cro_recent` keeps purchase time + product + optional shipping city per order, with no order id to find it by. | Store `orderId` with each entry. On `customers/redact`, remove entries whose id is in `orders_to_redact` (via `unauthenticated.admin(shop)`). On `data_request`, log what's held. Update the comment and the privacy policy. |
| 3 | **Blocker** | `shopify.app.toml:31-35` (orders/create), `scopes` (read_orders), `app/lib/boosters.server.ts:55` | Orders are protected customer data (level 1), and shipping city is an address field (level 2). Releasing a version that subscribes to `orders/create` needs approved access, and the request needs a distribution method chosen first. | Decide on distribution (yours, permanent), then request access with the reason "sales pop-ups show real recent purchases". To stay at level 1, drop the city option. Alternative: make `read_orders` an optional scope and subscribe to the webhook from code only when a merchant turns pop-ups on. |
| 4 | **Blocker** | `shopify.app.toml:5,17` | `application_url` / `redirect_urls` = `https://example.com`. There's no production server, and reviewers install, uninstall and send privacy webhooks. | Create the Render service + database (paid, your decision), set the URLs, then `shopify app deploy` (I'll ask first). |
| 5 | **Should fix** | `extensions/cro-storefront/assets/ucs-boosters.js:184-199` | Sales pop-ups cycle `recent[index % length]`, so a shop with 1 order shows the same purchase up to 5 times per visit. That looks like 5 sales (1.1.4 "false purchase notifications"). | Show each purchase at most once per session, then stop. |
| 6 | **Should fix** | `theme/blocks/ucs-countdown.liquid:32-34`, `ucs-countdown-bar.liquid:76-78`, `assets/ucs-countdown.js` | The "Evergreen" mode restarts the timer for each visitor (localStorage), and "restart" at the end creates urgency that isn't real (1.1.4). Reviewers reject fake-scarcity timers. | Remove evergreen and restart modes. Keep a fixed date and the daily cut-off ("order in 2h 10m for same-day dispatch"), which are true statements. |
| 7 | **Should fix** | `theme/blocks/ucs-reviews.liquid:186-195`, `app/lib/sections.ts:118-129` | Merchants can type any name, rating and text, and on product pages this is published as Review JSON-LD. Typed testimonials are allowed, but the app shouldn't present them as verified or feed them to Google as product reviews (1.1.4 + Google's self-serving review policy). | Don't emit Review/AggregateRating markup for hand-entered reviews (or default the setting to off with a warning). Show "Verified buyer" only when tied to an order. Add a line in the editor: "Only add real customer feedback." |
| 8 | **Should fix** | `render.yaml:25-26` | `SCOPES` leaves out `write_files` and `read_orders` from the TOML, so server scopes ≠ granted scopes. The result is a token exchange on every request, and uploads/order refresh can fail. | Copy the TOML scope list exactly (or derive SCOPES from one place). |
| 9 | **Should fix** | `app/lib/cro.server.ts:676-684` | `syncFunctionDiscount` writes the storefront deals before checking the Function config size, then throws. The storefront then advertises a deal that checkout won't apply. | Build and validate the config first; write the storefront copy only after the Function metafield is saved. |
| 10 | **Should fix** | `app/routes/app.deals.$kind._index.tsx:23-29` | Pause/Activate re-saves the whole deal JSON sent by the browser, so a stale tab overwrites newer edits and pushes them to checkout. | Send only id + active; load the deal on the server. |
| 11 | **Should fix** | `app/lib/boosters.server.ts:84-104`, `:49-80` | The orders/create handler reads, changes and writes the list without de-duplication. Shopify retries, and concurrent orders, cause duplicate or lost entries. `refreshRecent` doesn't skip draft/archived products or test/cancelled orders. | Key entries by order id and skip existing ones. Filter `product.status == ACTIVE`, `test:false` and non-cancelled orders in the refresh query. |
| 12 | **Should fix** | `extensions/cro-bundles/src/cart_transform_run.js:93-96` | Shopper-supplied variant ids allow leading zeros: "044…" and "44…" count as different ids, which gets around "no duplicates", and the raw string goes into the gid. | Use `/^[1-9]\d{0,15}$/` and key by `String(Number(id))`. |
| 13 | **Should fix** | `theme/blocks/ucs-boosters.liquid:19-22` | The exact stock of every tracked variant is in the page source on all product pages, even with urgency off. | Output stock only when urgency is on, and cap it at the threshold. |
| 14 | **Should fix** | `scripts/build-theme.mjs` budget, Liquid 97.8/100 KB | The planned deal widgets (and any new section) will exceed the enforced limit, and deploy fails. | Render deal widgets from JS (data already in `cro_offers`). Move more design settings into the app. |
| 15 | **Should fix** | `shopify.app.toml:4` | "The Ultimate CRO App" isn't brand-led, and "Ultimate" reads as a superlative claim (4.1.2, 4.3.3). The TOML name and the listing name must match (4.1.1). | Rename before listing (e.g. "Apex CRO …", as you planned) in both places. |
| 16 | **Should fix** | Billing (none in code) | Fine while the app is free. Planned paid plans and per-section purchases must use Shopify App Pricing or the Billing API, with upgrade/downgrade in the app (1.2.x). | Submit as Free now, or build billing first. Don't mention future prices in the listing. |
| 17 | **Should fix** | `theme/blocks/ucs-announcement.liquid:68`, `assets/ucs-announcement.js:94-105` | A11y: auto-rotating messages sit in `aria-live="polite"`, so screen readers announce every rotation. Rotation pauses only on hover/focus and there's no pause button (WCAG 2.2.2). | Turn aria-live off while it auto-rotates, and add a small pause/play button. |
| 18 | **Should fix** | `theme/blocks/ucs-logos.liquid:105`, `assets/ucs-sections.css:134` | A11y: the logo marquee moves forever, and it pauses only on hover if a setting is on (2.2.2). Reduced motion is respected. | Always pause on hover/focus and add a pause button, or stop after one loop. |
| 19 | **Should fix** | `app/components/SectionShowcase.module.css:14,19` | A11y: Home card arrows are 22×22 px and dots are 6×6 px, below the 24×24 px minimum target (WCAG 2.2 2.5.8). | Make the arrows 24 px+ and give the dots a 24 px hit area (padding) while keeping the 6 px look. |
| 20 | Nice to have | `assets/ucs-boosters.css` (sticky bar, pop-up) | A11y: the fixed sticky bar and pop-up can cover the focused element (2.4.11). | Add `scroll-padding-bottom` while the bar is shown. |
| 21 | Nice to have | `assets/ucs-boosters.js:190-205` | "minutes ago", " in ", "Close" are hard-coded English on the storefront. | Move them to `locales/en.default.json`. |
| 22 | Nice to have | `app/routes/auth.login/route.tsx:34-41` | The template's "Shop domain" login form is still reachable at `/auth/login` (2.3.1 says never ask for a myshopify domain). Managed install doesn't use it. | Remove the route, or redirect it to the App Store listing. |
| 23 | Nice to have | `app/routes/_index/route.tsx:26-41` | The public landing page lists only 3 features. | Update it when the name and features are final. |
| 24 | Nice to have | `Dockerfile:1` | `node:20` while Render runs Node 22. Render doesn't use the Dockerfile. | Align to 22 or delete the Dockerfile. |
| 25 | Nice to have | `app/lib/cro.server.ts:1113` | Theme status reads only the first 250 template/section JSON files. | Paginate if a theme has more. |

### Security review (focus areas)

- **Webhook HMAC: OK.** All 4 webhook routes (`app/uninstalled`, `app/scopes_update`,
  `orders/create`, `compliance`) use `authenticate.webhook`, which checks the HMAC over the raw
  body and returns 401 on failure. `apiSecretKey` is required at start-up.
- **`_bundle_components`: OK, with one fix (#12).** Every pick is checked against the merchant's
  config: step count, min/max, allowed variants, duplicates. A crafted property can't swap in
  other products or change the price.
- **`_cro_gift`: OK.** It's only honoured when the line is the configured gift variant. Only 1 unit
  is free, and the threshold is measured on the rest of the cart in the shopper's currency. Extra
  gift lines and fake markers are ignored (tested).
- **Storefront input: no server exposure.** The storefront never calls the app server (no app
  proxy). Script-built HTML escapes text. Merchant links are normalised, so `javascript:` URLs
  become `https://…`.
- **Secrets: OK.** `.env*`, `prisma/dev.sqlite` and `.shopify` are git-ignored, and none are in
  history. Admin actions use the session's own shop, so there's no cross-shop access. Sessions
  (access tokens) are stored unencrypted, as in Shopify's template; Supabase encrypts at rest.

## Deploy checklist: Render + Supabase (gaps marked ❌)

Pre-deploy
- ✅ Tests, typecheck, lint, build, Theme Check pass locally (no CI configured; ❌ nice to add a GitHub Action).
- ✅ Postgres migration exists (`prisma/postgres/migrations/20260923000000_create_session_table`) and matches the SQLite model.
- ✅ `start:production` runs `prisma migrate deploy` before serving. That's fine for one instance; with more than one, run migrations as a separate pre-deploy step.
- ❌ `render.yaml` SCOPES out of sync (#8).
- ❌ `shopify.app.toml` URLs still `example.com` (#4).
- ❌ Paid plans not chosen: Render **Starter** (free sleeps; webhooks would time out) and **Supabase Pro** or paid Render Postgres (Supabase Free pauses after a week). These cost money and are your decision.
- ❌ No error monitoring or alerting (Render logs only). Nice to add before real merchants.
- Env vars to set in Render: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES` (= TOML), `DATABASE_URL` + `DIRECT_URL` (Supabase Session pooler, port 5432), `NODE_ENV=production`, `NODE_VERSION=22`.

Deploy (order matters)
1. Render service up, `/` returns 200 (health check).
2. Set `application_url` + `redirect_urls` to the Render URL → `shopify app deploy` (releases app config + Functions + theme extension as one version; I ask first).
3. Smoke test on the dev store: install, open every page, save one item per type, storefront blocks, checkout discount, bundle split, uninstall → reinstall, compliance webhooks (401 unsigned / 200 signed).

Rollback
- Server: Render → Deploys → "Rollback" to the previous build. The Session table migration is additive and safe to keep.
- Extensions and config: Partner Dashboard → app → Versions → release the previous version (Functions, theme blocks and TOML config roll back together).
- Merchant data lives in the shop's metaobjects, so a server rollback can't lose it.
- Roll back if installs or OAuth fail, any admin page returns 5xx, webhooks return non-2xx, or checkout discounts are wrong.

## App Store audit: items that need review / likely failing

- ❌ **2.1.1 No error pages:** #1.
- ❌ **Compliance webhooks (privacy-law-compliance):** subscribed and HMAC-checked, but they don't act on stored order data (#2).
- ❌ **Protected customer data:** not requested yet (#3).
- ⚠️ **1.1.4 Factual information:** sales pop-ups use real orders (good), but see #5, #6 and #7.
- ⚠️ **1.1.9 Buyer consent for charges:** the planned "gift with purchase" auto-adds a product. It must only be added when it will be free, and be removed when the cart drops below the minimum, so a shopper is never charged for it without choosing it. Test this when it's built.
- ⚠️ **1.2.1 Billing:** none, which is OK only if listed as Free (#16).
- ⚠️ **3.1.1 TLS:** depends on the production host (Render gives HTTPS).

Skipped groups: 5.2 Payment, 5.3 Payment facilitator (opt-in), 5.4 Purchase option, 5.5 Product
sourcing (opt-in), 5.6 Checkout UI, 5.7 Sales channel, 5.8 Post purchase, 5.9 Mobile app builders
(opt-in), 5.10 Donation (opt-in), 5.11 Blockchain. No signals for any of them.

## Listing & submission checklist (only you can provide)

| Item | Status |
|---|---|
| App icon 1200×1200 PNG, no text/Shopify marks | ✅ `branding/app-icon.png` (1200×1200, no text). Re-check it once the app is renamed |
| App name ≤ 30 chars, brand-led, same in TOML and listing | ❌ decide the new name (#15) |
| App card subtitle; introduction (≤ 100 chars); details (≤ 500); features (≤ 80 chars each). No stats, "best/first/only", reviews or prices | ❌ to write. I can draft from the features |
| 3–6 screenshots 1600×900 (no browser chrome, pricing, reviews or stats) + feature image 1600×900 or 2–3 min video | ❌ missing |
| Demo screencast in English: install → setup → each core feature → storefront → checkout discount | ❌ missing |
| Testing instructions for reviewers (which dev store and theme, where each block is, that discounts show at checkout). No external login needed | ❌ missing. I can draft them |
| Pricing details (Free, or the plans once billing exists) | ❌ decide |
| Support email / support URL | ❌ missing (API contact email must not contain "Shopify") |
| Privacy policy URL (mention order data used for sales pop-ups and how redaction works) | ❌ missing |
| Emergency developer contact (email + phone) in Partner Dashboard | ❓ can't tell |
| "Merchant must have online store" ticked; note "Online Store 2.0 theme needed for app blocks" | ❌ set in the form |
| Protected customer data request (orders; city only if kept) | ❌ after distribution is chosen |
| Production URL live, compliance webhooks reachable | ❌ #4 |
| Lighthouse impact ≤ 10 points (home 17%, product 40%, collection 43%) | ❓ measure on the dev store |

## Verified only on a dev store

These were added to `docs/testing-checklist.md` → "App Store review checks".
