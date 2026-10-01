import type { LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  // No shop-domain login form: App Store apps must be installed from Shopify, and merchants
  // must never be asked to type their myshopify.com address.
  useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>The Ultimate CRO App</h1>
        <p className={styles.text}>
          Cross-sells, quantity upsells, shoppable video and mix-and-match bundles for any Online Store 2.0 theme.
        </p>
        <p className={styles.text}>Install it from the Shopify App Store, then open it from your Shopify admin.</p>
        <ul className={styles.list}>
          <li>
            <strong>Cross-sell and upsell</strong>. “Pairs well with” offers and “Buy 2, save 10%” tiers, with real
            discounts applied at checkout.
          </li>
          <li>
            <strong>Video carousel</strong>. Vertical videos that play while on screen, each linked to a product.
          </li>
          <li>
            <strong>Bundles</strong>. Mix-and-match bundles at one price, with every picked item’s stock tracked.
          </li>
        </ul>
      </div>
    </div>
  );
}
