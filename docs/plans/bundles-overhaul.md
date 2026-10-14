# CRO Toolbox: the bundles overhaul + order-based plans

> **Portable plan.** Written so any Claude Code account (cloud or desktop) can execute it from the
> repo alone. Phase 0 copies this file into the repo as `docs/plans/bundles-overhaul.md` and updates
> `docs/HANDOFF.md`, so it travels with the code. Execute phases in order; each phase is one PR
> (branch `claude/<phase-name>` → checks → PR → merge). Tick the checkboxes in the repo copy as
> phases land, so the next account knows where to resume.

## Context
Omar (GitHub `Omar92953`) wants CRO Toolbox to be a complete bundles app: every bundle a merchant
asks for must be possible from the app, as automatic as possible (the app creates and publishes the
products itself), with in-app guidance for anything that has to happen in the theme editor. Today
the bundle types exist but are split across 3 tabs, need manual setup (create the bundle product by
hand, set its price, untick inventory, publish it, place the block), mix & match shows only the
first 50 products of a collection, there's no growing discount, and the editors are one long block.
A code audit (2026-10-14) also found live bugs (hidden editor settings, discounts stacking on
bundles). He also reversed the plan limit: plans are limited by **orders per month** again.

### Decisions made with Omar (2026-10-14)
- Fixed bundle sold as one product (e.g. "Camera kit"): cart shows **one bundle line** (Shopify native bundle; components' stock goes down). = today's "Bundle products" (kits).
- Growing discount for build-your-bundle: **% off by item count**, **amount off by item count**, and **fixed price by item count** (exists as "tiers").
- Builder location: **both** a bundle product page and a standalone store page (`/pages/...`), chosen per bundle.
- Editor layout: **numbered collapsible sections on the left + sticky live preview on the right**.
- Bundles section: **one list of all bundles + "Create bundle" chooser with 6 recipes**; tabs Bundles · Design.
- Plan gating: every bundle feature **Free within the offer slots** (no new plan locks).
- Plan limit: **all store orders per calendar month**: Free 50 · Starter 500 · Growth 1,000 · Pro unlimited (soft: banner only, nothing switches off).
- New scopes: **`write_online_store_pages`** (app creates the builder page) and **`write_publications`** (app publishes the bundle products it creates).

## The 6 bundle recipes (what merchants can build, and how)
| # | Merchant wants | Built with | Where it shows | App does automatically | Merchant does |
|---|---|---|---|---|---|
| 1 | "Frequently bought together" box | Fixed bundle (deal `fixed`) | Each item's product page, via the Conversion boosters embed | Box + discount at checkout | Turn on the embed once (setup guide step 1) |
| 2 | A kit sold as one product ("Camera kit") | Bundle product (kit, `productBundleCreate`) | Its own product page; cart shows 1 line | Creates **and publishes** the product, sets image, price, compare-at | Nothing (optional: edit photos/description in Shopify) |
| 3 | Mix & match on a bundle product page (image + price), picking from a collection | Mix & match, "bundle product page" | The bundle product's page | Creates **and publishes** the bundle product (title, image, price, no inventory tracking) | Click "Add to theme" once (opens the theme editor with the block added) |
| 4 | Build your box with a growing discount (2 = 10%, 3 = 15%…) | Mix & match + new pricing (% / amount / price by item count) | A bundle product page **or** its own store page | Creates the product (hidden parent for checkout) and, for a store page, **creates the page** | Click "Add to theme" once |
| 5 | Build while browsing a long collection | Mix & match + "Build it anywhere" (bundle tray) | Collection pages (+ Add to bundle on every card, theme filters) and product pages | Everything except turning on the tray embed | Turn on the "Bundle tray" embed once |
| 6 | Any N from a long collection for one price, on a product page with image | Mix & match, "price by item count" or "one price", builder with **load more + search** | The bundle product's page | Creates/publishes the product; builder pages through the whole collection | Click "Add to theme" once |

## Progress
- [x] Phase 0: plan in the repo
- [x] Phase 1: orders limit + hidden-settings fix
- [ ] Phase 2: engine (growing discounts, store pages, long collections, bundle bugs)
- [ ] Phase 3: the app creates products and pages
- [ ] Phase 4: Bundles list + Create bundle recipes
- [ ] Phase 5: editors as sections + live preview
- [ ] Phase 6: release and end-to-end test of recipes 1 to 6

## Phase 0: make the plan portable
- Copy this plan to `docs/plans/bundles-overhaul.md`; add a "Current state / next steps" section to `docs/HANDOFF.md` pointing to it (and to "Handoff essentials" below). Branch `claude/bundles-plan`, PR, merge.

## Phase 1: orders limit + the hidden-settings bug (ship first)
**Orders limit**
- `app/lib/plans.ts`: `Limits.monthlyRevenue` → `monthlyOrders` (Free 50, Starter 500, Growth 1000, Pro null); `revenueLine` → `ordersLine` ("Up to **500** orders monthly" / "Unlimited orders monthly"); `revenueOver` → `ordersOver(plan, count)`; remove `USD_RATE`/`toUsd` (and `usd` if unused); `limitText("monthlyOrders", n)` = "500 orders a month".
- Restore `getMonthlyOrders(admin, shop)` in `app/lib/billing.server.ts` (deleted in commit 4b75dd1; get it with `git show 4b75dd1^:app/lib/billing.server.ts`): `ordersCount(query: "created_at:>='<1st of month UTC>'", limit: 100000)`, remembered 10 min. `ordersCount` works **without** protected-data approval (verified).
- Home (`app/routes/app._index.tsx`): add `getMonthlyOrders` to the "home" batch; `PlanBar` (`app/components/PlanCard.tsx`) shows "42 of 50 orders this month" + meter; banner "You're past your plan's monthly orders" when over (soft). Plans page (`app/routes/app.plans.tsx`): `RevenueLine` → orders line; compare row "Orders a month".
- `test/app/plans.test.ts`: replace revenue tests with orders (`planAbove("monthlyOrders", 800, "starter") === "growth"`, `ordersOver("free", 51)`, line text). Docs: `docs/billing.md`, `docs/listing.md` pricing text.

**Hidden settings (live bug)**: Polaris renders `slot="aside"` only when `s-page inlineSize="base"`; every aside in the app sits on a `large` page, so it never shows. The upsell/cross-sell editor's **Active / Name / Priority** and its preview are invisible today (confirmed in the browser).
- Add a shared two-column layout `EditorLayout` (`app/components/EditorLayout.tsx`, reusing `app/components/PageEditor.module.css` `.layout` grid + sticky `.preview`): main column for sections, right column (sticky) for status, preview and help; stacks on narrow widths.
- Use it in `app/routes/app.offers.$kind.$handle.tsx` (move Status, Preview, "Discount at checkout" into the right column), `app.offers.$kind._index.tsx` ("Which offer is shown?" → a `Card` below the table), `app.sections.$kind.$handle.tsx` (Preview), `app.bundles.$handle.tsx` ("Before you go live"), `app.videos.tsx`. Rule for the future: never `slot="aside"` on a `large` page.

## Phase 2: engine (checkout + storefront)
All in existing files; **no new theme blocks** (extension is at 30/30 blocks; Liquid 85.4/100 KB, build warns at 92 KB).
- **Growing discounts** (Cart Transform `extensions/cro-bundles/src/cart_transform_run.js`): new config kinds `k: "pt"` (% by item count, `pt: [[minItems, percent], …]`) and `k: "at"` (amount by item count, `at: [[minItems, cents], …]`). The highest tier with `minItems <= count` applies (growing, not exact); a group is valid when every step's min/max fits. `percentOff()` returns the tier % (pt) or `cents·rate/total·100` (at, never above 100). Keep `f`, `p`, `t` unchanged.
  - Mirror in `extensions/cro-storefront/assets/ucro-core.js` `bundlePrice()` (same math; `next` = next tier and its saving, for "Add 1 more to save 15%").
  - Server: `buildBundleConfig` in `app/lib/cro.server.ts` writes `pt`/`at` from `price_rules`; `Bundle.pricing` gains `"percent_tiers" | "amount_tiers"` (`app/lib/types.ts`), stored in the existing `pricing` text field and `price_rules` JSON (`{"pt":[[2,10],[3,15]]}` / `{"at":[[2,500]]}`, built by `toPriceRules`); `validate.ts` checks tiers (ascending counts, 1 to 90 %, amounts > 0).
  - Tests: unit tests in `extensions/cro-bundles/tests/validate.test.js` (2 items 10%, 3 items 15%, 1 item no merge, amount tiers, currency rate) + fixtures for tiers and extras (none exist today).
- **Builder on its own store page**: `shopify.app.toml` `cro_bundle` gets a field `page` (`page_reference`). `theme/blocks/ucro-bundle-builder.liquid`: `enabled_on` adds `"page"`; when `product == blank and page != blank`, find the active bundle whose `page.value.handle == page.handle`; take the parent variant and price from `bundle.product.value.selected_or_first_available_variant`. "Use my theme's Add to cart button" is ignored on pages (no product form). Same block: placed once on the page template, it renders only on that page.
- **Long collections**: Liquid renders the first 24 products; `ucro-bundle.js` loads more from `/collections/<handle>/products.json?limit=50&page=n` ("Show more" + infinite scroll), builds the same card markup client-side (variant select, sold-out, picked state, `hideSoldOut`), and a search box filters loaded cards (fetching further pages until it finds matches). Steps get `data-collection-handle`. Checkout already validates collection membership of any size (`inCollections`).
- **Shared picks**: the builder (sessionStorage `ucro-bundle-<id>`) and the tray (localStorage `ucro-bundle-tray`) use one state, so picks made while browsing show on the bundle page and vice versa.
- **Fixed bundle box ("Frequently bought together")**: `ucs-deals.js` reads its look and words from `offers.fbt` (written by the server into `$app:cro_offers` with the deals, so no Liquid change): heading (default "Frequently bought together"), item images on/off, button text, saving style ("Save $12" / "15% off"), colours via the theme scheme. Adding to cart uses `U.add` (opens the theme/app drawer) instead of jumping to `/cart`.
- **Bundle bugs from the audit**:
  - Discounts stack on bundles: `extensions/cro-discount` still skips the old `_bundle_components` attribute. Skip lines whose variant is a mix & match parent variant or a kit variant (ids passed in the discount config by `buildDiscountConfig`); update fixture `bundle-lines-skipped.json`; add deals fixtures (none exist).
  - Stale fixed price: refresh the bundle config (`syncBundles`) in `app/routes/webhooks.products.update.tsx` when a bundle product changes.
  - `listBundles` reads `first: 25` (`cro.server.ts:929`): paginate up to 50 (the storefront's limit).
  - Bare bundle product bought without picks: by default the builder uses theme-button mode (hides the product's own Add to cart and express buttons on bundle pages only); store-page parents are hidden from search (`seo.hidden`). Then check whether `extensions/cro-validation`'s input can tell a merged bundle line (has components) from a bare parent line; if it can, block the bare one at checkout with a clear message, otherwise document the remaining gap (quick-add buttons on collection cards).
  - Kits price only the first 100 variants (`kits.server.ts:58`): paginate.

## Phase 3: the app creates everything it can
- Scopes: add `write_online_store_pages,write_publications` in **three places**: `shopify.app.toml` scopes, `render.yaml` `SCOPES`, and the Render dashboard env (must match). Reasons in `docs/scopes.md`. Stores approve once on next open. Until approved, every create action shows "Approve the new permission" (catch the access error, link to the app's install/grant page) instead of failing.
- `app/lib/bundle-product.server.ts` (new; follow `app/lib/kits.server.ts` patterns: `gql()`, polling, `userErrors` → `AdminError`):
  - `createBundleProduct({ title, image, price, descriptionHtml, hidden })`: `productCreate` (status ACTIVE, tag `cro-bundle`) → variant price with `productVariantsBulkUpdate` (`inventoryItem: { tracked: false }`; if that needs `write_inventory`, use `inventoryPolicy: CONTINUE`; test on Testing2) → image with `stagedUploadsCreate` + `fileCreate` (pattern: `app/lib/sections.server.ts:301-335`) attached via `productUpdate(media:)` / `productCreateMedia` → `publishablePublish` to the Online Store publication (find it with `publications(first: 20)`). `hidden: true` (store-page builders) also sets the `seo.hidden = 1` metafield so the parent product stays out of search.
  - `updateBundleProduct` keeps title, image and price in sync when the bundle is saved.
- Mix & match (recipes 3, 4, 6): "Where it shows" creates the product (or lets the merchant pick an existing one). Kits (recipe 2): after `productBundleCreate`, publish, add a contents description and the first item's image.
- Store page (recipe 4): `pageCreate({ title, handle, body, isPublished: true })`, saved on the bundle's `page` field; deleted with the bundle only if the app created it.
- "Add to theme" deep links (`editorLinks`, `app/lib/cro.server.ts:1302`): product page `?template=product&addAppBlockId=<key>/ucro-bundle-builder&target=mainSection`, store page `?template=page&addAppBlockId=…&target=newAppsSection`, each with `&previewPath=/products/<handle>` or `/pages/<handle>` (undocumented for addAppBlockId: test; drop it if the editor ignores it). Placement is detected with `getThemeStatus` (`files.bundles`) → "On your store ✓".

## Phase 4: Bundles section (one list + recipes)
- `app/lib/catalog.ts`: Bundles group tabs → **Bundles** (`/app/bundles`) · **Design** (`/app/designs/bundles`). Keep `/app/kits*` and `/app/deals/fixed*` as editor routes: add an optional `paths: string[]` to `Feature` and use it in `featuresForPath`/`areaForPath` so menus, breadcrumbs and plan gates keep working. Update `OFFER_GROUPS.bundles`, `app/lib/offer-types.ts`, `app/lib/help.ts`, `test/app/plans.test.ts`.
- `/app/bundles` (`app/routes/app.bundles._index.tsx`) lists **all bundles** in one `s-table`: mix & match + kits + fixed deals (from `listOffers` in `app/lib/offers.server.ts`, filtered to the bundles group), columns Name · Type · Status · Where it shows · Setup ("Add to theme" until placed). Filters by type. Empty state = the recipe chooser. `app.kits._index.tsx` and the fixed deal list redirect to `/app/bundles?type=…`.
- **Create bundle** (`app/routes/app.bundles.new.tsx`, new): "What do you want to sell?" with the 6 recipes as `GroupCards` (icon, one line, "Best for…", small example picture); each opens its editor with presets (`?recipe=fbt|kit|mixmatch|growing|browse|anyN`). `app.offers.new.tsx` Bundles section links to the same recipes.
- **How it works** card in each editor's right column: the recipe's 2 or 3 steps that tick themselves (product created and published, block on the theme via `getThemeStatus`, embed on, bundle active) with one button each.

## Phase 5: editors as sections + live preview
- `EditorSection` (`app/components/EditorSection.tsx` + CSS module): number badge, title, one-line summary when collapsed ("3 steps · 12 products"), done tick, chevron; the first incomplete section is open; a validation error opens its section and scrolls to it. Sits in `EditorLayout` (Phase 1): sections left, sticky preview + How it works right; one column on narrow screens. **No `slot="aside"`.**
- **Mix & match** (`app/routes/app.bundles.$handle.tsx`, 339 lines in one block) → parts under `app/components/bundle-editor/`:
  1. **Bundle**: name, active, recipe.
  2. **Where it shows**: bundle product page / store page / build while browsing; product title, image (`MediaPicker`), starting price; create or pick product; "Add to theme".
  3. **Products**: steps (label, collection or products, min/max, drag order via `SortableList`).
  4. **Price & discount**: one price · % off · % by item count · amount by item count · price by item count; tier rows; option extras behind `OptionalSetting`.
  5. **Options**: same item twice, hide sold out.
  Preview: `app/components/BundlePreview.tsx` fed live with real product prices (load them like `previewBundles()` in `app/routes/app.designs.bundles.tsx:32-71`) and the `bundlePrice` math for every pricing kind (today it always shows the fixed price).
- **Kit** (`app/routes/app.kits.$id.tsx`): 1 Items · 2 Price · 3 Product page (title, image, published) with a product-page preview.
- **Fixed bundle** (`app/routes/app.deals.$kind.$handle.tsx`, fixed form): 1 Items · 2 Discount · 3 Look (fbt words and style) with a live box preview. Other deal kinds keep their numbered sections, moved into `EditorLayout`.
- **Design tab** (`app/routes/app.designs.bundles.tsx`): page selector adds "Frequently bought together box" next to Bundle page / Collection page.
- House rules: `app/components/fields.tsx` wrappers only; no raw `onChange`/boolean props on `s-*`; no dashes in UI text; `LinkTiles` not link rows; `OptionalSetting` not "0 = off"; `SaveControls` on every editor; update merchant docs `docs/README-merchant.md:97-120` and `docs/testing-checklist.md:100-149`.

## Phase 6: release
- Checks: `npm run build:theme` (30 blocks / 100 KB Liquid), `npx tsc --noEmit`, `npm run lint`, `npm run test:app`, `npm run build`, `npm run test:storefront`, and `npm run test:functions` (needs the Shopify CLI + javy: Mac only).
- `shopify app deploy --allow-updates` from the Mac (new scopes, `page` field, Liquid/JS, both Functions). Rollback: `shopify app release --version=cro-toolbox-7`.
- Merge the PRs (Render redeploys the admin), open the app on **Testing2**, approve the new permissions, then run the Verification below.

## Verification (Testing2, `testing2-j6mmnywm.myshopify.com`)
1. **Plans**: Home plan bar "N of 50 orders this month"; Plans page cards say "Up to 500 orders monthly".
2. **Hidden settings**: upsell editor shows Active / Name / Priority and the preview on the right.
3. **Recipe 1** (FBT): create a fixed bundle of 2 products → box on both product pages with the new heading → "Add bundle to cart" opens the drawer → checkout shows the discount once (no stacking with an upsell on the same product).
4. **Recipe 2** (kit): create → product is Active, published, has an image and contents → add to cart shows one line → order lists the components.
5. **Recipe 3** (mix & match product page): create with a collection step → product created and published → "Add to theme" opens the editor with the block → pick items on the product page → checkout shows one bundle line at the bundle price.
6. **Recipe 4** (growing discount): % tiers 2 = 10%, 3 = 15% → 2 picks 10%, 3 picks 15%, 1 pick no merge; repeat with amount tiers; then "store page": page created, block added via the page link, builder works on `/pages/<handle>`.
7. **Recipe 5** (browse): tray embed on → "+ Add to bundle" on the collection page → tray completes → merged at checkout; picks also show on the bundle page.
8. **Recipe 6** (long collection): collection with 60+ products → "Show more" and search reach product 60 → one price at checkout.
9. **Bugs**: bare bundle product can't be checked out alone; changing the bundle product's price updates checkout without re-saving.
10. Function tests and storefront harness pass; Liquid stays under 92 KB.

## Handoff essentials (for any account)
- Repo `github.com/Omar92953/the-ultimate-cro-app` (default branch `main`); Omar's clone `~/Workspace/the-ultimate-cro-app` on his Mac. Work on a `claude/...` branch → PR → merge (Render auto-deploys `https://cro-toolbox.onrender.com`). Shopify-hosted parts (extensions, theme, TOML) need `shopify app deploy --allow-updates` (live version now `cro-toolbox-7`). Commit trailer `Co-Authored-By: Claude …`.
- **Cloud accounts** can't run `shopify app deploy`, `shopify app execute` or `npm run test:functions` (network blocks Shopify hosts and the javy download): write the code and PRs, then ask Omar to run on his Mac: `cd ~/Workspace/the-ultimate-cro-app && git pull && npm run test:functions && shopify app deploy --allow-updates`.
- Test store: **Testing2** `testing2-j6mmnywm.myshopify.com`. The old dev store `testing-store-2v65holh` has blocked storage handles (main/settings) after a dev-preview clean; don't use it. **Never** touch the live store `ms6vwv-3n` or its themes. **Never** run `shopify app dev clean`.
- Shopify returns no order details until protected customer data is approved in the Partner Dashboard (order counts work).
- House rules: prices/limits only in `app/lib/plans.ts`; feature registry only in `app/lib/catalog.ts`; `app/components/fields.tsx` wrappers; `gql()` and `remember()`; no dashes in UI text; `LinkTiles`; `OptionalSetting`; ask Omar before anything that costs money or is permanent in the Partner Dashboard.
