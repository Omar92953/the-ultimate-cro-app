/**
 * Refer a merchant: each shop gets one personal code, made from its store handle plus a few random
 * letters (so it can't be guessed from the handle alone) and kept in the shop's own store
 * ($app:cro_design "referral"). The link and reward text come from plans.ts → REFERRAL.
 *
 * TODO(Omar): rewards aren't applied yet. How (private plan or discount in Shopify App Pricing,
 * applied in the Partner Dashboard or with Shopify CLI) and how a referred install is matched to a
 * code are still to be decided — for now codes are only generated, stored and shown.
 */
import { randomBytes } from "node:crypto";
import { gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { REFERRAL } from "./plans";

export type Referral = { code: string; link: string; reward: string; howItWorks: string };

export function makeCode(shop: string, random = randomBytes(3).toString("hex")) {
  const handle = shop.replace(/\.myshopify\.com$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "store";
  return `${handle}-${random}`;
}

export async function getReferral(admin: AdminClient, shop: string): Promise<Referral> {
  const data = await gql(admin, `#graphql
    query CroReferral { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "referral" }) { field(key: "config") { value } } }`);
  let code: string | null = null;
  try {
    const v = JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
    if (v && typeof v.code === "string") code = v.code;
  } catch {
    // Unreadable: make a new one below.
  }
  if (!code) {
    code = makeCode(shop);
    await upsert(admin, "$app:cro_design", "referral", { config: JSON.stringify({ code, created: new Date().toISOString() }) });
  }
  return { code, link: `${REFERRAL.listingUrl}?ref=${encodeURIComponent(code)}`, reward: REFERRAL.reward, howItWorks: REFERRAL.howItWorks };
}
