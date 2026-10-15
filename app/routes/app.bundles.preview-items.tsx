/**
 * Pictures and prices for the bundle editor's live preview: ?ids=<product or collection gids>
 * (a collection gives its first 8 products). Remembered briefly so picking around stays quick.
 */
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { previewItems } from "../lib/bundle-preview.server";
import { remember } from "../lib/short-cache.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter((id) => /^gid:\/\/shopify\/(Product|Collection)\/\d+$/.test(id)).sort();
  return remember(session.shop, `preview-items|${ids.join(",")}`, 60000, () => previewItems(admin, ids), 600000).catch(() => ({ items: {}, currency: "USD" }));
};
