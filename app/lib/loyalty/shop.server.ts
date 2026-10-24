/**
 * The Points shop (Omar, 2026-10-24): a member gets a product for points, or points plus money. The points go first
 * (the strict ledger spend, all or nothing), then Shopify makes a one use code for this customer only, for that
 * variant: its price now minus the money part, on one item. The storefront adds the variant to the cart and applies
 * the code. If Shopify refuses, the points come back. Each purchase is kept in LoyaltyReward (kind "shop").
 * Products sold only with points have a checkout guard, and can be hidden from collections and search (`syncPointsShop`).
 */
import { randomBytes } from "node:crypto";
import db from "../../db.server";
import { AdminError, gql, type AdminClient } from "../admin.server";
import { syncPointsGuard } from "../checkout-rules.server";
import { publishToOnlineStore } from "../bundle-product.server";
import { canSeeItem, type LoyaltyConfig, type ShopItem } from "./config";
import { NotEnoughPoints, record } from "./program.server";
import { notify } from "./mailer.server";
import { LOYALTY_TAG } from "./rewards.server";

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The Shopify discount input for a Points shop code (exported for the tests): `amount` off one item of the variant. */
export function shopDiscountInput(item: ShopItem, code: string, customerGid: string, variantGid: string, amount: number, endsAt: Date) {
  return {
    title: `Points shop: ${item.product.title} (${code})`,
    code,
    startsAt: new Date().toISOString(),
    endsAt: endsAt.toISOString(),
    usageLimit: 1,
    appliesOncePerCustomer: true,
    tags: [LOYALTY_TAG],
    context: { customers: { add: [customerGid] } },
    customerGets: { value: { discountAmount: { amount: amount.toFixed(2), appliesOnEachItem: false } }, items: { products: { productVariantsToAdd: [variantGid] } } },
    // Like the rewards: combines with the app's own product discounts (upsells and bundles).
    combinesWith: { productDiscounts: true, orderDiscounts: false, shippingDiscounts: true },
  };
}

/** The variant as Shopify has it now (never what the browser says): its product, price and whether it can be sold. */
async function readVariant(admin: AdminClient, variantGid: string) {
  const d = await gql(admin, `#graphql
    query CroPointsVariant($id: ID!) { productVariant(id: $id) { id price availableForSale product { id status } } }`, { id: variantGid });
  const v = d?.productVariant;
  return v ? { productId: String(v.product?.id ?? ""), status: String(v.product?.status ?? ""), price: Number(v.price), available: !!v.availableForSale } : null;
}

/** How often this member got this product (purchases Shopify refused don't count) and the next purchase's number. */
async function bought(shop: string, memberId: number, itemId: string) {
  const [tries, back] = await Promise.all([
    db.loyaltyEvent.count({ where: { shop, memberId, kind: "shop", dedupe: { startsWith: `shop:${memberId}:${itemId}:` } } }),
    db.loyaltyEvent.count({ where: { shop, memberId, kind: "redeem_back", dedupe: { startsWith: `shop-back:${memberId}:${itemId}:` } } }),
  ]);
  return { count: tries - back, next: tries + 1 };
}

export type Bought = { id: number; title: string; kind: "shop"; code: string; expiresAt: string; variant: string };

/**
 * A member gets a Points shop product. Throws NotEnoughPoints, or an AdminError for anything the member can't do
 * (or when Shopify refuses: the points are given back).
 */
export async function buy(admin: AdminClient, shop: string, c: LoyaltyConfig, memberId: number, itemId: string, variant: string): Promise<Bought> {
  const item = c.shop.on ? c.shop.items.find((x) => x.id === itemId && x.on) : undefined;
  if (!item) throw new AdminError("This product isn't available any more.");
  const m = await db.loyaltyMember.findFirst({ where: { id: memberId, shop } });
  if (!m || m.blocked) throw new AdminError("This account can't use rewards.");
  if (!canSeeItem(item, m.points)) throw new AdminError("This product isn't available any more.");
  if (m.points < item.points) throw new NotEnoughPoints();
  const vid = /^\d+$/.test(variant) ? variant : /^gid:\/\/shopify\/ProductVariant\/(\d+)$/.exec(variant)?.[1];
  if (!vid) throw new AdminError("Choose an option first.");
  const variantGid = `gid://shopify/ProductVariant/${vid}`;
  const v = await readVariant(admin, variantGid);
  if (!v || v.productId !== item.product.id || !["ACTIVE", "UNLISTED"].includes(v.status)) throw new AdminError("This option isn't part of this product.");
  if (!v.available) throw new AdminError("This option is sold out.");
  const amount = round2(v.price - item.money);
  if (!(amount > 0)) throw new AdminError("This product can't be bought with points right now.");
  const { count, next } = await bought(shop, m.id, item.id);
  if (item.limit && count >= item.limit) throw new AdminError(item.limit === 1 ? "You already got this product." : `You already got this product ${item.limit} times.`);

  // The purchase's number is in the dedupe key, so two clicks at once can't pass the limit.
  const taken = await record(shop, m.id, { kind: "shop", points: -item.points, note: item.product.title, dedupe: `shop:${m.id}:${item.id}:${next}`, strict: true });
  if (!taken) throw new AdminError("Please try again.");
  try {
    const code = `PTS-${randomBytes(4).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + c.shop.days * DAY);
    const data = await gql(admin, `#graphql
      mutation CroPointsCode($d: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } } }`, { d: shopDiscountInput(item, code, `gid://shopify/Customer/${m.customerId}`, variantGid, amount, expiresAt) });
    const out = data.discountCodeBasicCreate;
    const errors = (out?.userErrors ?? []) as { message: string }[];
    if (errors.length || !out?.codeDiscountNode?.id) throw new AdminError(errors[0]?.message ?? "Shopify did not make the code.");
    const row = await db.loyaltyReward.create({ data: { shop, memberId: m.id, rewardId: item.id, kind: "shop", title: item.product.title, points: item.points, value: amount, code, discountId: out.codeDiscountNode.id, expiresAt } });
    await notify(shop, c, m.id, "reward", { reward: item.product.title, code, date: expiresAt.toISOString() }, `reward:${row.id}`);
    return { id: row.id, title: item.product.title, kind: "shop", code, expiresAt: expiresAt.toISOString(), variant: vid };
  } catch (e) {
    // Shopify refused: the member gets the points back at once.
    await record(shop, m.id, { kind: "redeem_back", points: item.points, note: item.product.title, dedupe: `shop-back:${m.id}:${item.id}:${next}` });
    throw e instanceof AdminError ? e : new AdminError("The product could not be added. Your points were returned.");
  }
}

/* ------------------------------------------------------- only with points -- */
/** What the app did in the store for the Points shop (LoyaltyProgram.state): the guard is made, products it unlisted. */
type ShopState = { pointsGuard?: boolean; pointsHidden?: string[]; pointsCollection?: string };
async function readState(shop: string): Promise<Record<string, unknown> & ShopState> {
  const row = await db.loyaltyProgram.findUnique({ where: { shop }, select: { state: true } });
  try {
    const s = JSON.parse(row?.state ?? "{}");
    return s && typeof s === "object" ? s : {};
  } catch {
    return {};
  }
}
async function saveState(shop: string, patch: ShopState) {
  // Read again just before writing: other parts (referrals, emails) keep their ids in the same place.
  const s = await readState(shop);
  await db.loyaltyProgram.updateMany({ where: { shop }, data: { state: JSON.stringify({ ...s, ...patch }) } });
}

/**
 * After every save and plan change (storefront.server.ts publishLoyalty): the points guard lists the products sold only
 * with points (with their money part), and those set to "Hide it from collections and search" are UNLISTED. A product
 * goes back to ACTIVE when that is switched off, the product is removed, the shop or program is off, or the plan no
 * longer has loyalty, but only if the app unlisted it (a product the merchant unlisted stays as it is). With "Keep a
 * Points shop collection", the app's collection holds the products that are on and not hidden (`syncCollection`).
 */
export async function syncPointsShop(admin: AdminClient, shop: string, c: LoyaltyConfig, running: boolean) {
  const live = running && c.shop.on ? c.shop.items.filter((x) => x.on && x.only) : [];
  const state = await readState(shop);
  const hidden = new Set(Array.isArray(state.pointsHidden) ? state.pointsHidden.map(String) : []);
  if (live.length || state.pointsGuard) {
    await syncPointsGuard(admin, live.map((x) => ({ p: x.product.id, m: x.money })));
  }
  const want = new Set(live.filter((x) => x.unlisted).map((x) => x.product.id));
  const ids = [...new Set([...want, ...hidden])];
  if (ids.length) {
    const d = await gql(admin, `#graphql
      query CroPointsStatus($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id status } } }`, { ids });
    const status = new Map<string, string>(((d?.nodes ?? []) as ({ id: string; status: string } | null)[]).flatMap((n) => (n?.id ? [[n.id, n.status] as [string, string]] : [])));
    const set = async (id: string, to: "ACTIVE" | "UNLISTED") => {
      const r = await gql(admin, `#graphql
        mutation CroPointsListed($p: ProductUpdateInput!) { productUpdate(product: $p) { product { id } userErrors { field message } } }`, { p: { id, status: to } });
      const errors = (r?.productUpdate?.userErrors ?? []) as { message: string }[];
      if (errors.length) throw new AdminError(errors[0].message);
    };
    for (const id of ids) {
      const now = status.get(id);
      if (!now) hidden.delete(id); // The product was deleted.
      else if (want.has(id) && now === "ACTIVE") {
        await set(id, "UNLISTED");
        hidden.add(id);
      } else if (!want.has(id) && hidden.has(id)) {
        if (now === "UNLISTED") await set(id, "ACTIVE");
        hidden.delete(id);
      }
    }
  }
  await saveState(shop, { pointsGuard: live.length > 0, pointsHidden: [...hidden] });
  if (c.shop.collection || state.pointsCollection) await saveState(shop, { pointsCollection: await syncCollection(admin, c, running, state.pointsCollection ?? "") });
}

/**
 * The "Points shop" collection (Omar, 2026-10-24): a manual collection the app makes and publishes to the Online Store,
 * holding the shop's products that are on and not hidden, so the merchant can link it in a menu. While the shop or the
 * program is off it stays, empty (menu links keep working); turning the option off deletes it. Returns its id ("" none).
 */
async function syncCollection(admin: AdminClient, c: LoyaltyConfig, running: boolean, id: string) {
  if (!c.shop.collection) {
    if (id) {
      const r = await gql(admin, `#graphql
        mutation CroPointsCollectionDelete($input: CollectionDeleteInput!) { collectionDelete(input: $input) { userErrors { field message } } }`, { input: { id } });
      const errors = (r?.collectionDelete?.userErrors ?? []) as { message: string }[];
      // Already deleted in Shopify: nothing to do.
      if (errors.length && !/not exist|not found/i.test(errors[0].message)) throw new AdminError(errors[0].message);
    }
    return "";
  }
  const want = running && c.shop.on ? [...new Set(c.shop.items.filter((x) => x.on && !x.unlisted).map((x) => x.product.id))] : [];
  const now = id
    ? await gql(admin, `#graphql
        query CroPointsCollection($id: ID!) { collection(id: $id) { id products(first: 250) { nodes { id } } } }`, { id })
    : null;
  if (!now?.collection) {
    const r = await gql(admin, `#graphql
      mutation CroPointsCollectionCreate($c: CollectionCreateInput!) { collectionCreate(collection: $c) { collection { id } userErrors { field message } } }`, { c: { title: "Points shop", handle: "points-shop", descriptionHtml: "" } });
    const errors = (r?.collectionCreate?.userErrors ?? []) as { message: string }[];
    const made = r?.collectionCreate?.collection?.id as string | undefined;
    if (errors.length || !made) throw new AdminError(errors[0]?.message ?? "Shopify did not make the collection.");
    await publishToOnlineStore(admin, made);
    id = made;
  }
  const have = new Set(((now?.collection?.products?.nodes ?? []) as { id: string }[]).map((n) => n.id));
  const add = want.filter((p) => !have.has(p)), remove = [...have].filter((p) => !want.includes(p));
  if (add.length) {
    const r = await gql(admin, `#graphql
      mutation CroPointsCollectionAdd($id: ID!, $ids: [ID!]!) { collectionAddProducts(id: $id, productIds: $ids) { userErrors { field message } } }`, { id, ids: add });
    const errors = (r?.collectionAddProducts?.userErrors ?? []) as { message: string }[];
    if (errors.length) throw new AdminError(errors[0].message);
  }
  if (remove.length) {
    const r = await gql(admin, `#graphql
      mutation CroPointsCollectionRemove($id: ID!, $ids: [ID!]!) { collectionRemoveProducts(id: $id, productIds: $ids) { userErrors { field message } } }`, { id, ids: remove });
    const errors = (r?.collectionRemoveProducts?.userErrors ?? []) as { message: string }[];
    if (errors.length) throw new AdminError(errors[0].message);
  }
  return id;
}

export { NotEnoughPoints };
