# Access scopes and why each is needed

The app asks for these scopes (set in `shopify.app.toml` → `[access_scopes]`). Nothing else: no
orders, no customers, no script tags, no theme writes. Paste these reasons into the App Store
listing's API access justification if asked.

| Scope | Why the app needs it | Where it's used |
|---|---|---|
| `read_products` | Shopify's product and collection picker, product names and images in the dashboard, a product's video media for the carousel, and variant IDs so the bundle checks at checkout know which items are allowed | Rule and bundle editors, video manager, `app/lib/cro.server.ts` |
| `read_files` | Lists the videos in **Content → Files** (and images) so the merchant can pick them for the carousel, reviews and logos | Video carousel, Reviews and Logos pages |
| `write_files` | Uploads a photo, video or logo straight from the Reviews and Logos forms (staged upload + `fileCreate`), so the merchant doesn't have to go to Content → Files first | Reviews and Logos pages |
| `read_themes` | **Read-only.** Checks whether the app's blocks and cart-drawer embed are actually in the published theme, so the Home page can show setup status. This is Shopify's own documented use ("verify theme support") | Home page |
| `write_metaobjects` | Saves the merchant's rules, slides, bundles and feature switches as app-owned (`$app`) metaobjects in their store. The storefront reads these directly, with no calls to our server | Every save |
| `write_metaobject_definitions` | Shopify requires it for the app-owned metaobject definitions declared in `shopify.app.toml` | Install and deploy |
| `write_discounts` | Creates and updates the single automatic discount ("CRO Toolbox offers") that runs the app's discount Function, and writes its configuration | Saving a rule |
| `write_cart_transforms` | Registers the bundle Cart Transform and writes its configuration, so bundles split into their real items at checkout | Saving a bundle |

## What the app does not do

- It doesn't read or store customer or order data. The database only holds Shopify sessions.
- It doesn't use the ScriptTag API or edit theme files. All storefront code ships in the theme app
  extension, and merchants place the blocks themselves.
- The storefront never calls the app's server. Blocks read the store's own metaobjects in Liquid, and
  checkout logic runs inside Shopify Functions.
