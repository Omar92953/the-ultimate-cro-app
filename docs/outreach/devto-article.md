# dev.to article (also on Medium)

**Where:** https://dev.to (New post), tags `shopify`, `webdev`, `javascript`, `ecommerce`. Then the same
text on Medium (Import a story from the dev.to URL, which sets the canonical link to dev.to). Cover:
`branding/app-store/feature-banner.png`.

**Title:** Building bundle discounts on Shopify Functions: five things I learned

**Article:**

I build CRO Toolbox, a Shopify app for bundles, upsells and cross sells. Its checkout logic runs on
Shopify Functions: small WebAssembly programs Shopify runs during checkout, configured through
metafields. Here are five things that weren't obvious when I started.

### 1. Function configuration lives in metafields, and they have a size limit

A discount Function reads its settings from a metafield on the discount. Shopify ignores Function
metafields over 10,000 bytes, and it does so silently: the discount just stops applying. The app
checks the size before saving and keeps a margin (9,500 bytes), so a merchant with many offers gets
a clear message instead of a discount that quietly does nothing.

**Takeaway:** measure the serialized config, keep it compact (short keys, IDs instead of objects), and
fail loudly before Shopify fails silently.

### 2. Split shopper built bundles into their items

A mix and match box shows as one line in the cart at the bundle price. At checkout, a Cart Transform
Function expands it into the items the shopper picked, so each item's inventory goes down and the order
lists what to pack. Fixed kits are different: they can use Shopify's own bundles, where Shopify
tracks the kit's stock from its components.

### 3. Discount Functions and Cart Transform from custom apps only run on Shopify Plus

If you test with a custom distribution app on a non Plus store, these Functions won't run. They do run
for public App Store apps on every plan. Plan your testing (and your distribution) around that.

### 4. Let the theme own the page

Storefront features are theme app blocks and app embeds, placed in the theme editor. The app never edits
theme code, so uninstalling leaves the theme as it was. The trade off is limits: Shopify caps the number
of blocks and the size of Liquid per app, so new features have to fit into existing blocks.

### 5. Read data on the page, not from your server

Widgets read the store's data (products, prices, the cart) in Liquid and the Ajax cart API as the page
loads. Only shopper forms (reviews, back in stock, returns, order lookup) go through an app proxy to the
app's server. Fewer moving parts, faster pages, and less customer data on the app's side.

---

If you're building on Shopify Functions, the docs are at https://shopify.dev/docs/apps/build/functions.
The app is at https://crotoolbox.com/?utm_source=devto&utm_medium=outreach.
