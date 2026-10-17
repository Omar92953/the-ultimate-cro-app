/** The old Pages hub: the order pages now live in Tracking & Returns (app/lib/catalog.ts). */
import { redirect, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return redirect("/app/tracking-returns");
};
