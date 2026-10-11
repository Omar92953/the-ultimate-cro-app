# App Store listing draft — CRO Toolbox

Draft for the Partner Dashboard listing, matching the app after the reorganisation (menu: Offers ·
Storefront · Cart · Checkout · Analytics · Settings). Rules followed: no promised results, no
superlatives, no other apps' names, no prices or stats in screenshots, name identical to
`shopify.app.toml`. Character limits are Shopify's.

## Name (≤ 30)
CRO Toolbox

## App introduction (≤ 100)
Upsells, bundles, cart drawer, reviews and checkout rules — one app instead of many.

## App details (≤ 500)
CRO Toolbox brings the tools stores usually install one by one into one app with one menu.
Create upsell, cross-sell, bundle and buy X get Y offers with real Shopify discounts. Add reviews,
bars, countdowns, sticky add to cart, wishlist and back-in-stock to any Online Store 2.0 theme.
Use the app's cart drawer or add offers to your theme's cart. Set payment and delivery rules and
thank-you page modules. See what each offer sells in Analytics. Everything is saved in your store.

## Feature list (≤ 80 each, up to 8)
1. Upsells, cross-sells, mix & match bundles, bundle products, BXGY and gifts
2. Real Shopify discounts at checkout, with stock taken from bundle items
3. Reviews, sales pop-ups, trust badges, bars, countdowns and sticky add to cart
4. Cart drawer with offers, free-shipping bar and express checkout buttons
5. Payment and delivery rules, order limits and thank-you page modules
6. Hero, FAQ, carousels, quiz, header, footer and order tracking pages
7. Analytics per offer and bundle, plus a holdout test
8. Free plan with 3 offer slots and 1 paid feature to try

## Pricing (entered as Shopify App Pricing plans; text per plan)
- **Free** — 3 offer slots, cart drawer, bars, reviews, wishlist, back in stock, 3 checkout rules,
  try 1 Starter feature.
- **Starter $9.99/month** (14-day trial) — unlimited offers, every storefront tool and page, 5 styles
  per section, 6 checkout rules, up to 500 orders a month.
- **Growth $24.99/month** (14-day trial) — unlimited checkout rules, analytics for every offer and
  bundle, holdout test, feature requests built for you, up to 2,000 orders a month.
- **Pro $49.99/month** (14-day trial) — unlimited orders, priority support, your requests built first.
(Prices and limits come from `app/lib/plans.ts`; update both together. Still a proposal — confirm.)

## Screenshots (1600×900, no browser chrome, no prices/reviews/stats)
Take them on the dev store testing-store-2v65holh with sample data, never on the live store.
1. **Home** — setup guide and "Needs your attention" (caption: "Set up in five steps").
2. **Offers** — the all-offers list with type and status (caption: "Every offer in one place").
3. **Offer editor** — a mix & match bundle with its live preview (caption: "Edit with a live preview").
4. **Storefront** — the grouped cards with statuses (caption: "Widgets and sections for any theme").
5. **Cart** — "Which cart?" and the drawer preview (caption: "Your cart, your choice").
6. **Checkout** — payment rules (caption: "Payment and delivery rules").
Feature image: the cart drawer with a bundle offer on a product page.

## Demo video (2–3 min) outline
1. 0:00 Home: setup guide, turn on the app embed.
2. 0:30 Offers → Create offer → mix & match bundle → add to theme → the bundle on the product page.
3. 1:15 Storefront: add reviews and the free-shipping bar.
4. 1:45 Cart: choose the app's cart drawer; add to cart shows the offer.
5. 2:15 Checkout: a payment rule; the discount applied at checkout.
6. 2:40 Analytics: sales per offer.

## Tutorials (in-app, `app/lib/tutorials.ts`)
Record one short video per step above (same order) and paste each YouTube id into
`tutorials.ts`; Home shows a tutorial only once it has a video.
