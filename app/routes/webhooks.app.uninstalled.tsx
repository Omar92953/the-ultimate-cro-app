import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { removeShopMcp } from "../lib/mcp/auth.server";
import { removeShopTracking } from "../lib/tracking/tracking.server";
import { removeShopAb } from "../lib/ab-tests.server";
import { removeShopTrackCodes } from "../lib/track-sell.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }
  // Assistants connected to this store lose access at once (docs/plans/mcp-server.md §6).
  await removeShopMcp(shop);
  await removeShopTracking(shop);
  await removeShopAb(shop);
  await removeShopTrackCodes(shop);

  return new Response();
};
