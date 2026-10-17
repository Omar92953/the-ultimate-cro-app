/** The Storefront menu item became the Section library: old links go there (the ?cat filter is kept). */
import { redirect, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const search = new URL(request.url).search;
  return redirect(`/app/library${search}`);
};
