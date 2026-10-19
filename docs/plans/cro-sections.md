# CRO sections: 9 new sections in the Section library

Omar, 2026-10-19: add only sections that raise conversion, included in the existing plans (Shopify App
Pricing has no one time purchases). Status: **plan, waiting for Omar's OK.**

## Budget (counted on main 2026-10-19, after the Header came back)

- Theme blocks: **28 of 30**. This plan adds **1** (29 of 30), one slot stays free.
- Liquid: **89.7 of 100 KB**. The new block is about 1.5 KB; the pop up adds about 0.5 KB to an existing embed.

## Design

### One shared block: "CRO section" (`ucs-section`, target section)

Theme editor settings, only two:
- **Section**: Comparison table, Benefits row, Product details tabs, Guarantee, Before and after,
  Shoppable image, Recently viewed, How it works.
- **Style**: 1 to 5 (the styles made in the app, same as every other section).

Liquid (tiny, no markup per section):
1. `kind` = the chosen section; reads `$app:cro_design["sec_<kind>"]` (or `sec_<kind>_<N>`, drafts in the
   theme editor), through the existing `ucs-dk` snippet.
2. Prints the config as JSON in a `<div data-ucs-sec="<kind>">`, plus page data only that section needs
   (Product tabs: the product description; Shoppable image and Recently viewed: money format, cart URL).
3. Loads **only** that section's files: `ucs-sec-<kind>.js` and `ucs-sec-<kind>.css`
   (`asset_url` built from the kind). Nothing loads on pages without the block.

Each `ucs-sec-<kind>.js` builds the HTML from the JSON, like Image carousel and Collection pills do today.
A merchant can add the block several times (for example Benefits row and Guarantee on the same page).

### The pop up: inside the existing "Conversion boosters" embed (no new block)

The embed already runs on every page. It gets a few lines: if `$app:cro_design["sec_popup"]` is on, it
prints the config and loads `ucs-sec-popup.js` (+ css) **lazily** (after load). Off = zero cost.

### Data format

Same storage as all designs: metaobject `$app:cro_design`, handles `sec_<kind>` (live), `sec_<kind>_draft`
(theme editor preview), `sec_<kind>_editor` (full editor state), styles 2 to 5 as `sec_<kind>_<N>`.
No toml change for data. One TypeScript file per section in `app/lib/sections/` with its type, defaults,
`toStorefront()` and design presets; one editor route `app.designs.sec.$kind.tsx` (EditorLayout,
fields.tsx wrappers, Looks tab with presets, Content, Design, live preview that reuses the storefront CSS/JS).

## The 9 sections

Every section: heading, subheading, colours, fonts follow the theme (ThemeMatch), spacing, corners,
desktop and mobile layout. 3 or 4 design presets each (shown on the Looks tab).

| # | Section | Content settings | Presets | Plan |
|---|---|---|---|---|
| 1 | Comparison table | your brand name, up to 3 others ("Others", "Brand X"), up to 10 rows, each cell tick, cross or short text, highlight your column | Clean, Highlighted column, Dark, Cards (mobile) | Starter |
| 2 | Benefits row | up to 6 items: icon (built in set of 24 icons or your image), title, one line | Icons on top, Icons left, Boxed, Strip | Free |
| 3 | Product details tabs | Tabs or accordion; tab 1 "Details" = the product's description (on/off); up to 5 more tabs with your text (Shipping, Returns, Care); optional per product text from a product metafield | Tabs, Accordion, Minimal lines | Free |
| 4 | Guarantee | badge (built in seals: 30 day money back, free returns, secure checkout, or your image), title, text, optional link | Badge left, Centered seal, Banner, Inline small | Free |
| 5 | Before and after | 2 images (from Files), labels, start position, drag handle style, horizontal or vertical | Classic, Rounded, Labels on top | Starter |
| 6 | Shoppable image | 1 image, up to 8 hotspots placed by clicking on the preview, each linked to a product; tap shows a card with picture, live price and Add to cart | Dots, Numbers, Plus signs | Growth |
| 7 | Recently viewed | how many (4 to 12), carousel or grid, show price, Add to cart button, hide the current product | Cards, Compact row, Carousel | Starter |
| 8 | How it works | 3 to 5 steps: number or icon, title, text; optional button | Numbered circles, Timeline, Cards with icons | Free |
| 9 | Email pop up with a discount | see below | Centered, Side image, Bottom bar, Full screen mobile | Starter |

Plan gating goes in `app/lib/plans.ts` (`FEATURE_PLAN`, one key per section, `sec_*`) and `catalog.ts`
(group "Sections"). The site reads both, so the website's feature list updates itself. Styles per section
keep the existing per plan cap.

Recently viewed keeps the last 12 product handles in the shopper's browser (`localStorage`, nothing is sent
to us) and loads live prices from `/products/<handle>.js`. Shoppable image loads live prices the same way.

## Email pop up (9)

Settings: when to show (after N seconds, at N % scroll, on exit intent on desktop), which pages, how often
(once per N days, never again after signing up), heading, text, button, consent line, success message,
image, discount (percent or amount, minimum order, valid N days).

Flow:
1. Shopper enters the email (and ticks consent when the store asks for it).
2. `ucs-sec-popup.js` posts to the app proxy `/apps/ucro/subscribe` (proxy signature checked, like
   reviews and returns).
3. The server creates or finds the customer and sets email marketing consent to subscribed
   (`customerCreate` / `customerEmailMarketingConsentUpdate`, needs **`write_customers`**), tags it
   `cro-popup`.
4. It creates a **unique one use code** (`discountCodeBasicCreate`, existing `write_discounts`), e.g.
   `WELCOME-7K2QF`, valid N days, once per customer, and returns it. The pop up shows it with Copy, and
   the code is also applied to the cart (`/discount/<code>`). Shopify's own emails can then follow up.
5. Limits: one code per email (same email gets the same code back), 5 sign ups per IP per hour,
   honeypot field. No email is stored by the app (only in the merchant's Shopify customers).

Scope work (Omar accepted `write_customers`, 2026-10-19):
- `shopify.app.toml` scopes and `render.yaml` SCOPES (must match), merchants approve the new scope on next open.
- `docs/scopes.md`, `/privacy` and the site privacy page: email used only to create the store's own
  customer with marketing consent and to send them the code.
- **Omar:** the protected customer data form: add "Email" with the reason "Sign up pop up: creates the
  store's customer with marketing consent".

## Demos and tests

- `demos/`: one demo page per section (8 on a product page, the pop up on the home page), built from the
  real blocks with demo data; added to `DEMOS` in `app/lib/site.ts`, "See live demo" on every editor.
- `test/storefront`: render the block for every kind; `test/app`: defaults, toStorefront, the subscribe
  route (signature, limits, same code for the same email).

## Pull requests

1. `App: CRO sections 1 (block, Benefits row, Guarantee, How it works, Comparison table)`
2. `App: CRO sections 2 (Product tabs, Before and after, Shoppable image, Recently viewed)`
3. `App: Email pop up with a discount (write_customers)`

Each: all checks, `build:theme` budget, Shopify deploy from the Mac, merge, check on Testing 3.
