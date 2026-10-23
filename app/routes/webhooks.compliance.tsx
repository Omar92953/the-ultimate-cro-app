import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { removeShopData } from "../lib/shop-data.server";
import { recentForOrders, redactRecent } from "../lib/boosters.server";
import { alertsForEmail, redactEmail } from "../lib/stock.server";
import { redactReviewerEmail, reviewerEmailsFor } from "../lib/reviewer-email.server";
import { redactOrders, redactReturnsEmail, returnsForEmail } from "../lib/orders-lookup.server";
import { loyaltyHeldFor, redactLoyaltyCustomer } from "../lib/loyalty/program.server";

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
      const gone =
        (email ? (await redactEmail(shop, email)).count + (await redactReturnsEmail(shop, email)).count + (await redactReviewerEmail(shop, email)).count : 0) +
        (await redactLoyaltyCustomer(shop, String(payload?.customer?.id ?? ""), email)) +
        // Kept by order too: a customer who changed their email still has their return requests and Track page codes removed.
        (await redactOrders(shop, payload?.orders_to_redact ?? []));
      console.log(`[redact] ${shop}: removed ${removed} sales pop-up entries and ${gone} other rows`);
      break;
    }
    case "SHOP_REDACT":
      // Every table with a shop column (lib/shop-data.server.ts, checked by test/app/shop-data.test.ts).
      await removeShopData(shop);
      break;
    default:
      break;
  }

  return new Response(null, { status: 200 });
};
