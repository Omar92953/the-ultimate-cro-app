/**
 * shop/redact (48 hours after uninstall): every row the app keeps for the store, in every table that has a shop
 * column. test/app/shop-data.test.ts fills each such table and checks it ends up empty for that store, so a new
 * table that is forgotten here fails the tests.
 */
import db from "../db.server";
import { removeShopMcp } from "./mcp/auth.server";
import { removeShopTracking } from "./tracking/tracking.server";
import { removeShopAb } from "./ab-tests.server";
import { removeShopTrackCodes } from "./track-sell.server";
import { redactShop } from "./stock.server";
import { redactReviewerEmails } from "./reviewer-email.server";
import { redactReturnsShop } from "./orders-lookup.server";
import { removeShopLoyalty } from "./loyalty/program.server";
import { removeShopUsage } from "./usage.server";

export async function removeShopData(shop: string) {
  await db.session.deleteMany({ where: { shop } });
  await redactShop(shop);
  await redactReturnsShop(shop);
  await redactReviewerEmails(shop);
  await db.featureRequest.deleteMany({ where: { shop } });
  await removeShopMcp(shop);
  await removeShopTracking(shop);
  await removeShopAb(shop);
  await removeShopTrackCodes(shop);
  await removeShopLoyalty(shop);
  await removeShopUsage(shop);
}
