/** Old category pages (Offers & bundles, Boosters, Sections, Header & pages, Checkout) → the new hubs. */
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

const HUB: Record<string, string> = {
  offers: "/app/offers",
  boosters: "/app/library?cat=bars",
  sections: "/app/library?cat=content",
  design: "/app/library",
  checkout: "/app/cart-checkout?cat=checkout",
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { redirect } = await authenticate.admin(request);
  return redirect(HUB[params.cat ?? ""] ?? "/app/library");
};
