/** The old Pages hub: pages now live under Header & pages (app/lib/catalog.ts). */
import { redirect, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  return redirect(`/app/browse/design${url.search}`);
};
