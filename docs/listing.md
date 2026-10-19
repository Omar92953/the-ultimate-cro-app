# App Store submission pack: CRO Toolbox

Everything needed to fill in the Partner Dashboard listing and pass review. Updated 2026-10-16 (after Block D: cart drawer removed, new bundle names, Style tab).
Rules followed (Shopify App Store requirements 4.x): no stats, guarantees, prices or superlatives in
listing text, no other apps' names, name identical to `shopify.app.toml`, English only.
Prices and limits live in `app/lib/plans.ts`; the Partner Dashboard plans must match them exactly.

## Shared description (use word for word everywhere)
CRO Toolbox is a Shopify app for bundles, upsells and cross sells.

Same sentence as `site/src/lib/brand.ts` on the website. Use it on YouTube, social profiles and
directories (G2, Capterra, SaaSworthy) so search engines and AI assistants see one consistent line.

## 1. Listing text (copy and paste)

**App name (30 max):** `CRO Toolbox` (or, Omar's choice, `CRO Toolbox: Upsell & Bundles`, 29: the
name is the strongest search signal in the App Store; keep the brand first and only two plain words)

Search words used once each below, no stuffing (docs/plans/seo-geo.md section 1): upsell, cross sell,
bundles, AOV, conversion rate, after purchase, cart, free shipping bar, discount code, order tracking,
returns, reviews, wishlist, size guide.

**App card subtitle (62 max, 62 used):**
`Upsells, cross sells and bundles that raise AOV, plus tracking`

**App introduction (100 max, 91 used):**
`Upsell, cross sell and bundle offers that raise AOV, applied as real discounts at checkout.`

**App details (500 max, 488 used):**

```
CRO Toolbox brings the conversion tools stores add one by one into a single app, to raise average order value (AOV) and conversion rate. Create upsells, cross sells, bundles and buy X get Y offers that apply as real discounts at checkout. Add a free shipping bar, a discount code box and offers to your theme's cart. Give shoppers an order tracking page and a returns page. Add reviews, a wishlist, a size guide and countdowns to any Online Store 2.0 theme, and see what each offer sells.
```

**Feature list (the form takes 5, 80 max each):**

1. `Upsell and cross sell offers on product pages, in the cart and after purchase` (77)
2. `Mix and match, fixed and tiered bundles, buy X get Y, volume deals and gifts` (76)
3. `Cart offers, free shipping bar, discount code box and gift notes in your cart` (77)
4. `Order tracking page and returns that become real Shopify returns and refunds` (76)
5. `Reviews, wishlist, size guide, countdowns and analytics for every offer` (71)

Only list what works on the version under review: tracking and returns need the protected customer data
approval (section 4) before review; if it is not approved yet, swap feature 4 for
`Payment and delivery rules, order limits and thank-you page modules` (67).

**Pricing (entered as Shopify App Pricing plans in the Partner Dashboard, same as `plans.ts`):**
Free (50 orders a month, 3 offers on at once); Starter $5.99 a month (500 orders); Growth $14.99 a
month (1,000 orders); Pro $24.99 a month (unlimited); yearly $59 / $149 / $249; 14-day trial on
paid plans. Prices go only in the pricing section, never in the text above or in screenshots.
What each plan adds (keep in step with `highlights` in `plans.ts`; list only what works): Growth includes "Your tracking page sells too" (the Track page with product recommendations, a next order discount code, buy again, an after delivery message and an apology for late orders), Pro includes unlimited orders, A/B tests for upsells and cross sells, return saving rules (store credit, exchanges), Track page offer slots (an offer above and one below the tracking, with real codes that expire) and priority support.

**Other fields**
- Requires the Online Store sales channel and an Online Store 2.0 theme (app blocks). Tick "merchant must have an online store".
- Category: pick the closest one for upsell and bundles in the form. Language: English.
- Privacy policy URL: `https://crotoolbox.com/privacy/` (live; matches what the app stores, see section 4; the app's own copy is `https://cro-toolbox.onrender.com/privacy`).
- Support URL: `https://crotoolbox.com/support/` (live).
- Support email: `support@crotoolbox.com` (Cloudflare Email Routing to crotoolbox.app@gmail.com; also info@, features@, pro@). Support URL: `https://crotoolbox.com/support/`. `SUPPORT_EMAIL` is set in `render.yaml`.
- Emergency developer contact (email and phone) in the Partner Dashboard.

**Screenshots (3 to 6, 1600 x 900, no browser chrome, no prices, reviews or stats; add alt text):**
Ready in `branding/screenshots/listing/` (real captures of the app on Testing 3, 2026-10-17, taken at
2x and scaled to 1600 x 900; the 2x originals are in `branding/screenshots/hires/`). Upload in this order:
1. `1-create-offer.png`. Alt: "Create offer: upsells, bundles, cross sells and discounts in one list".
2. `2-bundle-editor.png`. Alt: "Mix and match bundle editor with a live preview".
3. `3-upsell-editor.png`. Alt: "Upsell offer editor with the real block preview".
4. `4-storefront.png`. Alt: "Storefront widgets grouped, cart first".
5. `5-upsell-offers.png`. Alt: "Upsell offers list with status and show order".
6. `6-checkout.png`. Alt: "Checkout rules, thank-you page and after purchase offer".
Not for the listing: `05-upsell-style.png` (plan banner) and `07-home.png` (plan bar and figures, rules 4.2.2 and 4.3.4).
To retake: the capture script used `screencapture` on Omar's Chrome (window 1292 pt wide, page area 1292 x 727 pt).

Feature image (1600 x 900): `branding/feature/feature-banner.png` (headline + 6 widgets from the live demos; source `branding/feature/src/banner.html`, render with headless Chrome at 1600x900). Plain alternative: `branding/feature/feature-bundles.png`.

## 2. Testing instructions for the reviewer (paste into the submission form)

```
CRO Toolbox adds offers, bundles and storefront widgets to a store. No external account or
credentials are needed. Everything is configured inside the app; shoppers see it through
theme app blocks, the cart, and Shopify checkout.

SETUP
1. Install the app on a development store that uses an Online Store 2.0 theme (Dawn works).
   Open the app. Home shows a setup guide.
2. Theme: the app never edits theme files. Use the "Add to theme" or "Open in theme editor"
   buttons inside the app; each opens the theme editor with the block added. Click Save there.
   App embeds (such as "Conversion boosters") are switched on in the theme editor under
   App embeds, using the links in the app.
3. Plan: new stores start on the Free plan (3 offers on at once). Paid features show an upgrade
   card linking to Shopify's hosted plan page. Use a development store, where plans are not charged.

OPTIONAL DEMO STORE (already set up)
Store: testing2-j6mmnywm.myshopify.com   Storefront password: [STOREFRONT PASSWORD]
Open the app: https://admin.shopify.com/store/testing2-j6mmnywm/apps/the-ultimate-cro-app/app

WHAT TO CLICK
- Bundles (Offers > Bundles > Create bundle offer): pick "Mix and match", add steps and products,
  Save, then "Add to theme". On the bundle product's page choose items; one cart line appears
  at the bundle price. Go to checkout: one item at the bundle price. Other recipes: Frequently
  bought together, Fixed bundle (sold as one product), Tiered bundle (buy more, save more), Build your own
  bundle (needs the "Bundle tray" app embed), Fixed price bundle (any 3 for $30).
- Upsell and Cross sell (Offers): create an offer, turn it on, open the product page. The offer
  shows under Add to cart; the discount appears in the cart and at checkout as a Shopify discount.
- Discounts (Offers > Discounts): buy X get Y, volume, gift. Add the products to the cart; the
  discount shows in the cart and at checkout.
- Section library (menu): Reviews, Announcement bar, Countdown, Sticky add to cart, Trust badges,
  Wishlist, FAQ, Logos, Hero banner, Quiz. Each has a Style tab with a live
  preview and an "Add to theme" button.
- Cart & Checkout > Cart group: "Offers in your theme's cart" (turn on its app embed). Add a product:
  offers and the free shipping bar show in the cart.
- Checkout (menu): Payment rules, Delivery rules, Order limits (blocks checkout with a message
  you write), Thank-you page modules, After-purchase offer. Test at the real checkout.
- Analytics (menu): sales that came from the app's offers. Needs orders; "Holdout test" is
  optional.
- Settings: plan, data and support.

NOTES
- Discounts and bundles run as Shopify Functions and show at checkout.
- Nothing is added to a cart without the shopper choosing it. Paid add-ons start unticked.
- The delivery rules never hide the cheapest shipping option or move another one above it.
- Reading orders (sales pop-ups, Analytics) needs protected customer data access, see the
  protected data answers in the submission.
```

## 3. Screencast script (3 to 6 minutes, English, one take, no music needed)

Record on Testing2 at 1080p. Speak slowly and say what you click. Never show the storefront
password, the Partner Dashboard or `.env`.

| Time | Screen | Say |
|---|---|---|
| 0:00 | App Home | "This is CRO Toolbox. It adds offers, bundles and storefront widgets to a store. Home has a setup guide." |
| 0:20 | Theme | "The app never edits theme files. Buttons open the theme editor with the block added." Show the app embeds list. |
| 0:45 | Offers > Bundles > Mix and match | Create a bundle: name, two steps, a price. Save. Click Add to theme, then Save in the editor. |
| 1:45 | Product page | Pick three items, show the summary, Add to cart. |
| 2:15 | Cart and checkout | One bundle line at the bundle price. Go to checkout: one item, one price. |
| 2:45 | Upsell | Create an upsell, show it under Add to cart and the discount at checkout. |
| 3:30 | Section library | Turn on Reviews and the Announcement bar; show the Style tab with its live preview, then the store. |
| 4:15 | Cart offers | Turn on offers in your theme's cart, add a product, show the free shipping bar and offer. |
| 4:45 | Checkout rules | Order limits: set a minimum, show checkout blocked with the message. |
| 5:15 | Analytics and plans | Show Analytics and the Plans page (upgrade goes to Shopify's hosted page). |
| 5:40 | Close | "On uninstall Shopify removes the app's data from the store." End. |

## 4. Protected customer data answers

Scope: `read_orders`. Request it in the Partner Dashboard under API access requests, Protected
customer data. The `orders/create` webhook subscription is switched off in `shopify.app.toml`
until this is approved (it is only needed to keep the sales pop-ups fresh).

| Field | Level | Why the app needs it | Where it goes |
|---|---|---|---|
| Orders: line items, product, created time, test and cancelled flags | 1 | Analytics (which sales came from the app's offers), "bought together" suggestions, sales pop-ups (a real recent purchase: product and time) | Read from Shopify when needed. Sales pop-ups keep product, time and a one-way fingerprint of the order id in the store's own app data |
| Shipping address city | 2 (address) | Only if the merchant turns on "show city" in sales pop-ups ("Someone in Cairo bought..."). Never names, street or postcode | The store's own app data, shown on the storefront only when the merchant turned it on |
| Customer email and order number (typed by the shopper) | 2 (email) | The shopper's own order lookup and return request on the merchant's Track order and Returns pages: the shopper types order number and email, the app checks they match | Return requests keep order number, email, items and reason in the app's database until the merchant or a privacy request deletes them |

Questions Shopify asks, and the answers:
- **Purpose and minimisation:** only the listed fields, only for the listed features. No names, phone numbers or full addresses are read or stored. No marketing, no selling, no profiling.
- **Consent and opt out:** the city in pop-ups is off by default and the merchant controls it. A shopper who types an email for a back in stock alert or a return does so for that purpose. The merchant's privacy policy should say so.
- **Retention:** pop-ups only show purchases newer than the merchant's age setting (7 days by default). Pop-up entries are removed on `customers/redact`. Back in stock and return requests are deleted on `customers/redact` and `shop/redact`. Sessions are deleted on `app/uninstalled` and `shop/redact`.
- **Privacy webhooks:** `customers/data_request`, `customers/redact` and `shop/redact` go to `/webhooks/compliance`, which verifies the HMAC and answers 401 for a bad or missing signature.
- **Security:** HTTPS only; Shopify session token authentication; each shop's data is read only with that shop's token; hosted on Render with a managed Postgres database (Supabase) encrypted at rest; secrets only in Render environment variables.
- **Third parties:** only the hosting services (Render and Supabase), as processors. No analytics or advertising services.
- **Privacy policy:** `https://crotoolbox.com/privacy/` (same text as the app's `/privacy`).

## 5. Checks run before submitting

Run on the Mac on 2026-10-16 (after Block D, version cro-toolbox-22), all pass:
`npm run typecheck`, `npm run lint`, `npm run test:app` (35), `npm run build`, `npm run graphql-codegen`,
`npm run build:theme` (29 of 30 blocks, 86.9 KB of 100 KB Liquid), `npm run test:storefront`,
`npm run test:functions` (71 tests in 5 Functions), `shopify theme check`. Production: `/` 200 in 0.5 s,
`/privacy` 200, crotoolbox.com `/privacy/` and `/support/` 200; `/webhooks/compliance` and
`/webhooks/app/uninstalled` answer 401 without a valid signature.
Clicked through on Testing 3: plans (upgrade to Growth, trial, back to Free),
offers lists and editors, Delete, Style tab, Section library, Cart & Checkout with the Cart group.

**Blocker until the website deploy with the demos is live**: every "See live demo" button in the app opens
`crotoolbox.com/demo/…`, built by the website build (`docs/website.md`). Run `npm run check:links` after the
deploy; reviewers reject broken pages (2.1.1).

## 6. Only Omar can do these (Partner Dashboard and accounts)

- [ ] Choose the **distribution method** (public, App Store). It is permanent.
- [ ] Request **protected customer data** access (section 4 answers), then turn the `orders/create` subscription back on in `shopify.app.toml` and deploy.
- [x] Create the four **App Pricing plans** exactly as in `app/lib/plans.ts` (Free, $5.99, $14.99, $24.99; yearly; 14-day trial) and check the plan handles the app reads.
- [x] SUPPORT_EMAIL `support@crotoolbox.com` (render.yaml) and support URL for the listing (2026-10-18).
- [ ] Add the **emergency developer contact** (email and phone).
- [ ] Upload the **icon** (`branding/app-icon.png`, 1200 x 1200), 3 to 6 **screenshots**, the feature image or video, and the **screencast**.
- [ ] Paste the listing text and test instructions from sections 1 and 2; type the storefront password into the form yourself, never into this repo.
- [ ] Keep Render on a paid plan (a sleeping server fails webhooks and reviews) and the database on a plan that does not pause.
- [x] crotoolbox.com bought; its privacy and support pages go in the listing (section 1).
- [ ] Press "Submit for review".
