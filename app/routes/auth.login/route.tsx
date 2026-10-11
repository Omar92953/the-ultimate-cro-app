import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { login } from "../../shopify.server";

/**
 * Shopify sends a merchant here (with ?shop=) when the app is opened outside the admin: `login`
 * goes straight on to Shopify's own sign-in for that shop. There is no form asking for a
 * myshopify.com address — App Store rule 2.3.1: installs start from Shopify, never from a typed
 * shop domain — so without a valid shop the merchant lands on the app's public page.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!new URL(request.url).searchParams.get("shop")) throw redirect("/");
  await login(request); // redirects to Shopify for a valid shop
  throw redirect("/");
};
