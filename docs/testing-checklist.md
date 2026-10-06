# Step 3: test before anything goes live

Everything here happens on a **development store**. Nothing touches your live store,
and nothing is deployed to Shopify, until you give the OK.

## 0. What was already tested on this Mac (no store needed)

| Check | Result |
|---|---|
| Discount Function: 10 cases compiled to Wasm and validated against Shopify's schema (tiers, cross-sell with and without trigger, collection triggers, best discount per line, bundle lines skipped) | ✅ 10/10 |
| Bundle Cart Transform: 9 cases (valid picks expand; tampered, too few, duplicate and foreign-product picks are rejected) | ✅ 9/9 |
| All 22 Admin GraphQL operations validated against the Admin API 2025-10 schema (`npm run graphql-codegen`) | ✅ |
| TypeScript, ESLint, production build (SQLite and Postgres) | ✅ |
| Theme Check on the extension | ✅ no offenses |
| Extension size: Liquid 49 KB of the 100 KB limit; each JS file under 4 KB gzipped (Shopify suggests under 10 KB) | ✅ |
| Storefront harness (`npm run test:storefront`, then open `test/storefront/out/*.html`): real blocks rendered with mock data and driven in a browser: tiers set the theme quantity, multi-add plus Dawn drawer refresh, drawer offers survive re-render, carousel lazy-load, arrows and keys, bundle picks, limits, properties, theme-button gate | ✅ |

The harness uses LiquidJS and a fake Dawn, so it proves the logic, not Shopify itself. Everything
below still needs a real development store.

## 1. Commands to run in your own terminal

These are interactive (browser login, choosing an organization), so you run them, not me.

```bash
cd ~/Workspace/the-ultimate-cro-app
```

If your Partner account uses a different email from your store login, log out first:

```bash
shopify auth logout
```

Link the project to your Partner organization. Choose **Create a new app**, and name it
**The Ultimate CRO App**:

```bash
shopify app config link
```

Start the app. It asks for a development store (create one if needed: choose "Generate test data"),
installs the app there, and prints a preview link. Leave it running:

```bash
shopify app dev
```

Press **p** in that terminal to open the app in the dev store's admin.

> `shopify app dev` creates the metaobject definitions, the discount Function and the Cart Transform
> on the dev store only. It does not deploy to your live store.

## 2. Put two themes on the dev store

Use a second terminal while `shopify app dev` keeps running. Replace `YOUR-DEV-STORE` with the dev
store's handle (it's shown in the `app dev` output).

A clean, current Dawn:

```bash
shopify theme init dawn-clean --clone-url https://github.com/Shopify/dawn.git --latest --path ~/Workspace
```

```bash
shopify theme push --store YOUR-DEV-STORE.myshopify.com --path ~/Workspace/dawn-clean --unpublished --theme "Dawn (test)"
```

A copy of your **live** theme, from the read-only pull made in step 1:

```bash
shopify theme push --store YOUR-DEV-STORE.myshopify.com --path ~/Workspace/the-ultimate-cro-app/_reference/theme-live --unpublished --theme "Live theme copy (test)"
```

Both themes are only uploaded to the **dev store**. Your real store's themes are not touched. Product
and collection picks saved in the live-theme copy won't exist on the dev store, so those theme
sections may show empty; that's expected. Test each theme through its **Preview** or **Customize**
button (Online Store → Themes).

**Test data to create on the dev store:**
- A product with 3 variants.
- A collection with at least 4 products.
- 2–3 short vertical videos in Content → Files, plus one video uploaded as product media.
- A bundle product, e.g. "Any 3 posters", priced at LE 399, with **Track quantity off**.
- Stock of 10 on the component products, so you can watch it go down.

## 3. Checklist

Run everything on **Dawn (test)** and on the **live theme copy**.

### Dashboard (in the dev store's admin → Apps → The Ultimate CRO App)
- [ ] Home loads with no error banner, and the four features show "Not configured" and "Block not added".
- [ ] Each on/off switch saves (you see a toast) and survives a page refresh.
- [ ] Cross-sell: create a rule with trigger = the 3-variant product, offer 2 products, placements product + cart + drawer, 10% discount. Save, reload, and edit. The list shows it with the right priority.
- [ ] Cross-sell: validation stops a save with no offered products, and shows a clear message.
- [ ] Edit a rule that has a subheadline, clear the subheadline, save → it's gone on the storefront (confirms Shopify accepts an empty value to clear a field).
- [ ] Upsell: create a rule for a collection with tiers 1/0%, 2/10%, 3/15% + badge "Most popular". Save, then reload.
- [ ] After saving a discounted rule: **Discounts** lists "Ultimate CRO offers" (automatic, active), and Home shows "Checkout discount: active".
- [ ] Video carousel: add 2 videos from Files and 1 from a product's media. Reorder them, link products, add a caption, save and reload. The order is kept.
- [ ] Bundles: create a bundle with the bundle product, step 1 "Choose 2 posters" (min 2, max 2) and step 2 "Add a frame" (optional, from a collection). Save. Home shows "Stock tracking on".
- [ ] Bundles: choosing a bundle product that already has a bundle is refused with a message.
- [ ] Delete a rule and a bundle. They disappear, and the storefront stops showing them.
- [ ] Home "Add to theme" buttons open the theme editor with the block ready to place.

### Theme editor, each block on each theme
- [ ] **Cross-sell** block: add it inside the product information (drag it where the old "Pairs well with" sat). Every setting in its panel changes the preview.
- [ ] **Upsell** block: add it above the Add to cart button. The tiers show the LE amounts, and "Save 10%" and the badge sit on the card edges.
- [ ] **Video carousel**: add it on the home page, then try the footer. The "Only on pages ticked" and handle rules work.
- [ ] **Bundle builder**: on the bundle product (ideally its own product template), add the block, and turn off Dynamic checkout buttons on that template.
- [ ] **Cart drawer offers**: App embeds → switch on. It shows only when the cart has a trigger product.
- [ ] A misconfigured block shows the grey "Only you see this note" in the editor and **nothing** on the real storefront (check in an incognito window).
- [ ] Colours: blocks use the theme's button colour and font with no settings changed. Setting a colour in the block overrides it.

### Add to cart from every widget (check the cart after each one)
- [ ] Upsell: pick "Buy 3" → the theme's quantity becomes 3 → theme Add to cart → cart has 3.
- [ ] Upsell with "Show its own Add to cart button" on → adds the chosen quantity.
- [ ] Cross-sell: tick 2 items, one with a variant chosen → one click → both in the cart, and the drawer opens and refreshes.
- [ ] Cross-sell on the cart page (placement "Cart page") → adds, and the page updates.
- [ ] Cart drawer offer → Add → the drawer refreshes and the added item leaves the offer list.
- [ ] Carousel "Add to cart" on a single-variant product. On a multi-variant product it shows "Choose options" and links to the product.
- [ ] Bundle: the button stays disabled until the steps are complete. Then one line appears in the cart with the readable picks.
- [ ] Bundle with "Use my theme's Add to cart button": an incomplete bundle is refused with a message, the express buttons are hidden, and a complete bundle adds with the picks.
- [ ] Sold-out variant or product: never offered. Forcing a sold-out add shows the inline error.

### Size upgrades, sizes per item, grouped list
- [ ] Upsell rule type **Size upgrade** (option "Size", tiers M / L −10% / XL −20%) on a product with sizes: clicking a tier switches the theme's size picker and the price; checkout discounts only that size.
- [ ] Quantity rule on a product with sizes: "Buy 2" shows two size pickers; choose M + L; the theme's Add to cart adds one of each; checkout gives the Buy 2 discount on both.
- [ ] Block **Style → Grouped list** and **Heading style → Small caps label** look right on both themes and on mobile.
- [x] Home → Checkout discounts → **Native Shopify discounts**: Discounts lists the app's native discounts; cart prices match; switching back to **Automatic** removes them and restores "Ultimate CRO offers". *(Done on the dev store: 2 units → 10%, 3–4 units → 15% only, not stacked; switching back restored "Ultimate CRO offers".)*

### Discounts at checkout (the part that costs money if wrong)
Use the dev store's test payments (Bogus Gateway), and test in an incognito window.
- [ ] Upsell: 1 unit → no discount. 2 units → 10% off that product's line. 3 → 15%. Different variants of the same product count together.
- [ ] **Negative test:** go from 3 back down to 1 in the cart → the discount disappears.
- [ ] Cross-sell: offered product alone → full price. Add the trigger product → 10% off the offered product only. Remove the trigger → discount gone.
- [ ] The checkout shows the discount name you set ("discount name at checkout").
- [ ] With a normal discount code as well → the result matches the "combines with" settings of "Ultimate CRO offers" in Discounts.
- [ ] Bundle line: never gets an upsell or cross-sell discount on top.
- [ ] Pause a rule → its discount stops at checkout immediately.

### Bundles at checkout and inventory
- [ ] At checkout, the bundle shows its picked items and the total equals the bundle product's price (LE 399).
- [ ] Place a test order → each picked item's stock drops by 1, and the order lists the items.
- [ ] Bundle quantity 2 in the cart → each component counts twice (verifies Shopify multiplies components by the line quantity).
- [ ] **Tamper test** (browser console on the bundle page):
  ```js
  fetch('/cart/add.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{id: BUNDLE_VARIANT_ID, quantity:1, properties:{_bundle_components:'SOME_OTHER_VARIANT_ID,SOME_OTHER_VARIANT_ID|'}}]})})
  ```
  At checkout the line must stay the plain bundle product, not the other items.

### Mobile (375 px wide, real phone or DevTools)
- [ ] No horizontal page scroll on product, cart and home pages.
- [ ] Upsell tier tags don't overlap the card above.
- [ ] Carousel swipes and snaps, shows "2 and a peek", and videos play only while visible.
- [ ] Bundle grid uses 2 columns and the summary is readable. The sticky summary (if on) doesn't cover the button.
- [ ] Cart drawer offers fit the drawer width.

### Accessibility and performance
- [ ] Tab through the cross-sell, upsell, bundle and carousel with the keyboard only. Arrow keys move the carousel.
- [ ] With the OS set to reduced motion: carousel videos don't autoplay.
- [ ] DevTools → Network on a product page: **zero** requests to your app's server (only Shopify domains).

### Uninstall, then reinstall
- [ ] Uninstall from the dev store's Apps page. The storefront shows no app blocks and no errors, and
      checkout no longer applies "Ultimate CRO offers".
- [ ] Reinstall. Note whether rules, videos and bundles come back. Record what you see, because
      Shopify's handling of app-owned data on uninstall decides this. Blocks placed in themes
      reappear once the app is back.
- [ ] Privacy webhooks respond. With `shopify app dev` running, use the webhook URL it prints:
  ```bash
  shopify app webhook trigger --topic shop/redact --api-version 2025-10 --delivery-method http --address https://YOUR-TUNNEL/webhooks/compliance
  ```
  A request **without** a valid signature must get 401:
  ```bash
  curl -i -X POST https://YOUR-TUNNEL/webhooks/compliance -d '{}'
  ```

### App Store review checks (from docs/submission-review.md, 2026-10-07)
Only possible on the dev store or the production host:
- [ ] Install from a fresh dev store lands on OAuth, then straight into the app's Home (no error page).
- [ ] Uninstall → reinstall: OAuth again, Home loads, no "already installed" errors.
- [ ] Open the app in Chrome **incognito** with third-party cookies blocked: every page still works.
- [ ] Click every nav item, tab and button once, including Bundles → each deal tab, Store sections → each list, Boosters and Settings. No 404 or 500 anywhere.
- [ ] Every app block shows without Liquid errors in the theme editor **and** on the storefront, on two themes (Dawn + one other), including with empty data.
- [ ] Each theme-editor deep link in the app opens the editor with the block added or the embed switched on.
- [ ] Compliance webhooks on the **production URL**: unsigned POST → 401, `shopify app webhook trigger` for each of the 3 topics → 200.
- [ ] After protected-data access is approved: place a test order and check the sales pop-up shows it once, with no name and the city only if switched on. Then trigger `customers/redact` for that customer and check the entry disappears.
- [ ] Sales pop-ups with only 1 recent order: it appears once per visit, not repeatedly.
- [ ] Stock urgency matches real inventory; trust badges and payment icons show; sticky bar adds the selected variant.
- [ ] Bundle deals at checkout (when built): fixed set, buy X get Y, volume tiers, gift. The gift is added only when free and removed when the cart drops below the minimum.
- [ ] Lighthouse (mobile) before vs after installing and configuring the app on home, product and collection pages. The weighted drop (17/40/43 %) must be ≤ 10 points; average 3 runs.
- [ ] Keyboard only: quick-add popup (Tab cycles inside, Escape closes, focus returns), announcement bar, reviews carousel, FAQ.
- [ ] VoiceOver: the rotating announcement bar isn't read out on every rotation (after fix #17).

## 4. Afterwards

Once every box is ticked on both themes:
1. Tell me, and I'll ask before running `shopify app deploy`.
2. Distribution (Partner Dashboard → App distribution): **permanent choice.** We'll decide together.
   Public App Store is needed for the discounts and bundle stock tracking on your non-Plus store.
3. Only after the app works on your real store do the theme features get removed. See
   the private store notes (kept outside this repository).
