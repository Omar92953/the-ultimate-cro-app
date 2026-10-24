# Points shop: plan and status

| PR | What | State |
| --- | --- | --- |
| 1 | The points shop: admin tab, proxy "buy", storefront button, panel list and Rewards page grid | Ready for the lead: #292 (Needs Shopify deploy) |
| 2 | Only with points: checkout guard, hide from collections and search | Ready for the lead: #297, after #292 (Needs Shopify deploy) |
| 3 | Points shop collection, help, website, docs | To do |

Points shop: products bought with loyalty points (Omar, 2026-10-24). Build it in 3 PRs, claim with a draft PR first,
copy this file to docs/plans/points-shop.md in PR 1 and keep it up to date. Same rules as the audit: worktrees from
origin/main, a test that fails before, every check (HANDOFF.md list, site build, `shopify app build`), "ready for the
lead". PRs that change extensions/ or theme/ get "(Needs Shopify deploy)" in the title; the lead deploys.

## What Omar asked
- "the points from the loyalty program to buy products priced in points by the app user"
- Points only, or points plus money: "both and let the user decide" (per product).
- Plans: Growth and Pro (not a Pro only part, so not in LOYALTY_PRO).
- "make it as option in the app so that the user can choose": a product can be "only with points" (can't be bought
  with money), maybe "a special collection", and the merchant picks who sees it:
  1. everyone (shoppers without enough points see it but can't get it),
  2. only members who have enough points,
  3. members from a number of points (lower than the price), "so the customers can set their targets".

## Settings (app/lib/loyalty/config.ts, with defaults and clean up like rewards)
`shop: { on: boolean; items: ShopItem[] }`, at most 50 items:
`ShopItem = { id; on; product: { id, title, handle, image, price }; points (>= 1); money (>= 0, 0 = points only,
less than the price); only: boolean (only with points); unlisted: boolean (hidden from collections and search);
show: "all" | "afford" | "from"; from: number (1 to points); limit: number (per customer, 0 = no limit) }`.

## PR 1: the points shop (app + storefront script, Needs Shopify deploy)
- Admin: a "Points shop" tab in the loyalty tabs (app/routes/app.loyalty.shop.tsx, fields.tsx wrappers, EditorLayout
  rules from HANDOFF.md). On or off; add products with the App Bridge product picker (as the free product reward does);
  per product: points price, "Plus money" amount, "Who sees it" (Everyone / Members with enough points / Members with
  at least N points), N, limit per customer. Plain words, no dashes, never first person.
- Getting it: proxy intent "buy" { item, variant } in proxy.loyalty.tsx. Signed in member only; the item is on and this
  member may see it; the variant belongs to the product (read it and its price from Shopify, never trust the browser);
  the limit per customer; points taken with the strict ledger spend (`record` strict, new kind "shop", label "Bought
  with points", counted as spent in analytics, never earned); a one use code for this customer only, for that variant,
  amount off = variant price minus the money part, one item (appliesOnEachItem false), valid for the rewards' days.
  Shopify refuses: points back as `redeem_back`. Returns the code; the script adds the variant to the cart and applies
  the code (the free product reward's path).
- Who sees what: the public storefront copy (toStorefrontLoyalty) holds only "all" items. Signed in members get their
  own list from the proxy ("me"): "afford" items when their points are enough, "from" items from N points (with
  "You have 600 of 800 points").
- Storefront (ucs-loyalty.js, under 10 KB gzipped; if it does not fit, a ucs-loyalty-shop.js the script loads only when
  the shop is on, like ucs-cart-extras.js): on the product page a "Get it for 800 points" or "800 points + $10.00"
  button under the theme's buy buttons for the selected variant; a guest sees "Sign in to get it with points"; a
  member short of points sees "300 more points to get it" (disabled). A "Shop with points" list in the rewards panel
  and a grid on the Rewards page (picture, title, price in points, button). Keyboard and screen reader friendly, no
  layout shift, works on Dawn, design mode shows a sample.
- Plan: on from Growth (accessFor `on`); after a downgrade below Growth it stops with the rest of loyalty (#291).
- Tests: config clean up, who sees what (all/afford/from, guest, member), buy (not enough points, limit, wrong variant,
  amount for points only and points plus money, Shopify refusal gives points back), the storefront harness renders
  the button and the list.

## PR 2: only with points (app + Function, Needs Shopify deploy)
- "Only with points" switch per product: a third instance of extensions/cro-validation (like the bundle guard) with
  { points: [{ p: product gid, m: money per item }] }: a cart line of such a product that costs more than its money part
  per item (after discounts, line `cost.totalAmount`; add it to the input query, stay under 3,000 bytes) blocks checkout
  with "This product can only be bought with points." Created when the first such product is saved, removed with the
  last. Check that discount codes show in the line cost at checkout (Testing 3).
- "Hide it from collections and search" (only with "only with points"): product status UNLISTED, set back to ACTIVE
  when switched off or the item is removed (only if the app made it unlisted). The script hides the theme's add to cart
  button on such a product page and shows the points button instead.
- Tests: the guard's check function (points only, points plus money, quantity 2, no code), status changes.

## PR 3: a Points shop collection, help and website
- Optional "Keep a Points shop collection": the app makes a manual collection "Points shop" with the listed items and
  keeps it in step, so the merchant can link it in the menu; product cards there show the points price.
- Help page and website feature text (site/), docs/plans/loyalty.md, the workboard.

## Check on Testing 3 (the lead does it after each deploy)
Add 2 products (one points only and hidden, one 800 points + $10), each visibility option, buy both as a member with
and without enough points, checkout totals, the guard blocks buying the points only product with money.

## Note from the lead (2026-10-24, later)
- Loyalty languages are merged (#295, cro-toolbox-64): app/lib/loyalty/languages.ts. Every new widget word in
  WIDGET_TEXTS needs a translation in each BUILT_IN language (test/app/loyalty-languages.test.ts asks for every word),
  and the points shop item names can be added to LoyaltyLanguage later.
- The lead's usage limit was reached: leave finished PRs as "ready for the lead"; the lead deploys and merges them next.

## PR 1 as built (#292)
- Config: `shop: { on, days, items }` in `app/lib/loyalty/config.ts` (`cleanShop`, `canSeeItem`, `shopFor`); the code's
  days are one setting for the whole shop. The storefront copy `ps` holds only "Everyone" products.
- Admin: Loyalty → Points shop (`app/routes/app.loyalty.shop.tsx`), tab after Rewards in `catalog.ts`.
- Buying: `app/lib/loyalty/shop.server.ts` `buy`, proxy intent "buy" { item, variant }. The purchase number is in the
  ledger dedupe key (`shop:<member>:<item>:<n>`), so two clicks at once can't pass the limit; refused codes give the
  points back as `redeem_back` (`shop-back:` key) and don't count toward the limit. Kept in LoyaltyReward (kind "shop"),
  so the code also shows under "Your code" in the panel. The member gets the reward email with the code.
- Storefront: in `ucs-loyalty.js` (6.8 KB gzipped). The boosters embed passes `pid` (product id) and `dm` (theme
  editor: a sample product). After buying: `cart/add.js` with the variant, then `/discount/CODE?redirect=/cart`.
  Words: `shopTitle`, `shopGet`, `shopSignIn`, `shopMore`, `shopHave` (Look → "Points shop", all built in languages).
- Harness: `test/storefront/sections.mjs` pages `loyalty-shop.html` (member with 900 points; `#buy` clicks the button
  and writes what was sent into `data-added`), `loyalty-shop-guest.html`, `loyalty-shop-design.html`.
- Not in PR 1: the `only` and `unlisted` switches have no admin field yet (PR 2).

## PR 2 as built (#297)
- Admin: "Only with points" and, under it, "Hide it from collections and search" per product.
- Function: `checkPoints` in `extensions/cro-validation` (config `{ points: [{ p, m }] }`, line `cost.totalAmount`
  per item above `m` + half a cent is refused: "<Product> can only be bought with points."). Input query 497 bytes.
- App: `syncPointsShop` (lib/loyalty/shop.server.ts), run by `publishLoyalty` after every loyalty save, the program
  switch and plan changes. The guard is the third cro-validation ("CRO Toolbox points guard", `syncGuard` in
  checkout-rules.server.ts, shared with the bundle guard); with no such product it is switched off, not deleted (like the
  bundle guard). `LoyaltyProgram.state` keeps `pointsGuard` and `pointsHidden` (only products the app unlisted go back
  to ACTIVE). When the shop, the program or the plan's loyalty is off, the guard is off and the products are listed again,
  so they can be bought with money at their price (Omar can say if he wants them blocked instead).
- Storefront: `po` (ids of products sold only with points) in the public copy; the script hides the theme's submit,
  `[name=add]` and `.shopify-payment-button` in the product form; a guest sees "Sign in to get it with points".
- To check on Testing 3: discount codes show in the line cost the validation reads at checkout (a points only product
  with the member's code must pass; without it, be refused).
