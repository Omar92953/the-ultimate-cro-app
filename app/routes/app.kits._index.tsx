/** Bundle products (kits) are listed with every other bundle on /app/bundles. */
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { redirect } = await authenticate.admin(request);
  return redirect("/app/bundles?type=kit");
};
