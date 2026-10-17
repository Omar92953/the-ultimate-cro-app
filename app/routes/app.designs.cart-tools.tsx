/** The CRO Toolbox cart drawer and the Cart menu item are gone: old links go to the Cart group of Storefront. */
import { redirect, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return redirect("/app/cart-checkout?cat=cart");
};
