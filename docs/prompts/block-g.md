# Block G brief (from Omar, 2026-10-17)

For the terminal account. Work in ../cro-terminal, start with `bash scripts/sync.sh`, one draft PR per
group item (G1.1, G1.2...), in the order below. Follow CLAUDE.md house rules (fields.tsx wrappers, no
dashes in UI text, EditorLayout + EditorSection, catalog.ts / plans.ts as the only sources). Checks
before each push: typecheck, lint, test:app, build; plus build:theme + test:storefront when theme/
changes, site and demos builds when site/ or demos/ change. Title "Needs Shopify deploy" when theme/,
extensions/ or shopify.app.toml change. Don't merge, don't deploy. Apply every change to similar
places. Screenshots in each PR. Stop after G3 (research) for Omar's scope decision, and after the G9
design doc for his approval; otherwise continue group by group and report after each.


## Context
Omar's notes for the next version: fix small looks (bundle default design, All offers spacing), let
merchants see locked features with a preview and demo, remove pages nobody needs (contact, header,
footer), and add new selling points: a real Tracking & Returns product (Growth plan), a size guide with
size recommendation, a discount code box in the cart, a new menu with Cart & Checkout and a big
Section library, and an MCP server so merchants can let Claude or other AIs build sections and
offers (and theme designs) with the app.

Omar's answers: menu = Home, Offers, Tracking & Returns, Section library (renamed Storefront),
Cart & Checkout, Analytics, Settings (7 items, Shopify's limit before "View more"). Bundle item: both
nicer default look and preview matching the store. MCP: for merchants first, and able to design their
theme with the app even beyond the built in designs. Size guide: product page block like Mavin's
(links "Size chart · Size recommendation" next to the size picker, a modal with two tabs: chart table
with a measurement drawing and note; recommendation from height (cm), weight (kg) and fit Snug / True
to size / Relaxed, answered from size ranges the merchant sets in the app), plus an optional
merchant written fit note ("Runs large, size down").

What the code map found (facts behind the plan):
- Theme blocks 29 of 30 used; removing contact, header, footer frees 3 (26 of 30). New blocks needed:
  size guide (1), AI custom section (1) = 28 of 30. Liquid 86.9 of 100 KB.
- Track works; Returns only collects requests (no Shopify return, refund, label or email). Needs
  protected customer data approval; only last 60 days of orders (no read_all_orders); deep link puts the
  block on every standard page; Returns link opens a Track page; style 2-5 ignored for the return window.
- Wishlist: styles live only in ucs-sections.css, which the boosters embed doesn't load, so hearts
  render unstyled on most pages (same for the cart extras drawer). No on/off, no draft preview, links
  ignore language prefix, a dash in sold out text.
- No discount code field anywhere; best home = cart extras block (cart page + drawer injection).
- Locked page shows no preview and no demo; 65 static showcases + ~25 live previews exist to reuse.
  Editors, hubs, Style pages and the locked page lack "See live demo".
- Save functions take plain JSON (`designs.server.ts`, `cro.server.ts`, `sections.server.ts`);
  `unauthenticated.admin(shop)` gives an offline client; plan gate and slot limits live only in routes.

## Order of work (each group = one or more PRs for the terminal account; I review, test, deploy)

G1. Quick fixes (no deploy)
  1. #2 All offers table spacing: give the filter row and table the same padding as the other offer
     lists (`app.offers._index.tsx`), more room between filters and table, aligned columns.
  2. #1 Bundle builder default look (`app/lib/bundle-design.ts` defaults, `ucro.css` fallbacks,
     `BundlePreview`): a store quality default (filled cards with soft background, picked state, clear
     price summary, own Add button look) and the preview must render exactly what the store renders
     (same CSS vars and defaults; check desktop and phone in the harness). [Needs deploy: ucro.css]
  3. #3 Locked feature page (`Upgrade.tsx` LockedPage): show the feature's live preview (or its
     showcase when it has no live preview) above the upgrade card, plus "See live demo".
  4. #4 "See live demo" on every place it is missing: offer, deal, bundle, kit and section editors,
     Style pages, hub cards (card menu and a small link), Offers hub group cards, locked page.

G2. Remove contact page, header and footer (#6, #7) [Needs deploy]
  Delete the features, blocks, assets, previews, showcases, demos, site pages, help article and docs
  listed by the code map; drop `cro_page` metaobject and the `read_online_store_navigation` scope if
  nothing else needs it (fewer scopes helps review). 29 → 26 blocks.

G3. Competitor research for tracking & returns (#10) — before any build
  Write `docs/research/tracking-returns.md`: AfterShip Tracking + Returns, Parcel Panel, Track123,
  17TRACK, Loop Returns, Redo, ReturnGO, AfterShip Returns, Shopify's own self serve returns. For each:
  features, pricing tier, how setup works, what the merchant must provide (carrier accounts, return
  address, policy, label provider, email domain), how they get tracking data (Shopify fulfillments vs
  carrier APIs), how returns become Shopify returns/refunds, notifications. End with: a feature gap list
  vs CRO Toolbox, what we can build with Shopify APIs only (no paid carrier API), what needs a third
  party, and the recommended scope for v1. Omar approves the scope before G4.

G4. Tracking & Returns product (#6, #9) — Growth plan [Needs deploy]
  1. New menu area "Tracking & Returns" (catalog AREAS, before Section library) with its own hub
     design (not the card grid): a status overview, the two pages, setup checklist, requests list.
  2. Setup page per feature: step by step with live status checks (page created and template
     assigned, block placed, protected data approved, return window and policy, return address).
     Create a dedicated page template (page.track / page.returns) instead of the default page template.
  3. Make them really work: request read_all_orders if research says so; fix the Returns link, the
     style slot bug, custom order prefixes, missing email orders, proxy rate limit key.
  4. Returns v1 (scope from G3): approve/decline in the app that creates a real Shopify return
     (returnRequest/returnApprove, write_returns scope), optional refund via Shopify, merchant and
     shopper email notifications, return reasons, photos if feasible.
  5. Plan: track and returns move to Growth (plans.ts, site and listing follow).
  6. Apply the same hub design to Cart & Checkout (G5).

G5. New menu and hubs (#9, #11)
  1. AREAS: Home, Offers, Tracking & Returns, Section library, Cart & Checkout, Analytics, Settings.
  2. Cart & Checkout hub (new design from G4): Cart group (theme cart offers, shipping bar, gift note
     and delivery date, discount code) then Checkout group (payment and delivery rules, order limits,
     thank-you page, after purchase offer).
  3. Section library (renamed Storefront): a section store: big search over title and description,
     categories, live preview on each card, a detail drawer with larger preview, templates and "Add to
     theme" / "See live demo"; cards generated from catalog.ts instead of the hand built lists.
  4. Redirects for old URLs, tests (`plans.test.ts`), breadcrumbs, plans page, site menu and docs.

G6. Wishlist works (#8) [Needs deploy]
  Load wishlist (and cart extras drawer) styles from the boosters embed, add an on/off and draft
  preview ("See it on my store"), language prefix in links, feedback on add to cart and share, price
  saved for card hearts, no dashes; test on Testing 3 (heart, floating button, wishlist page, share).

G7. Discount code box in the cart (#13) [Needs deploy]
  New option in Gift note & delivery date (cart extras): a discount code field on the cart page and in
  the theme's cart drawer, applies via the cart (`cart/update.js` discount), shows applied codes with
  remove, error text for invalid codes; design options in its Style tab; Starter like cart extras.

G8. Size guide with size recommendation (#5) [Needs deploy]
  1. New theme block "Size guide" (product page): links "Size chart" and "Size recommendation" by the
     size picker (or under it), opens a modal with the two tabs from Omar's screenshots.
  2. App: Size guide feature (Section library, product page group): charts (columns like waist,
     inseam; rows per size; unit cm/in; drawing from a small set of garment outlines or an uploaded
     image; note), assigned to products, collections or tags.
  3. Recommendation: merchant sets per chart the height and weight range for each size plus how the
     fit choice shifts it (Snug −1, Relaxed +1); the store answers "We recommend M" from those rules
     only. Optional fit note per chart ("Runs large, size down"), typed by the merchant.
  4. Plan: Starter. Live preview, templates, demo, help article, site page.

G9. MCP server (#12) — design first, then build
  1. Design doc `docs/plans/mcp-server.md` (for Omar's approval): a remote MCP server on the Render app
     (`/mcp`, streamable HTTP); merchants connect from Settings → "Connect an AI assistant" (per shop
     token or OAuth); tools grouped as read (list features, designs, offers, products), build (create or
     update offers, bundles, sections, designs from presets or values), place (theme editor deep links),
     preview (draft + preview URL); every tool runs the same validation, plan gate and slot limits as the
     admin (move checks from routes into lib so both paths share them); audit log; rate limits.
  2. Custom AI sections ("design their theme even beyond built in designs"): a new "Custom section"
     theme block that renders AI written HTML + CSS stored in a metaobject, sanitized on save (no
     scripts, no external JS, allowed tags/attributes only, CSS scoped to the block), with a live
     preview and draft before publish. Check against App Store rules in the design doc.
  3. Build after approval: tools, Settings page, docs for Claude Desktop / claude.ai connectors.

## Verification (me, on Testing 3, per PR)
- G1: All offers spacing; bundle builder default looks the same in preview and on the product page
  (desktop and phone); a locked feature shows a preview and demo; demo buttons on editors and hubs.
- G2: no contact, header, footer anywhere (`grep`), theme build 26/30 blocks, site build, link check.
- G3: research doc reviewed with Omar, v1 scope agreed.
- G4: on Testing 3 a test order: track it on the Track page; request a return on the Returns page;
  approve in the app; a Shopify return exists on the order; emails sent; setup checklist turns green.
- G5: new menu order; Cart & Checkout hub; Section library search and preview; old URLs redirect.
- G6: hearts styled on product and collection pages, wishlist page lists items, share link works.
- G7: valid code applies in cart page and drawer, invalid shows an error, checkout shows the discount.
- G8: size guide modal on a product; chart shows; recommendation answers from the merchant's ranges.
- G9: design doc approved; then connect Claude to Testing 3 through MCP, build a section and an offer,
  see them as drafts in the app, publish.
- Every group: typecheck, lint, test:app, build, build:theme, test:storefront, test:functions,
  site and demos builds; Shopify deploy before merge where marked.
