/** Cart & Checkout → Gift note & delivery date: the cart extras editor (components/CartExtrasEditor.tsx). */
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { loadCartExtrasPage, saveCartExtrasPage } from "../lib/cart-extras-page.server";
import { CartExtrasEditor } from "../components/CartExtrasEditor";

export const loader = (args: LoaderFunctionArgs) => loadCartExtrasPage(args);
export const action = (args: ActionFunctionArgs) => saveCartExtrasPage(args);

export default function CartExtrasDesigner() {
  return <CartExtrasEditor />;
}

export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
