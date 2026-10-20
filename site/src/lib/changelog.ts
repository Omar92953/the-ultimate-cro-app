/**
 * The changelog (/changelog/): what changed in the CRO Toolbox app, in plain words, newest first.
 * Written from the merged app pull requests (git log --merges on main), only changes a merchant
 * notices; dated by when the change was finished. Storefront changes reach stores with the next app
 * release. Add an entry when an app change merges: date, a short title, one line per change.
 * No dashes, no first person, no promises.
 */
export type ChangelogEntry = { date: string; title: string; items: string[] };

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-20",
    title: "Nine new sections for your store",
    items: [
      "A comparison table, a benefits row, product details tabs, a guarantee, before and after pictures, a shoppable image, recently viewed products and a how it works section, each with templates and a live preview.",
      "An email pop up that collects emails with a one use discount code and adds the shopper to your customers.",
    ],
  },
  {
    date: "2026-10-19",
    title: "Header and the Plans page",
    items: [
      "The Header is back in the Section library, with its own design page.",
      "Every plan button in the app opens the app's own Plans page.",
      "The privacy policy explains consent, how long data is kept and backups in more detail.",
    ],
  },
  {
    date: "2026-10-18",
    title: "A Track page that sells, and returns that keep the sale",
    items: [
      "Track page: a discount code for the next order, Buy again, a message for delayed orders, product recommendations under the order and a delivery timeline.",
      "Track page offers above and below the tracking (Pro).",
      "Live tracking from most carriers (Pro), your own tracking key, or a webhook link.",
      "Returns: store credit instead of a refund with an optional bonus, exchanges for another size or colour, and approval by rule (Pro).",
      "A/B tests for upsells and cross sells: half of your shoppers see version B (Pro).",
      "Verified buyer badges on reviews are checked against your orders.",
      "Connect Claude to the app in one click.",
    ],
  },
  {
    date: "2026-10-17",
    title: "Tracking & Returns, size guide and a new menu",
    items: [
      "Tracking & Returns: a Track your order page and a Returns page that creates real Shopify returns. The app makes both pages for you.",
      "Size guide with a size recommendation from the height and weight ranges you set.",
      "A discount code box in the cart, and a wishlist page.",
      "A new menu: Offers, Tracking & Returns, Section library, and Cart & Checkout.",
      "AI assistants such as Claude can read and build your offers, discounts and bundles through the app's connector.",
      "See live demo buttons on editors and Style pages.",
    ],
  },
  {
    date: "2026-10-16",
    title: "Clearer editors and bundle names",
    items: [
      "One Style page per offer group, and each offer can have its own style.",
      "Offer editors show a preview, a delete button and the order offers show in.",
      "Bundles have one tab per bundle type and clearer names.",
      "The Home setup guide ticks itself off as you go.",
      "Request a feature from Home, and the request reaches the team.",
      "Saving is faster: the page no longer reloads on save.",
    ],
  },
  {
    date: "2026-10-15",
    title: "Live demos",
    items: ["See live demo buttons open each feature on a demo store, so you can try it before you set it up."],
  },
];
