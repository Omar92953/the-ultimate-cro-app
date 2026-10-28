# Handoff — CRO Toolbox (Shopify app)

Written 2026-10-13 for a new Claude Code account taking over from the previous sessions. Read this
first, then `AGENTS.md`, `docs/billing.md`, `docs/hosting.md`, `docs/scopes.md`, `docs/listing.md`.

## Current state and next steps (updated 2026-10-15)
- **Start with `docs/PROJECT-GUIDE.md`**: the complete, current guide (code map, shipping, rules,
  testing, status, website plan). Where it and this file disagree, the guide wins.
- Live Shopify version is now **cro-toolbox-15**; Phase 6 testing is under way (guide §10).

### Earlier notes (2026-10-14)
- **Active work: the bundles overhaul.** Full plan, approved by Omar: `docs/plans/bundles-overhaul.md`.
  It has a Progress checklist; resume at the first unticked phase and tick it in the same PR that
  finishes it. Phases: 0 plan in repo · 1 orders limit + hidden-settings fix · 2 engine · 3 app creates
  products and pages · 4 Bundles list + recipes · 5 editors as sections · 6 release + end-to-end test.
- **Test store is now Testing2** (`testing2-j6mmnywm.myshopify.com`). The old dev store
  `testing-store-2v65holh` can't save several app settings any more (hidden leftovers after a
  dev-preview clean block the fixed storage names `main`/`settings`); don't use it.
- **Never run `shopify app dev clean`** (it deletes the app's storage types on the store; only a
  reinstall brings them back). Ship to Render through PRs instead of `shopify app dev`.
- Branches: one `claude/<topic>` branch per change, PR, merge (Omar asked for this flow and is fine
  with merges once checks pass). Live Shopify version: `cro-toolbox-7`
  (rollback: `shopify app release --version=<previous>`).
- Omar's style rules for the app UI: no dashes in any visible text; `LinkTiles` instead of rows of
  links; `OptionalSetting` (a switch that reveals the setting) instead of "0 = off"; Design tabs sit
  apart on the right of a feature's tabs.

## Who and what
- Owner: **Omar** (GitHub `Omar92953`). Writes short messages, often with screenshots. Explain steps
  plainly, one command at a time, and say what to click.
- App: **CRO Toolbox** — one Shopify app with offers & bundles, storefront widgets/sections, cart
  drawer, checkout rules, analytics. Shopify React Router app, Polaris web components, Prisma,
  Admin GraphQL `2026-07`, Shopify Functions, theme app extension.
- Partner org: **OMC**. App id in metaobject types: `app--427692097537--…`.

## Where everything lives
| Thing | Location |
|---|---|
| Repo | https://github.com/Omar92953/the-ultimate-cro-app (default branch `main`) |
| Working branch | a new `claude/<topic>` branch per change (PRs from there; never push to `main` directly) |
| Omar's local clone (Mac) | `/Users/omarmoaz/Workspace/Coiding/Shopify apps/Cro Toolbox/cro-toolbox` (i.e. `/Users/omarmoaz/Workspace/Coiding/Shopify apps/Cro Toolbox/cro-toolbox`) |
| App server | Render web service **cro-toolbox**, https://cro-toolbox.onrender.com (Virginia, Starter plan). Auto-deploys when `main` changes. |
| Database | Supabase project **cro-toolbox** (id `mjrarywblutwmtakdkze`, us-east-1). Old project `ultimate-profit-tracker` is paused. Session pooler URL is in Render env (`DATABASE_URL`, `DIRECT_URL`). |
| Dev store (all testing) | **Testing2** `testing2-j6mmnywm.myshopify.com` (the old `testing-store-2v65holh` is broken for the app, see above) |
| Omar's LIVE store | `ms6vwv-3n.myshopify.com` (Backrooms) — **never touch it or its themes** |

## Hard rules (from Omar)
- Never modify or delete anything on the live store `ms6vwv-3n` or its themes. Test only on the dev store.
- **Ask first** before: `shopify app deploy`, choosing a distribution method in the Partner Dashboard
  (permanent), and creating anything that costs money.
- Never enter passwords/credentials, never print `.env` or secrets. (A database password was once pasted
  in chat — Omar should rotate it in Supabase and update Render if not done.)
- Work on a branch + PR; merge only when Omar says (e.g. after he says "deployed").
- Commit trailer: `Co-Authored-By: Claude …` + session link line; no model IDs in commits/PRs.
- Prices and limits only in `app/lib/plans.ts`; tutorials only in `app/lib/tutorials.ts`;
  feature registry only in `app/lib/catalog.ts`. Use `components/fields.tsx` wrappers, `gql()`, `remember()`.
- Theme extension is at **30/30 blocks** (new storefront features must live in existing embeds);
  Liquid ~85/100 KB. Theme sources in `theme/`, built by `npm run build:theme` into `extensions/cro-storefront`.

## How a release works
1. Cloud sessions can't run `shopify app deploy` (network blocks Shopify hosts + javy download).
   Omar runs on the Mac, one line so it stops if tests fail:
   ```
   cd /Users/omarmoaz/Workspace/Coiding/Shopify apps/Cro Toolbox/cro-toolbox
   git checkout claude/admiring-hypatia-x38z5c && git pull && npm run test:functions && npm run graphql-codegen && shopify app deploy
   ```
   He answers **y** to "Release a new version". (Don't run `shopify app dev clean` on the dev store.)
2. Then merge the PR → Render redeploys the app pages.
3. Omar opens the app on the dev store and approves any new permission.

Checks to run in the cloud before pushing: `npx tsc --noEmit`, `npm run lint`, `npm run test:app`,
`npm run build` (check exit code + "built in"), `npm run test:storefront`. Function integration tests
only run on the Mac.

## What's done (merged in PR #1–#5)
- Plans/billing via Shopify App Pricing (reads plan only; never charges). Prices: Free / Starter $5.99 /
  Growth $19.99 / Pro $39.99 (yearly $59/$199/$399), 14-day trial. Free = 3 offer slots shared by every
  offer type, 3 checkout rules, 1 countdown, 2 thank-you modules, try 1 Starter feature free. Each plan
  gets a taste of the next. "Cancel or change your plan anytime" on paid plans.
- Bundles matching Simple Bundles: bundle products (native fixed bundles, stock from items), price tiers,
  option pricing, auto compare-at (`products/update` webhook), per-bundle analytics. Scope `write_products`.
- Reorganisation: menu (since G5) Home · Offers · Tracking & Returns · Section library · Cart & Checkout · Analytics · Settings; hubs;
  new Home (setup guide, metrics, attention list); Analytics tabs; Plans page with pricing cards in
  Omar's reference style (bold "Features", ✓ per line); Cart "Which cart?" choice; Settings (embeds,
  discounts, plan & referral, help); Shopify save bar on all 36 editors; "Style 1–5" naming.
- Deployed: Omar ran `shopify app deploy` (all tests passed) and PR #5 was merged.

## Open right now (outside the code)
- Partner Dashboard (Omar, permanent): choose Public distribution and request protected customer data
  (orders) access; until approved, Shopify returns no order details (Analytics, sales pop-ups).
- Partner Dashboard: create the 4 App Pricing plans with handles `free`, `starter`, `growth`, `pro`
  at the prices in `app/lib/plans.ts` (steps in `docs/billing.md`).
- Render env: `SCOPES` must equal the TOML list; add `SHOPIFY_PARTNER_ORG_ID`,
  `SHOPIFY_PARTNER_API_TOKEN`, `SHOPIFY_APP_GID` (plan confirmation), `SUPPORT_EMAIL`.
- Listing: screenshots and video on Testing2; tutorial videos (Home shows "Coming soon" until then).

## Ideas queued (not started)
Competitor features we lack: product labels/badges, A/B test per offer, scheduling and targeting per
widget, shipping protection / gift wrap add-ons, size chart, recently viewed, pop-up/email capture,
translations, loyalty/referrals, review-request emails. Omar picks; each must fit existing embeds.
Side asks still open: competitor revenue estimate table (not public; estimate only).
