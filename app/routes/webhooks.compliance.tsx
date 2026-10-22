import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { removeShopMcp } from "../lib/mcp/auth.server";
import { removeShopTracking } from "../lib/tracking/tracking.server";
import { removeShopAb } from "../lib/ab-tests.server";
import { removeShopTrackCodes } from "../lib/track-sell.server";
import db from "../db.server";
import { recentForOrders, redactRecent } from "../lib/boosters.server";
import { alertsForEmail, redactEmail, redactShop } from "../lib/stock.server";
import { redactReviewerEmail, redactReviewerEmails, reviewerEmailsFor } from "../lib/reviewer-email.server";
import { redactReturnsEmail, redactReturnsShop, returnsForEmail } from "../lib/orders-lookup.server";
import { loyaltyHeldFor, redactLoyaltyCustomer, removeShopLoyalty } from "../lib/loyalty/program.server";

/**
 * Mandatory privacy webhooks (customers/data_request, customers/redact, shop/redact).
 *
 * authenticate.webhook verifies the HMAC signature and answers 401 on a bad one, which the
 * App Store review checks. What the app keeps about customers: only the sales pop-up list
 * ($app:cro_recent) — product, purchase time, a one-way fingerprint of the order id and, if the merchant turned it on, the
 * shipping city; and back-in-stock requests (StockAlert: the email a shopper typed and the variant
 * they want); return requests (order number, email, items, reason); the email a merchant typed to check a review against orders; and loyalty
 * members (customer id, email, points and their history). No names or addresses. So:
 *  - customers/data_request: count (never log) what's held for the listed orders and the customer's email
 *  - customers/redact: remove those orders from the list and that email's back-in-stock requests, return requests and reviewer emails
 *  - shop/redact (48h after uninstall): delete sessions, back-in-stock requests and reviewer emails for the shop;
 *    the shop's app-owned metaobjects go with the app
 * An error answers 500, so Shopify retries the delivery.
 */
/** A request without a valid signature (a missing header too, which the library answers with 400) is a 401. */
async function verified(request: Request) {
  try {
    return await authenticate.webhook(request);
  } catch (error) {
    if (error instanceof Response && error.status === 400) throw new Response("Unauthorized", { status: 401 });
    throw error;
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await verified(request);
  console.log(`Received ${topic} compliance webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      const held = admin ? await recentForOrders(admin, payload?.orders_requested ?? []) : [];
      const email = String(payload?.customer?.email ?? "");
      const alerts = email ? await alertsForEmail(shop, email) : [];
      const returns = email ? await returnsForEmail(shop, email) : [];
      const reviewers = email ? await reviewerEmailsFor(shop, email) : [];
      const loyalty = await loyaltyHeldFor(shop, String(payload?.customer?.id ?? ""), email);
      // Counts only: customer data never goes into the server logs.
      console.log(`[data_request] ${shop}: ${held.length} sales pop-up entries, ${alerts.length} back-in-stock requests, ${returns.length} return requests, ${reviewers.length} reviewer emails, ${loyalty.members} loyalty members with ${loyalty.events} point changes and ${loyalty.referrals} referrals and ${loyalty.emails} loyalty emails`);
      break;
    }
    case "CUSTOMERS_REDACT": {
      const removed = admin ? await redactRecent(admin, payload?.orders_to_redact ?? []) : 0;
      const email = String(payload?.customer?.email ?? "");
      const gone = (email ? (await redactEmail(shop, email)).count + (await redactReturnsEmail(shop, email)).count + (await redactReviewerEmail(shop, email)).count : 0) + (await redactLoyaltyCustomer(shop, String(payload?.customer?.id ?? ""), email));
      console.log(`[redact] ${shop}: removed ${removed} sales pop-up entries, ${gone} back-in-stock requests`);
      break;
    }
    case "SHOP_REDACT":
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
      break;
    default:
      break;
  }

  return new Response(null, { status: 200 });
};
