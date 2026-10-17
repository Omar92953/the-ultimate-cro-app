/** Checkout moved into Cart & Checkout: old links go to its Checkout group. */
import { redirect, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const search = new URL(request.url).search;
  return redirect(`/app/cart-checkout${search || "?cat=checkout"}`);
};
