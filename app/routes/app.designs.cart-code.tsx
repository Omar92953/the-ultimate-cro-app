/**
 * Cart & Checkout → Discount code box: the discount code part of the cart extras design (same storage and theme block as
 * Gift note & delivery date), in the shared editor (components/CartExtrasEditor.tsx).
 */
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { loadCartExtrasPage, saveCartExtrasPage } from "../lib/cart-extras-page.server";
import { CartExtrasEditor } from "../components/CartExtrasEditor";

export const loader = (args: LoaderFunctionArgs) => loadCartExtrasPage(args);
export const action = (args: ActionFunctionArgs) => saveCartExtrasPage(args);

export default function CartCodeDesigner() {
  return <CartExtrasEditor focus="code" />;
}

export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
