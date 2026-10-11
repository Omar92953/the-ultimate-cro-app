/** Old category pages (Offers & bundles, Boosters, Sections, Header & pages, Checkout) → the new hubs. */
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

const HUB: Record<string, string> = {
  offers: "/app/offers",
  boosters: "/app/storefront?cat=bars",
  sections: "/app/storefront?cat=content",
  design: "/app/storefront?cat=pages",
  checkout: "/app/checkout",
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { redirect } = await authenticate.admin(request);
  return redirect(HUB[params.cat ?? ""] ?? "/app/storefront");
};
