# Access scopes and why each is needed

The app asks for these scopes (set in `shopify.app.toml` → `[access_scopes]`). Nothing else: no
customer accounts, no script tags, no theme writes. Paste these reasons into the App Store
listing's API access justification and the protected customer data request.

| Scope | Why the app needs it | Where it's used |
|---|---|---|
| `read_products` | Shopify's product and collection picker, product names and images in the dashboard, a product's video media for the carousel, and variant IDs so the bundle checks at checkout know which items are allowed | Rule and bundle editors, video manager, `app/lib/cro.server.ts` |
| `write_products` | Bundle products: creates the bundle as a real product with Shopify's own bundles API (`productBundleCreate`/`productBundleUpdate`), so Shopify tracks its stock from its items, sets its prices and compare-at price from its items' prices, and deletes it when the merchant deletes the bundle in the app. Never changes the merchant's other products | Bundles → Bundle products, `app/lib/kits.server.ts`, `products/update` webhook |
| `read_files` | Lists the videos in **Content → Files** (and images) so the merchant can pick them for the carousel, reviews and logos | Video carousel, Reviews and Logos pages |
| `write_files` | Uploads a photo, video or logo straight from the Reviews and Logos forms (staged upload + `fileCreate`), so the merchant doesn't have to go to Content → Files first | Reviews and Logos pages |
| `read_customers` | The customer of an order, to give them store credit (return saving rules, Pro) | Tracking & Returns |
| `read_store_credit_accounts`, `write_store_credit_account_transactions` | Give store credit instead of a refund (store credit accounts) | Return saving rules |
| `write_gift_cards` | A gift card for the credit amount when store credit is not available | Return saving rules |
| `write_merchant_managed_fulfillment_orders` | Hold an exchange's new shipment until the returned items arrive, and release it | Return saving rules (exchanges) |
| `read_locations` | The location to put returned items back in stock | Return saving rules |
| `read_returns`, `write_returns` | Returns as real Shopify returns: a shopper's request becomes a return, the merchant approves or declines it, adds the label Shopify emails, and refunds it | Tracking & Returns |
| `read_orders` | **Protected customer data (level 1, plus shipping city and email at level 2).** Analytics: which sales came from the app's offers and widgets (order line attributes), the plan's revenue-added meter, "bought together" suggestions for cross-sells, the sales pop-ups (product, time and, only if the merchant turns it on, the shipping city; never names), and the shopper's own order lookup on the track-order and returns pages (order number + email) | Analytics, Home, Boosters, Track order and Returns pages |
| `write_publications` | Publishes the bundle products the app creates (mix & match bundle products and bundle products/kits) to the Online Store sales channel, so a bundle is live in one click instead of staying a draft | Bundles editors, `app/lib/bundle-product.server.ts` |
| `write_online_store_pages` | Creates the store page (`/pages/…`) a merchant chooses for a "build your bundle" builder; the app never edits other pages | Bundles editor ("Show it on its own page"), `app/lib/bundle-product.server.ts` |
| `read_themes` | **Read-only.** Checks whether the app's blocks and cart-drawer embed are actually in the published theme, so the Home page can show setup status. This is Shopify's own documented use ("verify theme support") | Home page |
| `write_metaobjects` | Saves the merchant's rules, slides, bundles and feature switches as app-owned (`$app`) metaobjects in their store. The storefront reads these directly, with no calls to our server | Every save |
| `write_metaobject_definitions` | Shopify requires it for the app-owned metaobject definitions declared in `shopify.app.toml` | Install and deploy |
| `write_discounts` | Creates and updates the single automatic discount ("CRO Toolbox offers") that runs the app's discount Function, and writes its configuration | Saving a rule |
| `write_cart_transforms` | Registers the bundle Cart Transform and writes its configuration, so bundles split into their real items at checkout | Saving a bundle |
| `write_payment_customizations` | Creates the app's payment customization ("CRO Toolbox payment rules") and writes its rules, so the cro-payment Function can hide, rename or reorder payment methods at checkout | Checkout → Payment rules |
| `write_delivery_customizations` | Creates the app's delivery customization ("CRO Toolbox delivery rules") and writes its rules for the cro-delivery Function | Checkout → Delivery rules |
| `write_validations` | Creates the app's checkout validation ("CRO Toolbox order limits") and writes its limits for the cro-validation Function | Checkout → Order limits |

## What the app does not do

- It doesn't store customer names, phone numbers or full addresses. The database holds Shopify
  sessions, back-in-stock email requests and return requests (order number, email, items, reason),
  all removed by the privacy webhooks. Sales pop-ups keep product, time and optional city with a
  one-way order fingerprint, never the order id.
- It doesn't use the ScriptTag API or edit theme files. All storefront code ships in the theme app
  extension, and merchants place the blocks themselves.
- The storefront never calls the app's server. Blocks read the store's own metaobjects in Liquid, and
  checkout logic runs inside Shopify Functions.

## Asked in the Partner Dashboard, not in the TOML (read_all_orders)

`read_all_orders` lets the Track order and Returns pages find orders older than 60 days. It is a protected scope: request it in the Partner Dashboard (App setup → API access → Protected scopes → read all orders; reason: "a shopper looks up their own order by its number and email to see its tracking or ask for a return"), and once Shopify approves it add `read_all_orders` to `scopes` in `shopify.app.toml` and the `SCOPES` variable on Render (all three lists equal), then deploy. Until then the pages find the last 60 days of orders only; the setup checklist in Tracking & Returns shows which state the store is in.
