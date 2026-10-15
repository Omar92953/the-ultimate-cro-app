# CRO Toolbox: project guide

> Several Claude accounts work on this repo at once: read `docs/TEAM.md` first.

Everything a new Claude Code account (or developer) needs to work on the app and on its marketing
website. Start with `CLAUDE.md` (short rules and current status), then this file. Updated 2026-10-15.

## 1. What the app is

**CRO Toolbox** is a public Shopify app (Partner org **OMC**, owner **Omar**, GitHub `Omar92953`)
that raises a store's sales: offers and bundles, storefront widgets and sections, a cart drawer,
checkout rules and analytics. It replaces three features of Omar's Backrooms theme (upsell,
cross-sell, video carousel) and rebuilds his earlier bundle-builder app.

Admin menu: **Home · Offers · Storefront · Cart · Checkout · Analytics · Settings**.

| Area | Features (registry: `app/lib/catalog.ts`) |
|---|---|
| Offers | Upsell (quantity tiers), Cross-sell, **Bundles** (6 recipes, see §6), Discounts (buy X get Y, volume, gift, upgrade), Add-ons, Personalization |
| Storefront | Reviews, product page reviews, sales pop-ups, trust badges, logos, announcement bar, countdown timers, stock urgency, sticky add to cart, hero, image and video carousels, FAQ, quiz, header, footer, collection pills, quick add, wishlist, contact, delivery estimate, shipping bar |
| Cart | App cart drawer, offers in the theme's cart, gift note and delivery date |
| Checkout | Payment and delivery customizations, cart validation, thank-you and order-status modules, post-purchase offer |
| Analytics | Sales from the app, per offer and per bundle stats |

Plans (only in `app/lib/plans.ts`): **Free** (3 offer slots, 50 orders a month), **Starter**
$5.99 (500 orders), **Growth** $14.99 (1,000), **Pro** $24.99 (unlimited); yearly $59/$149/$249;
14-day trial. The orders limit counts all store orders in the calendar month and is soft (a banner,
nothing switches off). Every bundle feature is Free within the offer slots. Billing runs through
Shopify App Pricing; the app only reads the plan (`app/lib/billing.server.ts`, `docs/billing.md`).

## 2. Where everything lives

| Thing | Location |
|---|---|
| Repo | https://github.com/Omar92953/the-ultimate-cro-app (default branch `main`) |
| Omar's clone | `~/Workspace/the-ultimate-cro-app` on his Mac |
| App server | Render web service **cro-toolbox**, https://cro-toolbox.onrender.com. Serves the admin pages that load inside Shopify admin, OAuth and webhooks. Not a public website. Auto-deploys on every merge to `main`. Env is managed by `render.yaml` (Blueprint). |
| Database | Supabase project **cro-toolbox** (Postgres, sessions only via Prisma) |
| Merchant data | The merchant's own store: `$app:*` metaobjects and metafields (no app database for settings) |
| Shopify app | App handle `the-ultimate-cro-app`, client id in `shopify.app.toml`. Live version: **cro-toolbox-18** |
| Test store | **Testing2** `testing2-j6mmnywm.myshopify.com` (dev store, password protected storefront, theme `test-data`) |
| Live store | `ms6vwv-3n.myshopify.com` (Backrooms). **Never touch it or its themes.** |

## 3. How it fits together

```
Admin (embedded, React Router + Polaris web components)     Storefront (any Online Store 2.0 theme)
app/routes/app.*.tsx ── saves ──▶ $app metaobjects ── Liquid reads ──▶ extensions/cro-storefront
                                     │                                  (theme app extension:
                                     │                                   30 blocks and embeds)
                                     ├─▶ discount metafield ──▶ extensions/cro-discount   (Discount Function)
                                     ├─▶ bundle metafield   ──▶ extensions/cro-bundles    (Cart Transform)
                                     └─▶ other configs      ──▶ cro-payment, cro-delivery, cro-validation,
                                                                cro-thank-you, cro-post-purchase
```

- `shopify.app.toml`: scopes, webhooks (incl. the 3 privacy topics) and every `$app` metaobject
  definition. Changing it needs a Shopify deploy.
- Storefront code is **not** edited in `extensions/cro-storefront/blocks` directly: Liquid sources live
  in `theme/blocks` and `theme/snippets` and `npm run build:theme` copies them. JS and CSS assets live
  in `extensions/cro-storefront/assets` directly.
- The storefront never calls our server: everything it needs is in metaobjects/metafields written by
  the admin on save.

## 4. Code map

| Path | What |
|---|---|
| `app/routes/app.*.tsx` | Admin pages (81 routes). Editors: `app.bundles.$handle.tsx` (mix & match), `app.kits.$id.tsx` (kit), `app.deals.$kind.$handle.tsx` (fixed bundle and deals), `app.offers.$kind.$handle.tsx` (upsell, cross-sell), `app.sections.$kind.$handle.tsx`, `app.designs.*` (looks) |
| `app/routes/webhooks.*.tsx` | Webhooks (products/update re-prices kits and refreshes bundles, privacy topics) |
| `app/lib/cro.server.ts` | Most reads and writes, syncing Function configs (`syncDiscounts`, `syncBundles`), theme status, theme editor links |
| `app/lib/admin.server.ts` | `gql()` (Admin GraphQL with errors as `AdminError`), `remember()` (short cache, cleared by any non-GET) |
| `app/lib/plans.ts`, `billing.server.ts` | Plans, limits, `checkLimit`, monthly orders |
| `app/lib/catalog.ts` | Feature registry: menu, tabs, breadcrumbs, plan gates |
| `app/lib/kits*.ts` | Kits (Shopify native bundle products via `productBundleCreate`) |
| `app/lib/bundle-*.ts` | Mix & match: pricing math (`bundle-price.ts`, mirrors checkout), design, recipes, preview data, product and page creation (`bundle-product.server.ts`) |
| `app/lib/deals*.ts` | Discounts and the Frequently bought together box design (`FbtDesign`) |
| `app/lib/validate.ts` | Validation shared by UI and server |
| `app/components/fields.tsx` | **Always** use these wrappers for Polaris web components (see §8) |
| `app/components/EditorLayout.tsx`, `EditorSection.tsx` | Editor layout: numbered collapsible steps on the left, sticky preview on the right |
| `app/components/*Preview.tsx` | Live previews that reuse the storefront CSS |
| `theme/blocks`, `theme/snippets` | Liquid sources of the theme app extension |
| `extensions/cro-storefront/assets` | Storefront JS/CSS: `ucro-bundle.js` (builder), `ucro-bundle-tray.js`, `ucro-core.js`, `ucs-deals.js` (deal boxes), `ucs-boosters.css`, `ucro.css` |
| `extensions/cro-bundles` | Cart Transform: merges bundle picks into one line at the bundle price |
| `extensions/cro-discount` | Discount Function: offers and deals, skips bundle lines |
| `test/app` | Node unit tests; `test/storefront` renders the blocks with mock data (`engine.mjs`: the Liquid engine shared with `demos/`) |
| `site/` | The marketing website (Astro), crotoolbox.com. Content in `site/src/lib/`: `features.ts` (feature pages), `usecases.ts`, `competitors.ts` (comparisons, with sources), `pages.ts` (titles), `brand.ts` (the shared one line description); articles and help guides are Markdown in `site/src/content/blog` and `site/src/content/help`; `.github/workflows/indexnow.yml` tells Bing about new pages; screenshots in `site/src/assets` (from `npm --prefix demos run screenshots`). Brief: `docs/prompts/build-website.md`; how to run and deploy: `docs/website.md` |
| `demos/` | The hidden live demos (demo.crotoolbox.com, noindex, opened only from the app): renders every feature's real blocks with demo data. `docs/website.md` |
| `app/lib/site.ts` | Website and demo addresses: `SITE_URL`, `DEMO_URL`, `demoUrl()`, `DEMOS` (the demo build checks it) |
| `scripts/sync.sh` | Brings the Mac copy up to date with GitHub and reports differences |
| `docs/` | `README-merchant.md` (merchant guide), `testing-checklist.md`, `billing.md`, `hosting.md`, `scopes.md`, `listing.md`, `plans/bundles-overhaul.md`, `HANDOFF.md` |

## 5. Commands and checks

Run from the repo root. Before every PR run the checks that apply:

| Command | When |
|---|---|
| `npx tsc --noEmit` | always |
| `npm run lint` | always |
| `npm run test:app` | always |
| `npm run build` | always |
| `npm run graphql-codegen` | when you add or change a GraphQL operation (validates against the schema) |
| `npm run build:theme` | when `theme/` changed (prints blocks used, Liquid KB; limit 100 KB, build warns at 92) |
| `npm run test:storefront` | when storefront JS/CSS/Liquid changed; then serve `test/storefront/out` and look at the pages |
| `npm run test:functions` | when a Function changed (needs the Shopify CLI and javy: works on Omar's Mac, not in cloud sessions) |

Viewing the storefront harness: `python3 -m http.server -d test/storefront/out 8123`, then open
`http://localhost:8123/sections/deals.html` etc. (`.claude/launch.json` has a `harness` entry).

Prefix Shopify CLI commands with `NODE_OPTIONS=--dns-result-order=ipv4first` on Omar's Mac.
Read store data: `shopify app execute -s testing2-j6mmnywm.myshopify.com -q '{ ... }' --output-file "$TMPDIR/x.json"`.

## 6. Bundles (the biggest feature)

Plan and decisions: `docs/plans/bundles-overhaul.md` (Phases 0 to 5 done, Phase 6 testing in progress).
**Bundles → Create bundle** offers 6 recipes (`app/lib/bundle-recipes.ts`):

| # | Recipe | Built with | Shows | Notes |
|---|---|---|---|---|
| 1 | Frequently bought together | deal `fixed` | each item's product page via the Conversion boosters embed | Box look: layout (pictures in a row with + / list), pictures Left/Centered/Right, boxes around pictures, border, heading, button with `[count]` `[price]`, saving style. Default: row, centered, no boxes, no border, "Buy all [count]: [price]" |
| 2 | Kit sold as one product | `productBundleCreate` | its own product page, one cart line | App creates, publishes, adds picture and "What's inside", tags `cro-bundle` |
| 3 | Mix & match box | mix & match bundle | the bundle product's page | App creates the bundle product (untracked stock, tag `cro-bundle`); "Add to theme" deep link adds the Bundle builder block |
| 4 | Build your bundle, save more | mix & match, growing tiers (% / amount / price by item count) | product page or its own store page (`/pages/...`, created by the app) | Highest tier with `minItems <= count` applies |
| 5 | Build while browsing | mix & match, store wide | collection pages (+ Add to bundle), bundle tray embed | Picks shared between tray and builder (localStorage `ucro-bundle-tray`) |
| 6 | Any N for one price | mix & match | product page | Builder loads whole collections (load more + search) |

Rules that keep checkout correct:
- `ucro-bundle.js` (writes `_bundle_components`) and `extensions/cro-bundles/src/cart_transform_run.js`
  (validates and merges) must agree on the format and the pricing kinds (`f`, `p`, `t`, `pt`, `at`).
  `app/lib/bundle-price.ts` and `ucro-core.js bundlePrice()` mirror the same math.
- Bundle products are tagged `cro-bundle`; the builder, tray and Add to bundle block never offer them
  as picks. The discount Function skips bundle lines (ids passed in its config).
- Shopify silently drops Function metafields over 10,000 bytes; `cro.server.ts` keeps them under 9,500.

## 7. Shipping a change (Omar asked for this flow)

1. Branch `claude/<topic>` from `main`.
2. Make the change; run the checks in §5.
3. Commit with the trailer the session gives you; push; `gh pr create`.
4. **If `extensions/`, `theme/` or `shopify.app.toml` changed**: run
   `NODE_OPTIONS=--dns-result-order=ipv4first shopify app deploy --allow-updates --message "..."`
   before merging (Omar has said "do it yourself" for deploys; the Claude Code safety check may still
   ask him once). Rollback: `shopify app release --version=cro-toolbox-<previous>`.
5. `gh pr merge --merge`, `git checkout main && git pull`.
6. Render redeploys in a few minutes. Wait for it:
   `gh api repos/Omar92953/the-ultimate-cro-app/deployments` (newest sha = HEAD) and its
   `/statuses` = `success`.
7. Check on Testing2 (§9).

Cloud accounts can't reach Shopify hosts: write the code and PR, and ask Omar to run on his Mac:
`cd ~/Workspace/the-ultimate-cro-app && git pull && npm run test:functions && shopify app deploy --allow-updates`.

## 8. House rules

- **Never** touch the live store `ms6vwv-3n` or its themes. Test only on Testing2.
- **Never** run `shopify app dev clean` (it deleted the app's storage types on the old dev store).
- Ask Omar before anything that costs money or is permanent in the Partner Dashboard (distribution
  method, paid plans).
- Never type passwords or secrets anywhere (including the storefront password), never print `.env`.
- UI text: **no dashes** ("-", "--", "—") in anything a merchant sees. Plain, short words.
- UI patterns: `LinkTiles` instead of rows of links; `OptionalSetting` (switch that reveals the
  setting) instead of "0 = off"; `SaveControls` on every editor; editors use `EditorLayout` +
  `EditorSection`; **never** `slot="aside"` on a `large` page (Polaris hides it).
- React 18 + Polaris web components: use `app/components/fields.tsx` (`TextField`, `Select`,
  `Checkbox`, `Switch`, `NumberField`, `Button` with `onValue`), never raw `onChange` or boolean props
  on `s-*` elements. `Segmented` (in `components/ui.tsx`) for small choices.
- Prices and limits only in `plans.ts`; features only in `catalog.ts`; tutorials only in `tutorials.ts`.
- Use `gql()` and `remember()`; new GraphQL must pass `npm run graphql-codegen`.
- Theme extension: **30 of 30 blocks used**. New storefront features go into existing blocks or embeds.
  Liquid budget about 86 of 100 KB.
- Don't run Prettier over the repo (it reformats hundreds of files).
- Match the surrounding code's style and comment density.

## 9. Testing on Testing2

- Open the app: `https://admin.shopify.com/store/testing2-j6mmnywm/apps/the-ultimate-cro-app/app`.
- The storefront is password protected and Claude must not type passwords. See real pages through the
  theme editor instead:
  `https://admin.shopify.com/store/testing2-j6mmnywm/themes/167611826339/editor?previewPath=/products/<handle>`.
  For cart and checkout tests, Omar unlocks the storefront himself.
- Testing2 is on the **Free plan** (3 offer slots). Switch off tested offers to free a slot, or ask
  Omar to pick a plan for the store.
- Full manual checklist: `docs/testing-checklist.md`. Bundles verification: end of
  `docs/plans/bundles-overhaul.md`.

## 10. Status (2026-10-15)

Done and live (cro-toolbox-18): bundles overhaul Phases 0 to 5, Frequently bought together box
designs, deal box redesign, fixes found while testing (kit options, refused saves wiping editors,
bundle products offered as picks).

Phase 6 testing on Testing2:
- [x] Recipe 1 Frequently bought together: editor, preview, box on the real product page
- [x] Recipe 2 Kit: created, Active, published, picture, contents, prices; real product page
- [x] Recipe 3 Mix & match: product created and published; Add to theme adds the block; picks merge into
      one cart line at the bundle price (`has_components`); checkout shows 1 item at $1,500; the theme's
      Add to cart adds nothing until the bundle is complete
- [x] Recipe 4 growing discount on its own store page: app creates the hidden product and the page; the
      page link adds the block to the page template; 1 pick no discount, 2 picks 10%, 3 picks 15%,
      "Add 1 more to save" hints; cart matches to the cent
- [x] Recipe 5 build while browsing: tray embed turned on with the app's link; "+ Add to bundle" on the step's
      collection page (not on bundle products); tray 1 pick no discount, 2 picks 10%, 3 picks 15%; picks show on the
      bundle's store page; one cart line at $1,925.97; checkout 1 item, same price, no stacking (cro-toolbox-18)
- [x] Recipe 6 long collection, one price: 60 product test collection "Bundle test 60" (tag bundle-test);
      builder shows 50, Show more loads the rest and hides itself, search finds items on page 2; 3 picks $207 worth
      for $30; one cart line at $30; checkout 1 item $30. Fix: the bundle product starts at the lowest bundle price
      instead of $0.00
- [x] Checkout: one bundle line at the bundle price; no discount stacking (cart with the "Pick any 3" bundle,
      2 x Test item 01 and 2 x the kit, upsell "Buy more, save more" active on all products: only item 01 gets 10%;
      bundle stays $30, kit gets no upsell; checkout $1,446.82 before, $1,444.62 after)

Known gaps: the theme editor ignores `previewPath` with `addAppBlockId` (the page link opens another page, the block still lands on the page template); the Add to theme link appends the builder below the theme's Add to cart button (merchant
can drag it); a bare bundle product can still be bought alone through quick add buttons on collection
cards; checkout doesn't reject a bundle product picked inside a bundle (the storefront prevents it).

Open with Omar (outside the code): protected customer data request and App Pricing plans in the
Partner Dashboard, listing screenshots and video, tutorial videos (Home shows "Coming soon").

## 11. The marketing website and the live demos

Omar wants a website for SEO and GEO (being cited by AI assistants) that explains the app, shows the
features and sends people to the App Store listing.

- **The full brief is `docs/prompts/build-website.md`** (pages modeled on section.store and
  simplebundles.com, articles, SEO/GEO, the hidden live demos and the app's "See live demo" buttons).
  Running, building and deploying both: **`docs/website.md`**.
- The website lives in `site/` (Astro, static), separate from the app build. Not on
  `cro-toolbox.onrender.com` (that host is the app server).
- **Live demos** (decided 2026-10-15): a separate static build in `demos/`, deployed to
  **demo.crotoolbox.com** and hidden from search (noindex everywhere, robots.txt `Disallow: /`, no
  list of demos, `/` redirects to the website). They reuse the real storefront code (`theme/`,
  `extensions/cro-storefront/assets`, `test/storefront/engine.mjs`) and open only from the app's
  "See live demo" buttons (`demoUrl()` in `app/lib/site.ts`). The website never links to them.
- **Pages**: home; one page per feature (the 6 bundle recipes, upsell, cross-sell, video carousel,
  cart drawer, reviews, countdown...) with real screenshots from Testing2; pricing (from
  `app/lib/plans.ts`: Free / $5.99 / $14.99 / $24.99, orders per month, 14-day trial); help center
  (adapt `docs/README-merchant.md`); comparisons ("CRO Toolbox vs Bundler / Rebuy"); FAQ; blog with
  how-to articles ("How to add Frequently bought together in Dawn", "Mix and match bundles on
  Shopify"); privacy policy and support page (needed for the App Store listing, see `docs/listing.md`).
- **SEO**: one topic per page, clear titles and meta descriptions, fast static pages, sitemap,
  schema.org `SoftwareApplication`, `FAQPage` and `Article` markup, internal links.
- **GEO**: plain factual statements (exact prices, limits, what each feature does, which themes),
  question headings with direct answers, an `llms.txt`, consistent naming "CRO Toolbox".
- **Decided (2026-10-15)**: hosting on **Cloudflare Pages (free plan, upgrade at launch if needed)**,
  domain **crotoolbox.com** from Cloudflare Registrar (about $10.46 a year; Omar buys it).
- **Visibility plan** (how to get mentioned by AI assistants and found on Google and Bing): see
  "Visibility plan" in `docs/prompts/build-website.md`. Short version: register the site in Google
  Search Console and Bing Webmaster Tools (ChatGPT searches with Bing), one shared description
  everywhere, 1 or 2 real articles a week, honest comparison pages, App Store reviews, and mentions on
  other sites ("best bundle apps" lists, Reddit and Shopify Community answers, YouTube, Product Hunt,
  G2/Capterra).
- **Calls to action**: "Install on Shopify" buttons to the App Store listing with UTM tags
  (`?utm_source=site&utm_medium=<page>`), so installs per page can be measured. Until the listing is
  live, link to a "Coming soon" or waitlist form.
- **Truthfulness**: only claim features that exist in the app; no invented reviews, numbers or logos.
- Keep UI text rules: no dashes, short plain sentences.
