/** The old address: items go to /app/offers/add-ons, the look to /app/styles/upsell/addons. */
import { redirect, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const style = url.searchParams.get("tab") === "style" || url.searchParams.has("design");
  url.searchParams.delete("tab");
  const q = url.searchParams.toString();
  return redirect(style ? `/app/styles/upsell/addons${q ? `?${q}` : ""}` : "/app/offers/add-ons");
};
