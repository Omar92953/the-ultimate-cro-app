/**
 * The Track page's real discount codes. A code is a Shopify discount code (discountCodeBasicCreate) with a
 * real expiry; "per order" makes one code for each order the first time its Track page is opened (the same
 * code every time after), "shared" keeps one code for everybody that the merchant renews by saving again.
 * Needs write_discounts (already granted).
 */
import { randomBytes } from "node:crypto";
import db from "../db.server";
import { AdminError, gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { DEFAULT_TRACK_SELL, withTrackSellDefaults, type NextOrder, type TrackSell } from "./track-sell";

export async function getTrackSell(admin: AdminClient): Promise<{ sell: TrackSell; saved: boolean }> {
  const d = await gql(admin, `#graphql
    query CroTrackSell { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "track_sell" }) { field(key: "config") { value } } }`);
  try {
    const raw = JSON.parse(d.metaobjectByHandle?.field?.value ?? "null");
    return { sell: withTrackSellDefaults(raw), saved: raw !== null };
  } catch {
    return { sell: DEFAULT_TRACK_SELL, saved: false };
  }
}

export async function saveTrackSell(admin: AdminClient, shop: string, raw: unknown): Promise<TrackSell> {
  const sell = withTrackSellDefaults(raw);
  if (sell.nextOrder.on && sell.nextOrder.mode === "shared") {
    const endsAt = await ensureSharedCode(admin, sell.nextOrder);
    await db.trackCode.deleteMany({ where: { shop, kind: "shared" } });
    await db.trackCode.create({ data: { shop, orderId: "shared", kind: "shared", code: sell.nextOrder.sharedCode, percent: sell.nextOrder.percent, minimum: sell.nextOrder.minimum, endsAt } });
  }
  await upsert(admin, "$app:cro_design", "track_sell", { config: JSON.stringify(sell) });
  return sell;
}

function discountInput(code: string, title: string, o: { percent: number; minimum: number; endsAt: Date; usageLimit: number | null }) {
  return {
    title,
    code,
    startsAt: new Date().toISOString(),
    endsAt: o.endsAt.toISOString(),
    ...(o.usageLimit ? { usageLimit: o.usageLimit } : {}),
    context: { all: "ALL" },
    customerGets: { value: { percentage: o.percent / 100 }, items: { all: true } },
    ...(o.minimum > 0 ? { minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: o.minimum.toFixed(2) } } } : {}),
    combinesWith: { productDiscounts: false, orderDiscounts: false, shippingDiscounts: true },
  };
}

/** The shared code, created or renewed (a code that already exists gets its end date moved), with its real expiry. */
export async function ensureSharedCode(admin: AdminClient, n: NextOrder): Promise<Date> {
  const endsAt = new Date(Date.now() + n.days * 86_400_000);
  try {
    await gql(admin, `#graphql
      mutation CroTrackCode($d: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message code } } }`, { d: discountInput(n.sharedCode, `Track page: ${n.sharedCode}`, { percent: n.percent, minimum: n.minimum, endsAt, usageLimit: null }) });
    return endsAt;
  } catch (e) {
    if (!(e instanceof AdminError) || !/taken|unique|already/i.test(e.message)) throw e;
  }
  // The code exists (a renewal): move its end date and refresh its terms.
  const found = await gql(admin, `#graphql
    query CroFindCode($code: String!) { codeDiscountNodeByCode(code: $code) { id } }`, { code: n.sharedCode });
  const id = found.codeDiscountNodeByCode?.id;
  if (!id) throw new AdminError("That code is already used by another discount. Choose another code.");
  await gql(admin, `#graphql
    mutation CroTrackCodeUpdate($id: ID!, $d: DiscountCodeBasicInput!) { discountCodeBasicUpdate(id: $id, basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } } }`, { id, d: discountInput(n.sharedCode, `Track page: ${n.sharedCode}`, { percent: n.percent, minimum: n.minimum, endsAt, usageLimit: null }) });
  return endsAt;
}

export type GivenCode = { code: string; percent: number; minimum: number; endsAt: string };

/**
 * The next order discount for this order, or null. Per order: the first call makes a single use code with a real expiry,
 * every later call returns the same one (until it expires: then none). Shared: the merchant's code while it has not expired.
 */
export async function nextOrderCode(admin: AdminClient, shop: string, orderId: string, n: NextOrder): Promise<GivenCode | null> {
  if (!n.on) return null;
  if (n.mode === "shared") {
    const row = await db.trackCode.findFirst({ where: { shop, kind: "shared", code: n.sharedCode }, orderBy: { endsAt: "desc" } });
    return row && row.endsAt > new Date() ? { code: row.code, percent: row.percent, minimum: row.minimum, endsAt: row.endsAt.toISOString() } : null;
  }
  const existing = await db.trackCode.findUnique({ where: { shop_orderId_kind: { shop, orderId, kind: "next" } } });
  if (existing) return existing.endsAt > new Date() ? { code: existing.code, percent: existing.percent, minimum: existing.minimum, endsAt: existing.endsAt.toISOString() } : null;
  const code = `NEXT-${randomBytes(4).toString("hex").toUpperCase()}`;
  const endsAt = new Date(Date.now() + n.days * 86_400_000);
  await gql(admin, `#graphql
    mutation CroTrackCode($d: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message code } } }`, { d: discountInput(code, `Track page: next order ${code}`, { percent: n.percent, minimum: n.minimum, endsAt, usageLimit: 1 }) });
  try {
    await db.trackCode.create({ data: { shop, orderId, kind: "next", code, percent: n.percent, minimum: n.minimum, endsAt } });
  } catch {
    // Two lookups at once: keep the first code that was saved.
    const first = await db.trackCode.findUnique({ where: { shop_orderId_kind: { shop, orderId, kind: "next" } } });
    if (first) return { code: first.code, percent: first.percent, minimum: first.minimum, endsAt: first.endsAt.toISOString() };
  }
  return { code, percent: n.percent, minimum: n.minimum, endsAt: endsAt.toISOString() };
}

export async function removeShopTrackCodes(shop: string) {
  await db.trackCode.deleteMany({ where: { shop } });
}
