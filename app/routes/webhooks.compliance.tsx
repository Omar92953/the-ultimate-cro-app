import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Mandatory privacy webhooks (customers/data_request, customers/redact, shop/redact).
 *
 * authenticate.webhook verifies the HMAC signature and answers 401 on a bad one, which the
 * App Store review checks. This app stores no customer data at all — merchant configuration
 * lives in the shop's own metaobjects and the database only holds sessions — so:
 *  - customers/data_request: nothing to report
 *  - customers/redact: nothing to delete
 *  - shop/redact (48h after uninstall): delete any remaining sessions for the shop
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} compliance webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
      break;
    case "SHOP_REDACT":
      await db.session.deleteMany({ where: { shop } });
      break;
    default:
      break;
  }

  return new Response(null, { status: 200 });
};
