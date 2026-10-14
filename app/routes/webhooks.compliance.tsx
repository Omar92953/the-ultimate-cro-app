import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { recentForOrders, redactRecent } from "../lib/boosters.server";
import { alertsForEmail, redactEmail, redactShop } from "../lib/stock.server";
import { redactReturnsEmail, redactReturnsShop, returnsForEmail } from "../lib/orders-lookup.server";

/**
 * Mandatory privacy webhooks (customers/data_request, customers/redact, shop/redact).
 *
 * authenticate.webhook verifies the HMAC signature and answers 401 on a bad one, which the
 * App Store review checks. What the app keeps about customers: only the sales pop-up list
 * ($app:cro_recent) — product, purchase time, order id and, if the merchant turned it on, the
 * shipping city; and back-in-stock requests (StockAlert: the email a shopper typed and the variant
 * they want); and return requests (order number, email, items, reason). No names or addresses. So:
 *  - customers/data_request: count (never log) what's held for the listed orders and the customer's email
 *  - customers/redact: remove those orders from the list and that email's back-in-stock requests
 *  - shop/redact (48h after uninstall): delete sessions and back-in-stock requests for the shop;
 *    the shop's app-owned metaobjects go with the app
 * An error answers 500, so Shopify retries the delivery.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);
  console.log(`Received ${topic} compliance webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      const held = admin ? await recentForOrders(admin, payload?.orders_requested ?? []) : [];
      const email = String(payload?.customer?.email ?? "");
      const alerts = email ? await alertsForEmail(shop, email) : [];
      const returns = email ? await returnsForEmail(shop, email) : [];
      // Counts only: customer data never goes into the server logs.
      console.log(`[data_request] ${shop}: ${held.length} sales pop-up entries, ${alerts.length} back-in-stock requests, ${returns.length} return requests`);
      break;
    }
    case "CUSTOMERS_REDACT": {
      const removed = admin ? await redactRecent(admin, payload?.orders_to_redact ?? []) : 0;
      const email = String(payload?.customer?.email ?? "");
      const gone = email ? (await redactEmail(shop, email)).count + (await redactReturnsEmail(shop, email)).count : 0;
      console.log(`[redact] ${shop}: removed ${removed} sales pop-up entries, ${gone} back-in-stock requests`);
      break;
    }
    case "SHOP_REDACT":
      await db.session.deleteMany({ where: { shop } });
      await redactShop(shop);
      await redactReturnsShop(shop);
      break;
    default:
      break;
  }

  return new Response(null, { status: 200 });
};
