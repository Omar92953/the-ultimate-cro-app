import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  // Opened from the Shopify admin (it passes the shop, host or embedded flag): go straight into the app.
  if (url.searchParams.get("shop") || url.searchParams.get("host") || url.searchParams.get("embedded")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return null;
};

const FEATURES = [
  ["Upsells and cross-sells", "“Buy 2, save 10%” tiers and “Pairs well with” offers, with real discounts at checkout."],
  ["Bundles", "Mix-and-match, fixed bundles, buy X get Y, volume discounts and free gifts."],
  ["Store sections", "Reviews with chat screenshots, FAQ, logos, announcement and countdown bars, hero images and a video carousel."],
  ["Boosters", "Sticky add to cart, low-stock urgency, trust badges and pop-ups of real recent purchases."],
  ["Pages", "A contact page designed in the app, with more pages on the way."],
];

/**
 * The app's public address (outside Shopify). No shop-domain login form: App Store apps are
 * installed from Shopify, and merchants must never be asked to type their myshopify.com address.
 */
export default function Landing() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.heading}>The Ultimate CRO App</h1>
        <p className={styles.lead}>Everything that turns visits into orders, for any Online Store 2.0 theme.</p>
        <ul className={styles.list}>
          {FEATURES.map(([title, text]) => (
            <li key={title}>
              <b>{title}</b>
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>Install it from the Shopify App Store, then open it from your Shopify admin.</p>
      </section>
    </main>
  );
}
