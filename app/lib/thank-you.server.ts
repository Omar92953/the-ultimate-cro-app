/**
 * Reads and saves the thank-you page modules (see thank-you.ts) as two shop metafields:
 * `$app:thank_you_editor` (everything, for the app) and `$app:thank_you` (what the extension shows).
 * Also creates the "next order" discount code on request.
 */
import { AdminError, gql, type AdminClient } from "./admin.server";
import { toExtensionConfig, withThankYouDefaults, type ThankYouConfig } from "./thank-you";

export async function getThankYou(admin: AdminClient) {
  const data = await gql(
    admin,
    `#graphql
    query CroThankYou {
      shop {
        id
        currencyCode
        editor: metafield(namespace: "$app", key: "thank_you_editor") { value }
      }
      collections(first: 50, sortKey: TITLE) { nodes { handle title } }
    }`,
  );
  let raw: unknown = null;
  try {
    raw = JSON.parse(data.shop.editor?.value ?? "null");
  } catch {
    raw = null;
  }
  return {
    shopId: data.shop.id as string,
    currency: data.shop.currencyCode as string,
    saved: !!data.shop.editor,
    config: withThankYouDefaults(raw),
    collections: [{ handle: "all", title: "All products" }, ...(data.collections.nodes as { handle: string; title: string }[]).filter((c) => c.handle !== "all")],
  };
}

export async function saveThankYou(admin: AdminClient, shopId: string, raw: unknown): Promise<ThankYouConfig> {
  const config = withThankYouDefaults(raw);
  const set = await gql(
    admin,
    `#graphql
    mutation CroThankYouSave($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) { userErrors { field message } }
    }`,
    {
      metafields: [
        { ownerId: shopId, namespace: "$app", key: "thank_you_editor", type: "json", value: JSON.stringify(config) },
        { ownerId: shopId, namespace: "$app", key: "thank_you", type: "json", value: JSON.stringify(toExtensionConfig(config)) },
      ],
    },
  );
  const errors = set.metafieldsSet.userErrors as { message: string }[];
  if (errors.length) throw new AdminError(errors.map((e) => e.message).join(" "));
  return config;
}

/** A percentage code for the next order: once per customer, on everything, no end date. */
export async function createNextOrderCode(admin: AdminClient, code: string, percent: number) {
  const clean = code.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
  if (!clean) throw new AdminError("Enter a code first.");
  const pct = Math.min(100, Math.max(1, Math.round(percent)));
  const data = await gql(
    admin,
    `#graphql
    mutation CroNextOrderCode($discount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $discount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`,
    {
      discount: {
        title: `Thank-you code ${clean} (CRO Toolbox)`,
        code: clean,
        startsAt: new Date().toISOString(),
        appliesOncePerCustomer: true,
        context: { all: "ALL" },
        customerGets: { value: { percentage: pct / 100 }, items: { all: true } },
        combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true },
      },
    },
  );
  const errors = data.discountCodeBasicCreate.userErrors as { message: string }[];
  if (errors.length) throw new AdminError(errors.map((e) => e.message).join(" "));
  return clean;
}
