# CRO Toolbox: merchant guide

One app for the tools that raise order value and turn visits into orders, for any Online Store 2.0
theme: offers and bundles, storefront widgets and sections, the cart, checkout rules and analytics.

Discounts are real: Shopify applies them at checkout, so the price on the offer is the price the
customer pays.

## Finding your way
- **Menu:** Home · Offers · Storefront · Cart · Checkout · Analytics · Settings.
  - **Offers:** every offer in one list — upsells, cross-sells, mix & match bundles, bundle products,
    fixed bundles, buy X get Y, volume discounts, free gifts, upgrades and the after-purchase offer.
    **Create offer** asks where it shows (product page, cart, after payment) and what it offers.
    Add-ons and personalization are here too.
  - **Storefront:** every widget and section, grouped: social proof (reviews, sales pop-ups, trust
    badges, logos), bars & urgency (announcement, countdown, free shipping, stock urgency), product
    page (sticky add to cart, quick add, delivery estimate, back in stock), content (hero, carousels,
    FAQ, quiz, collection pills) and the header, and store pages (track order, returns).
    Filter by status (live, needs setup, off, not in my plan) or search.
  - **Storefront → Cart group** (first group): offers in your theme's cart, gift note & delivery
    date. The free-shipping bar sits in Bars & urgency.
  - **Checkout:** payment rules, delivery rules, order limits, thank-you page, after-purchase offer.
  - **Analytics:** sales from the app (last 30 days vs the 30 before), each offer and bundle, and the
    holdout test.
  - **Settings:** app embeds and their status, checkout discounts, plan and billing, referral, help.
- **Home** shows the setup guide (5 steps that tick themselves), the last 30 days, what needs your
  attention (pending reviews, return requests, back-in-stock requests, anything not on your store
  yet) and what to try next.
- **Every feature page** has a breadcrumb back to its menu item, and tabs for its content and its look.
- **Every design page** has the same tabs (Templates · Content · Style), settings on the left and a
  live preview on the right, and the same buttons: Preview on store, Add to theme / Open in
  theme editor. Changes show Shopify's save bar (Save / Discard) at the top; leaving the page with
  unsaved changes asks first. A section can have up to 5 **styles**; pick one per placement in the theme editor
  (the block's **Style** setting).
- **Theme editor:** blocks only place, move or remove a section; everything else is set in the app.

## Set up in 5 steps (Home → Setup guide)
1. **Turn on the app in your theme** (App embeds).
2. **Create your first offer** (Offers → Create offer).
3. **Place a section** — open a Storefront card and click **Add to theme**; the theme editor opens
   with the block ready. Drag it where you want it, then click **Save**.
4. **Check a test order**: add an offer to the cart and check the price at checkout.
5. **Choose a plan** (Home → Compare plans).

## Plans
- **Free:** 3 offer slots (any mix of offer types switched on at the same time; switch one off to free
  its slot), the cart drawer, bars, reviews, wishlist, back in stock and most storefront widgets,
  3 checkout rules, 2 thank-you modules, 1 countdown, and **1 Starter feature of your choice** to try.
- **Starter:** unlimited offers, every storefront tool and page, 5 styles per section, 6 checkout
  rules, results for your top 3 offers.
- **Growth:** unlimited checkout rules, results for every offer and bundle, the holdout test, and
  feature requests we build for you.
- **Pro:** unlimited orders, A/B tests, return saving rules, Track page offer slots, priority support.
- Paid plans are billed by Shopify. Cancel or change your plan anytime — nothing is deleted; offers
  over a limit are switched off and come back on when you upgrade.

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
- **Quantity breaks on products with sizes:** in **Upsell offers → Style → Content** keep **Let shoppers
  pick a size for each item** on. Choosing "Buy 2" then shows a size picker per item (e.g. M + L); your normal Add to
  cart adds each size, and the tier discount still applies.
- **Upsell offers → Style** sets the whole look, with a live preview of your own offer: ready-made
  looks, Cards or **Grouped list** (one box, the selected row tinted with a bar on its edge), offer
  and saving wording, heading style (e.g. **Small caps label**), colours, corners, spacing and devices.
  The theme editor only places the block.

## Video carousel
- Upload videos in **Content → Files** (or to a product's media), then add them in the app, set the
  order, add captions and link each to a product.
- Linked videos show the product name, price and an Add to cart button.
- **Video carousel → Style** sets the look and where it shows, with a live preview of your videos
  (desktop and phone): ready-made looks, shape (9:16 and others), slides per row, corners, product
  name/price/button, arrows, and pages (e.g. put it in the footer and pick "Only on: All product
  pages"). The theme editor only places the section.

## Bundles
**Bundles → Create bundle** asks what you want to sell and opens the right editor: Frequently bought
together, a kit sold as one product, mix & match on a product page, a growing discount (on a product
page or its own store page), build while browsing, or any N from a long collection for one price.
Every editor is a few numbered steps on the left with a **live preview** on the right (your real
products and prices); a step with a problem opens itself when you save.
1. **Mix and match:** the app creates and publishes the bundle product for you ("Create a new one"),
   or you pick one you have. For a store page it also creates the page.
2. Add steps, e.g. "Choose 2 posters" (min 2, max 2) and "Add a frame" (optional).
3. Click **Add to theme** in the editor's "Get it on your store" card once; it ticks itself.
- **Fixed bundle** (one product, one cart line): Items, Price, and a preview of the product page.
- **Frequently bought together:** Items, Discount and **Box look**: layout (pictures in a row with +
  between, or a list), heading, button ("Buy all [count]: [price]"), pictures, saving as an amount
  or a percentage. Shared by every box on your store.

Customers pay exactly the bundle product's price. At checkout the bundle is split into the items
they picked, so **each item's stock goes down** and the items appear on the order.
- **Bundles → Style** sets how the builder looks (one design for all bundles), with a live preview
  of your bundle where you can pick items: ready-made looks, heading, button and summary words,
  columns, sticky summary, using your theme's Add to cart button, colour and corners. The theme editor
  only places the block.
- **Bundle price:** one price (the bundle product's price) or a percentage off the items the shopper
  picks. Steps can use a whole collection of any size: checkout checks each pick's collection.
- **Build it anywhere** (on by default): shoppers add items from product pages (the **Add to bundle**
  block) and from each step's collection page ("+ Add to bundle" on every product card; products with
  options open a small size/colour picker). The **bundle tray** follows them across pages with each
  step's progress, the picks (remove any), "Browse more" links and, once complete, **Add bundle to
  cart** or **Checkout**. In the cart the items merge into one bundle line at the bundle price.
  Turn on the **Bundle tray** app embed and add the **Add to bundle** block (Bundles page has both
  links). Words, tray position and colours: **Bundles → Style** (preview: Bundle page / Collection page).

## Free shipping bar
- Set the goal and messages in **Storefront → Free shipping bar**. With **Give free shipping
  automatically** on (the default), saving creates or updates the automatic discount "CRO Toolbox free
  shipping" (Shopify → Discounts): free shipping on orders from the goal amount. Turning the bar or the
  option off switches the discount off. Off: the bar only shows the goal, and you give free shipping
  yourself (a shipping rate or a discount).
- **Inside the cart:** shows in the cart drawer and on the cart page, above the products or just above
  the checkout button. Needs the **Conversion boosters** app embed on (or the bar block in the header).
- **Bar at the top of the store:** place the block in the Header area; switch it off to keep the bar
  only inside the cart.

## Hero banners
- Make banners in **Storefront → Hero banners**: a wide desktop image and a tall phone image,
  heading, text, up to two buttons, where the text sits (separately for phones), colours and height.
- In the theme editor add the **Hero image** section and pick a banner. With none picked it shows your
  first banner (change the order in the list). Set **Where on the page** to "Lower down" for banners
  that aren't at the top, so they load only when scrolled to.
- **Preview on store** shows your unsaved changes in the theme editor only; **Save** puts them live.

## Logos, FAQ and quick add
- **Scrolling logos and text** and **FAQ**: the logos and questions are in Storefront; the look is
  in each list's **Design**. Every copy of the section uses that design. A FAQ copy can still show only
  one group (e.g. Shipping), have its own heading, and switch Google's FAQ data on or off.
- **Quick add to cart**: design the card button and the "Added to your cart" popup from its card in
  Storefront (**Design**); in the theme editor you only switch the embed on.
- **Offers in your theme's cart**: heading, how many products and the button text are on **Cross-sell offers →
  Design** (Content tab).

## Good to know
- **One discount does it all.** The app creates one automatic discount called
  **"CRO Toolbox offers"** (see Discounts). You can change which other discounts it combines with
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
