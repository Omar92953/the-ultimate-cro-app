# The Ultimate CRO App: merchant guide

Four tools that raise order value, for any Online Store 2.0 theme:

- **Cross-sell:** "Pairs well with" products shoppers tick and add in one click, on product pages,
  the cart page and the slide-out cart.
- **Upsell:** quantity offers like "Buy 2, save 10%".
- **Video carousel:** vertical, shoppable videos that play while on screen.
- **Bundles:** mix-and-match bundles ("Any 3 posters for LE 399").

Discounts are real: Shopify applies them at checkout, so the price on the offer is the price the
customer pays.

## Finding your way
- **Home:** one card per feature, with its On/Off switch and the one next step it needs.
- **Upsell offers / Cross-sell offers:** your offers. Each offer is edited in numbered steps, with a live
  preview on the right.
- **Video carousel**, **Bundles:** their content.
- **Settings:** cart drawer offers and the discount method.
- **Theme editor:** every block's settings are grouped the same way (content, heading, colors, corners
  and spacing, visibility), and options only appear when they apply.

## Set up in 3 steps

1. **Add the blocks to your theme.** Open the app → Home → **Add to theme** on each feature card. The theme
   editor opens with the block ready. Drag it where you want it, then click **Save**. For offers in
   the slide-out cart, open **Settings → Cart drawer offers** and switch it on in the theme editor.
2. **Configure.** Create offers in **Upsell offers** and **Cross-sell offers**, pick videos in **Video carousel**,
   and set up **Bundles**. Changes appear on your store straight away.
3. **Preview.** Open a product that matches a rule, add the offer to your cart, and check the price at
   checkout.

Each feature has an **On/Off** switch on the Home page that hides it everywhere without deleting
anything.

## Cross-sell offers
- **Trigger:** all products, specific products, or products in collections. On the cart page and in
  the drawer, the trigger is "this product is in the cart".
- **Offered products:** sold-out products, the product being viewed and products already in the
  cart are skipped automatically.
- **Where it appears:** product page, cart page and/or cart drawer.
- **Discount (optional):** a percentage off the offered products. It applies at checkout **while a
  trigger product is also in the cart**, no matter how the products were added.
- In the theme editor you can also choose **Shopify recommendations** for products that no rule
  covers.

## Upsell offers
- Choose which products get the offers (all, specific, or by collection), then add tiers:
  quantity + discount + optional label and badge (e.g. "Most popular").
- The shopper picks a tier, which sets the quantity on your normal Add to cart button. At checkout
  the discount applies to that product once the cart reaches the tier's quantity. Different
  variants of the same product count together.

### Size upgrades and sizes per item
- **Upsell type → Size upgrade:** tiers are values of one option (e.g. Size: M / L −10% / XL −20%).
  Picking a tier switches the product to that size using your theme's own size picker, and the
  discount applies at checkout to that size.
- **Quantity breaks on products with sizes:** in the theme editor keep **Let shoppers pick a size for
  each item** on. Choosing "Buy 2" then shows a size picker per item (e.g. M + L); your normal Add to
  cart adds each size, and the tier discount still applies.
- **Style → Grouped list** gives the one-box look (rows, the selected row tinted with a bar on its
  edge, "Save 10%" under each offer). **Heading style → Small caps label** gives a small uppercase title.

## Video carousel
- Upload videos in **Content → Files** (or to a product's media), then add them in the app, set the
  order, add captions and link each to a product.
- Linked videos show the product name, price and an Add to cart button.
- In the theme editor: choose the shape (9:16 and others), how many are visible, and which pages
  show it (e.g. put it in the footer and pick "All product pages").

## Bundles
1. In **Products**, create the product you'll sell as the bundle, with the **bundle price**, and
   untick **Track quantity** for it.
2. In the app → **Bundles** → Create bundle: choose that product, then add steps, e.g.
   "Choose 2 posters" (min 2, max 2) and "Add a frame" (optional).
3. In the theme editor, add the **Bundle builder** block to that product's page. A separate product
   template for bundles works well. Turn off the express checkout ("Buy it now") buttons there.

Customers pay exactly the bundle product's price. At checkout the bundle is split into the items
they picked, so **each item's stock goes down** and the items appear on the order.

## Good to know
- **One discount does it all.** The app creates one automatic discount called
  **"Ultimate CRO offers"** (see Discounts). You can change which other discounts it combines with
  there. Don't delete it: the app recreates it on your next save, but offers show without their
  discount until then.
- **Priority:** if several rules match a product, the lowest priority number is shown.
- **Speed:** offers are read from your own store data, and the app adds no calls to its server on
  your storefront.
- **Uninstalling** removes the blocks from your storefront and stops the discounts and bundle
  splitting.

## Discounts on any plan (custom installs)
**Settings → Checkout discounts → Discount method**. **Automatic** is right for almost everyone. For a
custom (non-App Store) install on a store that isn't on Shopify Plus, Shopify doesn't run app
Functions, so the app uses Shopify's own automatic discounts instead ("Buy X get Y" for cross-sells,
"Amount off products" with a minimum quantity for each upsell tier). Two small differences: an upsell's
minimum quantity counts all its products together, and an "All products" cross-sell discounts the
offered products even when bought alone. An "All products" upsell becomes an order discount: its
minimum counts every item in the cart and only the best tier applies (tested: 3 × $24.95 gets 15%, not
10% + 15%). The app creates and replaces these discounts itself — don't
edit them in Discounts.

## Limits
- Up to 50 rules per type, 50 bundles, 50 videos.
- A bundle step that uses a collection offers its first 50 products.
- Cart drawer offers work with Dawn and Dawn-based themes.
- Discounts and bundle stock tracking need the app installed from the Shopify App Store. Shopify
  only runs these checkout features for App Store apps unless your store is on Shopify Plus.
