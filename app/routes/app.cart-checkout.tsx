/**
 * Cart & Checkout hub: the cart first (cart offers, free shipping bar, gift note), then everything
 * inside Shopify checkout (lib/catalog.ts, area "cart", groups "cart" and "checkout").
 */
import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { FeatureHub } from "./app.library";

export { action, loader, shouldRevalidate } from "./app.library";

export default function CartCheckout() {
  return <FeatureHub area="cart" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
