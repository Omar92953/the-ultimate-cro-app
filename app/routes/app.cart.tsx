/**
 * Cart hub: the cart drawer and everything shown in the cart (lib/catalog.ts, area "cart").
 */
import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { FeatureHub } from "./app.storefront";

export { action, loader, shouldRevalidate } from "./app.storefront";

export default function Cart() {
  return <FeatureHub area="cart" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
