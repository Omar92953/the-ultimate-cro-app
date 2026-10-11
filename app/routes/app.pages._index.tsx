/** The old Pages hub: pages now live on Storefront → Header & pages (app/lib/catalog.ts). */
import { redirect, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return redirect(`/app/storefront?cat=pages`);
};
