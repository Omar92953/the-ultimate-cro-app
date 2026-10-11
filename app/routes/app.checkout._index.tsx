/**
 * Checkout hub: rules and pages inside Shopify checkout (lib/catalog.ts, area "checkout").
 */
import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { FeatureHub } from "./app.storefront";

export { action, loader, shouldRevalidate } from "./app.storefront";

export default function Checkout() {
  return <FeatureHub area="checkout" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
