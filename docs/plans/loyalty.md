# Loyalty program (Pro): plan and status

Approved by Omar on 2026-10-21 ("build the loyalty now with all features that the app i sent you have and make it only
for pro plans and use paid email service ... and include the shopify plus features"). The reference app is Essent's
"Loyalty Program Rewards" (docs: https://essentials-docs.helpscoutdocs.com/collection/71-essential-loyalty-program-rewards).

## Status (2026-10-22)

| Part | What | State |
| --- | --- | --- |
| 1 | Carriers in the plan cards, the AOV and LTV positioning | Done (#253, #254) |
| 2 | Core: tables, earn engine, refunds, pending and expiry, privacy, Loyalty menu, home, earning rules, members | Done (#255, #256) |
| 3 | Rewards and redemption, store credit, app proxy, widget, product and cart points | Done (#257) |
| 4 | Rewards page, Look editor, demo, library entry | Done (#258) |
| 5 | VIP tiers, campaigns, product and collection rules, birthday, social follows, cashback | Done (#259) |
| 6 | Referrals and affiliate links with fraud checks | Done (#260): one "Loyalty referrals" discount holds every member code, affiliate discounts, fraud rules, gifts pending then usable and taken back on refunds, Referrals page, widget link and share buttons, `?ref=` banner |
| 7 | Emails with Postmark and the store's own sender | Done (#265): 11 emails, Emails page with preview and test send, own sender with DNS records and Verify, one-click unsubscribe, bounces, log, 10,000 a month |
| 8 | Klaviyo, Omnisend, Judge.me (review points), Shopify Flow trigger and action | Done: Klaviyo, Omnisend, Judge.me and review points (#268); Shopify Flow, 4 triggers, the Add loyalty points action and the lifecycle callback (#270) |
| 9 | Customer account page, thank you and order status points, Plus checkout redeem, POS | Built in #272 (extensions cro-loyalty-account, cro-loyalty-checkout, cro-loyalty-pos) |
| 10 | Loyalty analytics, CSV import and export, languages | Analytics and CSV in #269; languages to do |
| 11 | Website (remove "loyalty" from `SITE_HIDDEN` in `app/lib/catalog.ts`, feature page, help, privacy with Postmark, Klaviyo and Omnisend, pricing highlight), docs, App Store audit, Partner Dashboard list | To do |

Rows follow the plan's "Work, in PRs" list below. Commit messages and PR titles count loyalty parts from the core
(their "part 1" is row 2), so "part 5" in PR #260 is row 6.

How it works today (read the code before changing it):
- Order webhooks need protected customer data approval, which the app doesn't have for orders yet, so the loyalty
  engine **polls the Admin API every 10 minutes** (`app/lib/loyalty/sync.server.ts`, `startLoyaltyJobs`),
  plus a re-read of one member's orders when they open the widget (at most once a minute).
- Customer **names are not read**: the protected customer data approval covers email only ("This app is not approved
  to use the firstName field"). Omar has to add Name in the Partner Dashboard form before names can be used.
- Every points change goes through `record()` in `app/lib/loyalty/program.server.ts` (ledger plus balance in one
  transaction, `dedupe` keys make it idempotent, `strict` for spending).
- Storefront: `ucs-loyalty.js` and `ucs-loyalty.css`, loaded by the Conversion boosters embed only when the program is
  on; the Rewards page is a page kind of the "Order & wishlist pages" block. No new theme block.
- Not yet verified end to end on Testing 3: the program was never turned on there, and member flows need Omar to
  sign in as a customer and place an order himself.

---

## The approved plan (2026-10-21)

### Context
Omar wants a full loyalty program inside CRO Toolbox, with every feature of Essent Loyalty Program Rewards
(points, store credit cashback, VIP tiers, referrals and affiliate links, emails, POS, Klaviyo / Omnisend /
Judge.me / Flow, customer account page, loyalty page, analytics, languages), **including the Shopify Plus
checkout features**, with emails sent by a **paid email service** (best option chosen below). **Plans (Omar,
2026-10-22): Growth and Pro.** Growth: points, rewards, widget and Rewards page, referrals, birthday, social and
review points, emails; 500 loyalty orders and 1,000 emails a month. Pro: everything (VIP tiers, campaigns,
product rules, cashback, affiliates, integrations, own sender, checkout and POS); 2,000 loyalty orders and 5,000
emails a month. Above a limit: $5 per 100 orders, $2 per 1,000 emails ($4 per 100 live tracked shipments), only when
the store turns "Allow extra" on (Settings → Usage this month); bars warn at 80%. Billed as Shopify App Pricing usage
meters (live-shipments, loyalty-orders, loyalty-emails) through the App Events API (app/lib/usage.server.ts).
Limits live in `app/lib/plans.ts`; Pro only parts in `forPlan` (`app/lib/loyalty/config.ts`).
Partner Dashboard changes (prices, protected customer data, network access, listing) are done **once, at the
very end**, after his next messages and audits. He also asked that the **plan cards show how many shipping
companies** tracking works with. The rest of the audit (Analytics with A/B results, cart Discount code,
Track/Returns incentives, listing images, final App Store audit) continues after loyalty.

Constraints: theme 29 of 30 blocks and 91 of 100 KB Liquid (loyalty adds no block); storefront JS under 10 KB
gzipped per file; no dashes or first person in UI text; fields.tsx wrappers; DEMOS must equal FEATURE_KEYS;
privacy and compliance webhooks must delete every new table; Omar types every secret himself.

### Decisions
- **Email service: Postmark** (Platform plan, about $18 a month for 10,000 emails, then about $1.20 per
  1,000). Best inbox placement for account emails, the service Essent itself uses, separate streams for
  account emails and reminders, many sending domains for merchants' own branded domains. Code goes behind a
  small provider interface, so Resend (about $20 for 50,000) can replace it if Postmark declines the account.
  Fair use: 10,000 loyalty emails a month per store, shown in the app.
- **Sender, the same way Essent does it** (its docs: default `rewards@honeypop.io`, then "Sender email" after
  3 DNS records and a Verify button):
  - **Your own email (recommended, shown as a setup step)**: the merchant types a sender like
    `hello@theirstore.com`, the app shows 3 DNS records (ownership TXT, DKIM TXT, Return-Path CNAME, made
    through Postmark's domain API), the merchant adds them and clicks **Verify**. From then on every loyalty
    email comes from the store's own address and name. Checked again before each send; if it stops being
    verified, emails fall back to the default without stopping.
  - **Until then (default)**: From "Store name <rewards@mail.crotoolbox.com>", Reply-To the store's email,
    so shoppers see the store's name and their replies reach the store.
  - Why not send from the store's address without DNS: Gmail, Yahoo and Outlook reject or spam mail that
    claims a domain which didn't authorise the sender, and free addresses (@gmail.com) can't authorise anyone,
    so those stores stay on the default sender with their address as Reply-To.
  - Every email has a one-click unsubscribe. Reminder emails (points expiring, birthday, win-back) only go to members subscribed
  to email marketing in Shopify; account emails (points earned, reward ready, tier change, referral reward)
  go to every member who joined.
- **Plus features**: redeem points and see points to earn inside checkout (checkout UI extension, Shopify
  Plus only); store credit rewards apply themselves at checkout for logged in customers (all plans).
- **Where it lives in the app**: a new menu item **Loyalty** (own area in catalog.ts), feature key `loyalty`,
  FEATURE_PLAN `pro`.
- **Carriers in the plan cards**: Growth "Basic tracking for any carrier in Shopify"; Pro "Advanced tracking
  for 3,000+ carriers" (17TRACK, our live tracking, states 3,200+; confirmed at build time from its public
  carrier list). Same number on the tracking source page and the website feature page. Still 7 highlights per
  plan; Pro also gets "Loyalty, VIP tiers and referrals" by merging two returns lines.
- **Positioning: a tool to increase AOV and LTV** (Omar). Offers, bundles and cart tools raise average order
  value; loyalty, the Track page, store credit and returns that keep the sale raise lifetime value. Said in:
  the App Store listing texts (app introduction, details, feature lines in `docs/listing.md`, entered in the
  Partner Dashboard in the final update), the app's own description (catalog intro on Home, `/privacy`
  summary, MCP server description), and the website (home hero and meta description, pricing page,
  `llms.txt`, feature page intros where it fits, alternatives pages). AOV and LTV spelled out once on each
  page ("average order value (AOV)", "lifetime value (LTV)"), never as an unproven promise or a number.

### Features (all of Essent's, Pro)
- **Earn**: points per currency unit on paid orders (option to exclude shipping and taxes, products or
  collections with their own rate, products that earn nothing), account signup, first order bonus, birthday,
  product reviews (our Customer reviews and Judge.me), social follows (Instagram, TikTok, Facebook, X, YouTube,
  click to earn), limited time points multipliers, custom points from Shopify Flow, manual adjust, CSV import.
  Pending days before points can be used; refunds and cancellations take points back; points expiry.
- **Cashback mode**: earn store credit (a % of each order) instead of points.
- **Rewards**: amount off, % off, free shipping, free product (also an unlisted, rewards only product), store
  credit; minimum order, combinations, expiry; one-use codes tied to the customer; redeem in the widget, the
  loyalty page, the customer account page, at checkout (Plus) and in POS.
- **VIP tiers**: by points or by money spent, lifetime or rolling 12 months; perks (earn multiplier, entry
  bonus, tier-only rewards, free shipping); tier expiry and downgrade rules; Shopify customer tag per tier.
- **Referrals and affiliate links**: each member's link and code; the friend's reward on their first order;
  the referrer's reward after the friend's order is paid (and not refunded); fraud checks (same customer,
  same email, self-referral); share by WhatsApp, X, Facebook, email, copy. Affiliate links for creators with
  their sales tracked (no payouts).
- **Storefront**: floating launcher and panel (guest and member views: join, balance, ways to earn, rewards,
  referral, tier progress, history), "Earn X points" on product pages and product cards, points in the cart,
  "You earned points" pop-up, dedicated loyalty page (hero, how it works, ways to earn, rewards, tiers,
  referral, FAQ), points on the thank you and order status pages, customer account page.
- **Emails** (Postmark): welcome, points earned, reward ready, reward code, points expiring, birthday, tier up
  and down, referral reward, monthly summary; logo, colours, texts per email; test send; branded domain.
- **Integrations**: Klaviyo and Omnisend (profile properties and events), Judge.me (review points), Shopify
  Flow (triggers: points earned, reward redeemed, tier changed, points expiring; action: add or remove points).
- **POS**: tile and customer details block to see points, earn on POS orders, redeem a reward in store.
- **Admin**: Loyalty home (setup steps, numbers, kill switch), Earn, Rewards, VIP tiers, Referrals, Emails,
  Look and placements, Members (search, history, adjust points, change tier, block), Import and export CSV,
  Integrations, Languages (texts per store language for widget, page and emails).
- **Analytics**: members and active members, points issued, redeemed and expired, rewards used, orders and
  revenue from loyalty codes, store credit and referrals, repeat purchase rate members vs others, per tier, ROI
  vs the plan price. Also shown in the Analytics rebuild.

### Architecture (reuse first)
- **Data** (Prisma, SQLite and Postgres migrations like `prisma/migrations/20261026000000_carrier_links`):
  `LoyaltyMember` (shop, customerId, email, firstName, locale, birthday, points, pending, lifetime, spent,
  tier, referralCode, referredBy, emailOptOut, blocked), `LoyaltyEvent` ledger (kind, points, orderId,
  availableAt, expiresAt), `LoyaltyReward` (redemptions, code, value, used order), `LoyaltyReferral`,
  `LoyaltyEmail` (log), `LoyaltyIntegration` (encrypted keys). Settings and texts in `$app:cro_design`
  "loyalty" / "_editor" through `getDesign` / `upsert` (app/lib/designs.server.ts) with a storefront copy.
- **Code**: `app/lib/loyalty/` config.ts (types, defaults, clean), points.ts (pure earn, tier, expiry maths),
  members.server.ts, rewards.server.ts (codes: same approach as `givenCode` in
  app/lib/track-sell.server.ts; store credit: `storeCreditAccountCredit`, scope already granted),
  referrals.server.ts, jobs.server.ts (hourly: pending to available, expiry, birthdays, tier review,
  reminders; same timer pattern as `startRetention` in app/lib/retention.server.ts), `app/lib/email/`
  (provider interface, postmark.server.ts, templates, unsubscribe tokens, bounce webhook), integrations
  (keys encrypted with `encrypt` / `decrypt` from app/lib/tracking/secret.server.ts).
- **Webhooks** (shopify.app.toml): `orders/paid`, `orders/cancelled`, `refunds/create`, `customers/create`.
  Compliance (`webhooks.compliance.tsx`) and uninstall delete every loyalty table; retention rules added.
- **Storefront** (no new theme block): launcher, product and cart points via the existing Conversion
  boosters embed (`theme/blocks/ucs-boosters.liquid`) loading new `ucs-loyalty.js` only when loyalty is on;
  loyalty page as a new page kind of the "Order & wishlist pages" block (`theme/blocks/ucs-order-page.liquid`,
  like track / returns / wishlist, page made by `createOrderPage` in app/lib/order-page-setup.server.ts).
  App proxy route `proxy.loyalty.tsx` (balance, join, redeem, birthday, social, referral) using Shopify's
  signed `logged_in_customer_id`, guarded by `json` / `readJson` / `tooMany` (app/lib/proxy-guard.server.ts).
- **New extensions**: customer account UI extension (rewards page and profile block), checkout UI extension
  (Plus: points and redeem near the discount field), loyalty module in the existing `extensions/cro-thank-you`,
  POS UI extension, Flow trigger and action extensions.
- **Analytics attribution**: loyalty codes and referral codes counted like Track page codes in
  app/lib/results.server.ts (`codeGroup`).

### Work, in PRs (each: branch, checks, PR, deploy when extensions change, merge, verify on Testing 3)
1. Carriers in the plan cards and tracking pages, and the AOV and LTV positioning in the app, the website and
   `docs/listing.md` (small, first).
2. Loyalty core: tables, config, earn engine (webhooks), refunds and cancellations, pending and expiry jobs,
   compliance deletion, Loyalty menu, home and settings, Members list with history and adjust.
3. Rewards and redemption (codes, free shipping, free and unlisted product, store credit, cashback mode),
   app proxy, storefront launcher and panel, product, card and cart points, earned pop-up.
4. Loyalty page and the look editor (templates, colours, texts, placements), demo and library entry.
5. VIP tiers, multipliers, product and collection rules, birthday, social follows, review points.
6. Referrals and affiliate links with fraud checks.
7. Emails with Postmark: provider, templates, branding, the store's own sender email (DNS records, Verify,
   status badge, fallback), unsubscribe, bounces, log, test send.
8. Integrations: Klaviyo, Omnisend, Judge.me, Shopify Flow trigger and action.
9. Customer account page, thank you and order status points, Plus checkout redeem, POS.
10. Analytics for loyalty, CSV import and export, languages.
11. Website (feature page, help, pricing highlights, privacy policy with Postmark, Klaviyo, Omnisend), docs,
    App Store audit re-run, list of Partner Dashboard changes for the final update.

### Omar's steps (later, together, at the end unless he says otherwise)
- Postmark: sign up, add the DNS records for mail.crotoolbox.com in Cloudflare, type `POSTMARK_SERVER_TOKEN`
  (sends) and `POSTMARK_ACCOUNT_TOKEN` (merchants' sender domains) into Render (he types them). Needed before
  emails reach real inboxes; until then every email is logged as skipped with the reason. The app makes the
  bounce webhook itself.
- Partner Dashboard, once: new prices, protected customer data (first name, birthday, loyalty purpose,
  Postmark / Klaviyo / Omnisend as processors), network access for the checkout and customer account
  extensions, listing text with the AOV and LTV positioning, Loyalty category.
- Testing 3: log in as a customer and place one test order himself (I don't place orders or sign in).

### Verification
- Every PR: typecheck, lint, test:app (new tests for points maths, tiers, expiry, refunds, referral fraud
  rules, reward codes, email templates and unsubscribe, webhook handlers, compliance deletion), build,
  build:theme (still 29 blocks, Liquid under 100 KB), test:storefront, test:functions, demos and site builds,
  JS gzip size under 10 KB per file.
- Webhooks tested with `shopify app webhook trigger` against Testing 3 and with Omar's test order: points
  appear, pending turns available, a refund takes points back, a reward code works in the cart, store credit
  shows at checkout, a referral pays out once.
- Emails: Postmark test token in tests; one real email to Omar's inbox once his Postmark account is ready.
- Browser checks on Testing 3 at desktop and phone width: launcher, panel, loyalty page, product points,
  customer account page, admin pages.
