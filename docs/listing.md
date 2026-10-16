# App Store submission pack: CRO Toolbox

Everything needed to fill in the Partner Dashboard listing and pass review. Updated 2026-10-15.
Rules followed (Shopify App Store requirements 4.x): no stats, guarantees, prices or superlatives in
listing text, no other apps' names, name identical to `shopify.app.toml`, English only.
Prices and limits live in `app/lib/plans.ts`; the Partner Dashboard plans must match them exactly.

## Shared description (use word for word everywhere)
CRO Toolbox is a Shopify app for bundles, upsells and cross sells.

Same sentence as `site/src/lib/brand.ts` on the website. Use it on YouTube, social profiles and
directories (G2, Capterra, SaaSworthy) so search engines and AI assistants see one consistent line.

## 1. Listing text (copy and paste)

**App name (30 max):** `CRO Toolbox`

**App card subtitle (62 max, 59 used):**
`Bundles, upsells, cart offers and checkout rules in one app`

**App introduction (100 max, 88 used):**
`Build bundles, upsells and cart offers that apply as real Shopify discounts at checkout.`

**App details (500 max, 471 used):**

```
CRO Toolbox puts the tools stores usually add one by one into a single app. Create bundles, upsells, cross-sells and buy X get Y offers that apply as real Shopify discounts at checkout. Add reviews, announcement bars, countdowns, sticky add to cart, a wishlist and back in stock alerts to any Online Store 2.0 theme. Use the app's cart drawer or add offers to your theme's cart. Set payment and delivery rules and order limits, and see what each offer sells in Analytics.
```

**Feature list (80 max each):**

1. `Mix and match bundles, kits, buy X get Y, volume deals and free gifts` (69)
2. `Upsell and cross-sell offers on product pages, in the cart and after payment` (76)
3. `Discounts apply at checkout as real Shopify discounts, with bundle stock tracked` (80)
4. `Cart drawer with offers, a free shipping bar and gift notes` (59)
5. `Reviews, trust badges, announcement bars, countdowns and sticky add to cart` (75)
6. `Hero banners, FAQ, logos, carousels, quiz, header and footer sections` (69)
7. `Payment and delivery rules, order limits and thank-you page modules` (67)
8. `Analytics per offer and bundle, with an optional holdout test` (61)

**Pricing (entered as Shopify App Pricing plans in the Partner Dashboard, same as `plans.ts`):**
Free (50 orders a month, 3 offers on at once); Starter $5.99 a month (500 orders); Growth $14.99 a
month (1,000 orders); Pro $24.99 a month (unlimited); yearly $59 / $149 / $249; 14-day trial on
paid plans. Prices go only in the pricing section, never in the text above or in screenshots.

**Other fields**
- Requires the Online Store sales channel and an Online Store 2.0 theme (app blocks). Tick "merchant must have an online store".
- Category: pick the closest one for upsell and bundles in the form. Language: English.
- Privacy policy URL: `https://cro-toolbox.onrender.com/privacy` (live; matches what the app stores, see section 4).
- Support: needs a support email and URL that do not contain "Shopify" (Omar decides, see section 6). The app shows the email on Home when `SUPPORT_EMAIL` is set in Render.
- Emergency developer contact (email and phone) in the Partner Dashboard.

**Screenshots (3 to 6, 1600 x 900, no browser chrome, no prices, reviews or stats; add alt text):**
Take them on Testing2 with sample data, never on the live store.
1. Home: the setup guide. Alt: "CRO Toolbox home with the setup steps".
2. Offers: the list of every offer with type and status. Alt: "All offers in one list".
3. A mix and match bundle in the editor with its live preview. Alt: "Bundle editor with a live preview".
4. Storefront: the grouped feature cards. Alt: "Storefront widgets and sections".
5. Cart: "Which cart?" and the drawer preview. Alt: "Choosing the cart drawer".
6. Checkout: payment rules. Alt: "Payment rules for checkout".

Feature image (1600 x 900): the bundle builder on a product page on Testing2 (no prices).

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
- Upsell and Cross-sell (Offers): create a rule, turn it on, open the product page. The offer
  shows under Add to cart; the discount appears in the cart and at checkout as a Shopify discount.
- Discounts (Offers > Discounts): buy X get Y, volume, gift. Add the products to the cart; the
  discount shows in the cart and at checkout.
- Storefront (menu): Reviews, Announcement bar, Countdown, Sticky add to cart, Trust badges,
  Wishlist, FAQ, Logos, Hero banner, Quiz, Header, Footer. Each has a design page with a live
  preview and an "Add to theme" button.
- Cart (menu): choose "Use the app's cart drawer" (turn on its app embed) or "Keep my theme's
  cart". Add a product: offers and the free shipping bar show in the cart.
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
| 3:30 | Storefront | Turn on Reviews and the Announcement bar; show the design page with its live preview, then the store. |
| 4:15 | Cart | Choose the app's cart drawer, add a product, show the free shipping bar and offer. |
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
- **Privacy policy:** `https://cro-toolbox.onrender.com/privacy`.

## 5. Checks run before submitting

Run on the Mac on 2026-10-15 (all pass):
`npx tsc --noEmit`, `npm run lint` (needs PR "lint ignores site/"), `npm run test:app`,
`npm run build`, `npm run graphql-codegen`, `npm run build:theme` (30 of 30 blocks, 86.3 KB of
100 KB Liquid), `npm run test:storefront`, `npm run test:functions`, `shopify theme check` in
`extensions/cro-storefront` (37 files, no offenses), `shopify app build`. Largest storefront JS:
8.4 KB gzipped (`ucs-reviews.js`, limit 10 KB). Production: `/` and `/privacy` answer 200, a badly
signed privacy webhook answers 401, and a request with no signature answers 401 once PR "privacy
webhook answers 401 without a signature" is live.

## 6. Only Omar can do these (Partner Dashboard and accounts)

- [ ] Choose the **distribution method** (public, App Store). It is permanent.
- [ ] Request **protected customer data** access (section 4 answers), then turn the `orders/create` subscription back on in `shopify.app.toml` and deploy.
- [ ] Create the four **App Pricing plans** exactly as in `app/lib/plans.ts` (Free, $5.99, $14.99, $24.99; yearly; 14-day trial) and check the plan handles the app reads.
- [ ] Set **SUPPORT_EMAIL** in Render and give a support email and URL for the listing (no "Shopify" in the address).
- [ ] Add the **emergency developer contact** (email and phone).
- [ ] Upload the **icon** (`branding/app-icon.png`, 1200 x 1200), 3 to 6 **screenshots**, the feature image or video, and the **screencast**.
- [ ] Paste the listing text and test instructions from sections 1 and 2; type the storefront password into the form yourself, never into this repo.
- [ ] Keep Render on a paid plan (a sleeping server fails webhooks and reviews) and the database on a plan that does not pause.
- [ ] Optional: buy crotoolbox.com and use its privacy page and support page in the listing.
- [ ] Press "Submit for review".
