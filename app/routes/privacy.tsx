/**
 * Public privacy policy at /privacy — the URL for the App Store listing's "Privacy policy" field.
 * Keep it in step with what the code stores (prisma/schema.prisma, the $app metaobjects in
 * shopify.app.toml, webhooks.compliance.tsx). The contact address comes from SUPPORT_EMAIL.
 */
import type { MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import styles from "./_index/styles.module.css";
import { RETENTION_DAYS as R } from "../lib/retention";

export const meta: MetaFunction = () => [{ title: "Privacy policy | CRO Toolbox" }];

export const loader = async () => ({ email: process.env.SUPPORT_EMAIL || "", updated: "October 22, 2026" });

const SECTIONS: [string, string[]][] = [
  [
    "Who we are",
    [
      "CRO Toolbox is a Shopify app that helps merchants increase average order value (AOV) and customer lifetime value (LTV). It adds conversion features to a merchant's store: offers and bundles, store sections, boosters, page designs, order tracking and returns pages, and checkout rules. This policy explains what information the app handles when a merchant installs it and when shoppers use their store.",
    ],
  ],
  [
    "Information from merchants",
    [
      "When you install the app, Shopify gives us your store's domain and an access token. We keep them in our database so the app can work for your store.",
      "Your settings and content (offers, bundles, designs, reviews, FAQ, logos, announcements, checkout rules) are saved in your own Shopify store, as data that belongs to the app, not on our servers.",
      "The app reads your products, collections, files, theme settings and navigation menus to show them in its editors and previews. It never changes your theme files.",
    ],
  ],
  [
    "Information about your customers",
    [
      "Orders: the app reads orders from the last 60 days to show which sales came from its widgets (Results), to find products that are often bought together and to show recent purchases in sales pop-ups (product, time and, only if you turn it on, the shipping city, never names). It also lets shoppers look up their own order, including older orders, by order number and email on your Track order and Returns pages. Order data is read from Shopify when needed and isn't copied to our servers, except as described below.",
      "Back-in-stock requests: when a shopper asks to be told when a product is back, we store their email address and the product they want, so you can see and export the list in the app.",
      "Return requests: when a shopper asks for a return, we store the order number, their email, the items, the reason and any note, so you can handle the request in the app.",
      "Reviews written on your store: the name, text, rating and location the shopper enters are saved in your Shopify store for you to approve. No email address is collected.",
      "Reviewer emails: if you type the email of the person behind a review so the app can check it against your orders (to tick Verified buyer), we store that email in our database. It is never shown on your store. It is deleted when you delete the review, and when you uninstall or the customer asks for deletion.",
      "Email pop up sign ups: when a shopper signs up in the pop up, the email is sent through Shopify to the app, which adds it to the store's own Shopify customers with email marketing consent (tag cro-popup) and creates a one use discount code for that customer. The app doesn't store the email or the code; they live only in the store's Shopify admin.",
      "Recently viewed products are kept only in the shopper's own browser and are never sent to the app.",
      "Wishlists are kept only in the shopper's own browser. Gift notes, delivery dates, personalization text and similar choices are added to the shopper's cart and order in Shopify.",
    ],
  ],
  [
    "How we use it",
    [
      "Only to provide the app's features to the merchant who installed it. We don't sell information, use it for advertising, or share it with anyone except the services that host the app (application hosting and a managed database), which process it on our behalf. If a store turns on live tracking, the tracking number of a shipment is also sent to our tracking data provider, 17TRACK, to get its delivery events. If a store connects its own tracking service (17TRACK, AfterShip, TrackingMore or Ship24) with its own key, the tracking number is sent to that service on the store's behalf. Nothing else about the order or the shopper is sent. If a store turns on loyalty emails, the member's email address and the email itself (points, reward codes) are sent to our email provider, Postmark, to deliver it. If a store connects its own Klaviyo or Omnisend account, the member's email address, points, tier and loyalty events are sent to that account on the store's behalf; if it connects Judge.me, the app reads the store's published reviews to give review points.",
    ],
  ],
  [
    "How long we keep it and how it's deleted",
    [
      "When a customer asks a merchant to delete their data, Shopify tells the app and we delete that customer's back-in-stock requests, return requests and reviewer emails and remove their orders from the sales pop-up list. When Shopify asks for a customer's data, we report what we hold.",
      "When you uninstall the app, Shopify removes the data the app saved in your store, and 48 hours later Shopify asks us to delete everything we hold for your store (your access token, back-in-stock requests, return requests and reviewer emails), which we do.",
      `While the app is installed, old records are deleted automatically every day: back-in-stock requests ${R.stockAlertSent} days after the shopper was told (or after ${R.stockAlertWaiting / 365} year if never sent), return requests and reviewer emails after ${R.returnRequest / 365} years, live tracking answers ${R.trackingCache} days after the last check, and Track page discount codes ${R.trackCode} days after they end.`,
      "The database is encrypted at rest and backed up every night; each backup is encrypted and kept for 14 days.",
    ],
  ],
  [
    "Security",
    [
      "All connections use HTTPS. Requests from Shopify are verified with Shopify's signatures, and each store's data is only ever accessed with that store's own access token.",
      "On your storefront, A/B test versions are remembered and counted only after the shopper allows analytics in your store's cookie banner (Shopify's Customer Privacy API).",
      "If a security incident ever affects personal data, we tell Shopify and the affected merchants within 72 hours, as described in our Terms.",
    ],
  ],
];

export default function Privacy() {
  const { email, updated } = useLoaderData<typeof loader>();
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <h1 className={styles.heading}>Privacy policy</h1>
        <p className={styles.lead}>CRO Toolbox · last updated {updated}</p>
        {SECTIONS.map(([title, paragraphs]) => (
          <section key={title} style={{ marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>{title}</h2>
            {paragraphs.map((p) => (
              <p key={p.slice(0, 40)} style={{ margin: "0 0 8px", fontSize: 15, lineHeight: 1.55, color: "#303030" }}>
                {p}
              </p>
            ))}
          </section>
        ))}
        <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Contact</h2>
        <p className={styles.note}>
          {email ? (
            <>
              Questions or requests about your data: <a href={`mailto:${email}`}>{email}</a>
            </>
          ) : (
            "Questions or requests about your data: use the Support section of our Shopify App Store listing."
          )}
        </p>
      </article>
    </main>
  );
}
