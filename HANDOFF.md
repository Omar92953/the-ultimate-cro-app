# Handoff: CRO Toolbox lead role (2026-10-22)

Written by the lead session on Omar's Mac (Claude desktop app, Code tab). It ran building, reviews, Shopify
deploys, merges and Testing 3 checks from 2026-10-19 to 2026-10-22. Omar asked to hand off to his main Claude
account, which takes over **all** of that work. Everything is in the repo; never rely on old chats. Where
`CLAUDE.md` or `docs/WORKBOARD.md` differ from this file, trust them.

## Update 2026-10-24 (read this first)

The state in `CLAUDE.md` (Status) replaces "Where things stand" below. Since 2026-10-22 the lead merged #260 to #303:
loyalty parts 5 to 11 with languages and guest checkouts, the Points shop, the plan limits with usage extras, the
discount code box card, the loyalty website pages, and the deep audit (`docs/audit-2026-10-23.md`). The second
account is no longer used. Lessons from the live checks, worth keeping in mind for storefront scripts:

- Themes like Dawn put a hidden installments form before the product form, and cards carry a hidden second title
  link: never take "the first" form or link; take the one with a submit button, and links that are visible.
- Shopify runs cart validation Functions when a product is added to the cart, not only at checkout: apply a discount
  code (cart/update.js `discount`) before adding a product the guard protects.
- A PR stacked on another PR's branch merges into that branch, not main: retarget it to main first.

## How to start

1. Claude desktop app → **Code** tab → new session in `/Users/omarmoaz/Workspace/Coiding/Shopify apps/Cro Toolbox/cro-toolbox` → model **Opus 5.5**.
2. Say: **"Read HANDOFF.md and CLAUDE.md and follow them."**
3. Run `git fetch --prune && git checkout main && git pull`. Then read `docs/TEAM.md`, `docs/WORKBOARD.md`
   (section "Loyalty and pre-final audit"), `docs/plans/loyalty.md`, `docs/PROJECT-GUIDE.md` and
   `docs/submission-review.md`, and run `gh pr list`.
4. Continue with **draft PR #260** (loyalty referrals): `git checkout claude/loyalty-referrals`. If typecheck
   complains about Prisma models, run `npx prisma generate`, then `npx prisma migrate deploy` for the local
   dev.sqlite.

## Your role

- Build, review and ship. Omar made the lead responsible for building, reviewing, deploying, merging, testing on
  Testing 3, and guiding his Partner Dashboard steps one click at a time.
- Shipping steps, in order:
  1. One `claude/<topic>` branch per change.
  2. All checks pass.
  3. Open a PR.
  4. If `extensions/`, `theme/` or `shopify.app.toml` changed, deploy to Shopify.
  5. Merge.
  6. Verify on Testing 3.
  7. Note it on the workboard.
- Checks:
  - `npm run typecheck`, `lint`, `test:app`, `build`, `graphql-codegen`, `build:theme`, `test:storefront`,
    `test:functions`
  - `npm --prefix site run build` (it builds the demos too)
  - `shopify app config validate`
  - `shopify theme check --path extensions/cro-storefront`
- Deploy from the Mac: `NODE_OPTIONS=--dns-result-order=ipv4first shopify app deploy --allow-updates --message "..."`.
  Deploy the reviewed commit, then merge. `shopify app versions list` shows what is live.
- Read-only GraphQL checks and introspection on Testing 3:
  `shopify app execute -s testing-3-xsslpo6d.myshopify.com --no-input -q '...'`.
- Render (`https://cro-toolbox.onrender.com`, service `srv-db5plrnavr4c739kvhh0`):
  - Auto-deploys `main` and runs `prisma migrate deploy` on start.
  - If it skips a merge: Manual Deploy → Deploy latest commit.
  - `SCOPES` comes from `render.yaml` and must equal the scopes in `shopify.app.toml`.

## Where things stand (2026-10-22)

- Live: Shopify app version **cro-toolbox-55** (the last deploy; check with `shopify app versions list`). Render
  runs `main` (last merge #259). Website crotoolbox.com is live on Cloudflare Pages.
- Shipped since 2026-10-19 (#208 to #259):
  - Header block back.
  - Home rows rounded, all cards white.
  - Image carousel 2 (coverflow, `ucs-coverflow`), and a Customer reviews template in that look (colour fill,
    crop, centering).
  - The 9 CRO sections shown in the library.
  - Size chart grid fixed.
  - Tracking & Returns split into two tabs. Track page output switches. Tracking stays by email, with no postal
    code lookup (Omar).
  - Tracking for any carrier:
    - One tracking on Growth and Pro (Omar, 2026-10-22): Shopify's data, 17TRACK live tracking (200 shipments a
      month on Growth, 500 on Pro) with 3,500+ carriers and the carrier code passed through
      (Bosta, MyLerz, J&T Express (EG), Aramex, SMSA, iMile and more). AfterShip, TrackingMore and Ship24 keys
      also work.
    - Carrier links and hand-typed updates cover any courier.
    - A Shipments page.
  - New prices **in the code**: Growth $19.99 ($199 a year), Pro $39.99 ($399 a year).
  - Positioning everywhere: "CRO Toolbox is a Shopify app to increase average order value (AOV) and lifetime value
    (LTV)". It is in the listing text in `docs/listing.md`, the app Home, the website, `llms.txt` and the privacy page.
  - Loyalty (Pro) parts 1 to 4: see `docs/plans/loyalty.md`.
- **Prices match since 2026-10-25** (see `CLAUDE.md` Status). Before that the Partner Dashboard App Pricing plans had the old prices (Starter $5.99,
  Growth $14.99, Pro $24.99). Omar wants every Partner Dashboard change done **once, at the very end**, after his
  audits. Until then, the plans page in the app shows the new prices while Shopify would charge the old ones.
  Don't launch before that update.
- Protected customer data:
  - **email** is approved. **firstName is not** ("This app is not approved to use the firstName field"), so the
    app never reads names.
  - Order webhooks need approval, so loyalty polls the Admin API.
- Theme budget: 29 of 30 blocks, about 92 KB of 100 KB Liquid (both limits are enforced by Shopify). New storefront
  features go into existing blocks and embeds. Each storefront JS file must stay under 10 KB gzipped.

## Open work, in order

1. **Loyalty part 5, referrals and affiliate links: draft PR #260.** The tables are done; the full design is in the
   PR description (config, discounts, fraud checks, proxy, widget, admin page, tests). Finish it, run the checks,
   deploy (it changes `extensions/`), merge, then check the Referrals page on Testing 3.
2. **Loyalty parts 6 to 10** (`docs/plans/loyalty.md`, status table rows 7 to 11):
   - **Emails**: Postmark (Platform plan) behind a small provider interface, so Resend can replace it.
     - Default sender: "Store name <rewards@mail.crotoolbox.com>", with Reply-To the store's email.
     - **The store's own sender**, the way Essent does it: the merchant types an address, the app shows 3 DNS
       records (ownership TXT, DKIM TXT, Return-Path CNAME) from Postmark's domain API, and a **Verify** button.
       If the domain stops verifying, emails fall back to the default sender.
     - One-click unsubscribe, bounces, a log, a test send, and fair use of 10,000 a month per store.
     - Reminder emails go only to members subscribed to email marketing.
     - Omar confirmed this approach after asking "are you sure that we should use our email ... not the stores
       email like how does the app i sent you sends their emails".
   - **Integrations**: Klaviyo, Omnisend, Judge.me (review points), Shopify Flow trigger and action.
   - **Extensions**: customer account UI extension, points on the thank you and order status pages, Plus checkout
     redeem (Omar: "include the shopify plus features"), POS UI extension.
   - Loyalty analytics, CSV import and export, languages.
   - Website and docs: remove "loyalty" from `SITE_HIDDEN`, add the feature page, help, privacy (Postmark, Klaviyo,
     Omnisend) and the pricing highlight.
3. **Pre-final audit leftovers** (Omar's audit list; the other items are done):
   - **Analytics rebuild with A/B test results.** Omar approved the suggestion: tests are still created on the
     Offers page, and their results are added to Analytics.
   - **Cart Discount code** box.
   - **Branding lines and store credit incentives** on the Track and Returns pages.
4. **Listing images**: Omar said "leave the listing images to be decided just create all the listing images and we
   will choose after that". Make every candidate in the approved style (`branding/listing/README.md`; the
   screenshots must include the Track and Returns pages, see `docs/WORKBOARD.md` "Later"). Omar picks.
5. **Final App Store audit** (skill `shopify-app-store-audit`, plus Shopify's AI self-review page), then the single
   Partner Dashboard update with Omar.

## Omar's steps (together, at the end, unless he says otherwise)

- Partner Dashboard, once:
  - new prices on all plans, monthly and yearly;
  - protected customer data: add Name and birthday, the loyalty purpose, and Postmark, Klaviyo and Omnisend as
    processors;
  - network access for the checkout and customer account extensions (then put `network_access = true` back in
    `extensions/cro-loyalty-checkout/shopify.extension.toml` and deploy: it turns on spending points in Plus checkout);
  - listing text with the AOV and LTV lines (`docs/listing.md`), the Loyalty category, and the chosen listing images.
- Shopify App Pricing usage meters (part of the single Partner Dashboard update): on Growth and Pro, monthly, add
  meters with the handles `live-shipments` ($0.04 each), `loyalty-orders` ($0.05 each) and `loyalty-emails` ($0.002
  each). Then make an API key in the Dev Dashboard for the App Events API and type it into Render as
  `APP_EVENTS_CLIENT_ID` and `APP_EVENTS_CLIENT_SECRET` himself. Until then extra units are kept and not billed.
- Postmark: sign up (with postmark@crotoolbox.com), add the DNS records for `mail.crotoolbox.com` in Cloudflare, and type two tokens into Render
  himself: `POSTMARK_SERVER_TOKEN` (the server's API token, sends emails) and `POSTMARK_ACCOUNT_TOKEN` (the account
  API token, adds merchants' own sender domains). The bounce webhook is made by the app on its own.
- Testing 3: sign in as a customer and place one test order himself, to check loyalty end to end.
- Test Connect Claude end to end (claude.ai → Settings → Connectors → `https://cro-toolbox.onrender.com/mcp`).

## Testing

- **Testing 3**: `testing-3-xsslpo6d.myshopify.com`. Always use store URLs
  `admin.shopify.com/store/testing-3-xsslpo6d/apps/the-ultimate-cro-app/app/...`.
- Loyalty needs Pro. Switching plans on test stores without asking is approved:
  `.../charges/the-ultimate-cro-app/plans/<free|starter|growth|pro>?interval=EVERY_30_DAYS|ANNUAL`. The plan costs $0
  on dev stores.
- The storefront password is typed by Omar himself. Never type passwords or secrets, and never print `.env`.
- Test orders: Draft orders → customer Ayumu Hirano → product → Collect payment → Mark as paid. Orders #1001 to
  #1006 are used up. #1006 has UPS test tracking and shows Delivered through 17TRACK.
- Never modify the live store `ms6vwv-3n` (Backrooms). Never run `shopify app dev clean`.

## Talking to Omar

- Short messages, often screenshots. Explain plainly, say exactly what to click, one step at a time.
- He likes you to do things yourself and to test in the browser before reporting.
- Ask questions as **plain text**, never with answer buttons or AskUserQuestion boxes.
- UI text: no dashes, never first person (the app's own words; storefront defaults in the store's or the shopper's
  voice, like "We'll email you" or "Find my order", stay as they are: Omar, 2026-10-24).
