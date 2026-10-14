/* eslint-disable @typescript-eslint/no-explicit-any -- raw Admin API JSON; operations are schema-checked by `npm run graphql-codegen` */
/**
 * Bundle products ("kits"): a bundle that is its own product — its own page, photos, price and SKU,
 * in collections, search and Google Shopping — built on Shopify's own fixed bundles
 * (productBundleCreate / productBundleUpdate):
 *  - Shopify works out the kit's stock from its items (sold out as soon as one item runs out),
 *  - the order lists the real items, so stock goes down on each and fulfillment sees what to pack,
 *  - each item's options (size, colour…) become options of the kit, so the shopper picks them on
 *    the kit's page with the theme's own selectors.
 * The app sets each kit variant's price: a % off the items' total (so a bigger size costs more)
 * or one fixed price, and optionally the items' total as the compare-at price ("was … now …").
 * Prices are recalculated when an item's price changes (products/update webhook).
 *
 * The kit list lives in $app:cro_design "kits" ({ list: Kit[] }).
 */
import { AdminError, gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { kitVariantPrice, validateKit, type Kit, type KitItem, type KitRow } from "./kits";
import { publishToOnlineStore } from "./bundle-product.server";

export { blankKit, validateKit, type Kit, type KitItem, type KitRow } from "./kits";

/* -------------------------------------------------------------- storage -- */

async function readList(admin: AdminClient): Promise<Kit[]> {
  const data = await gql(admin, `#graphql
    query CroKits { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "kits" }) { field(key: "config") { value } } }`);
  try {
    const v = JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
    return Array.isArray(v?.list) ? v.list : [];
  } catch {
    return [];
  }
}

async function writeList(admin: AdminClient, list: Kit[]) {
  await upsert(admin, "$app:cro_design", "kits", { config: JSON.stringify({ list }) });
}

type ProductNode = {
  id: string;
  handle: string;
  status: string;
  featuredMedia: { preview: { image: { url: string } | null } | null } | null;
  variants: { nodes: { id: string; title: string; price: string; compareAtPrice: string | null; productVariantComponents: { nodes: { quantity: number; productVariant: { id: string; price: string } }[] } }[] };
};

async function kitProducts(admin: AdminClient, ids: string[]): Promise<Map<string, ProductNode>> {
  const out = new Map<string, ProductNode>();
  for (let i = 0; i < ids.length; i += 25) {
    const data = await gql(admin, `#graphql
      query CroKitProducts($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            handle
            status
            featuredMedia { preview { image { url } } }
            variants(first: 100) {
              pageInfo { hasNextPage endCursor }
              nodes { id title price compareAtPrice productVariantComponents(first: 30) { nodes { quantity productVariant { id price } } } }
            }
          }
        }
      }`, { ids: ids.slice(i, i + 25) });
    for (const n of data.nodes ?? []) if (n?.id) out.set(n.id, n);
  }
  // Kits with many option combinations: read the rest of their variants, 100 at a time.
  for (const p of out.values()) {
    let page = (p.variants as { pageInfo?: { hasNextPage: boolean; endCursor: string | null } }).pageInfo;
    while (page?.hasNextPage && page.endCursor) {
      const more: any = await gql(admin, `#graphql
        query CroKitVariants($id: ID!, $after: String) {
          product(id: $id) {
            variants(first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes { id title price compareAtPrice productVariantComponents(first: 30) { nodes { quantity productVariant { id price } } } }
            }
          }
        }`, { id: p.id, after: page.endCursor });
      const v = more.product?.variants;
      if (!v) break;
      p.variants.nodes.push(...v.nodes);
      page = v.pageInfo;
    }
  }
  return out;
}

/** Every kit, with its product's state. Kits whose product was deleted in Shopify are left out. */
export async function listKits(admin: AdminClient): Promise<KitRow[]> {
  const list = (await readList(admin)).filter((k) => k.productId);
  const products = await kitProducts(admin, list.map((k) => k.productId!));
  return list.flatMap((k) => {
    const p = products.get(k.productId!);
    if (!p) return [];
    return [{
      ...k,
      productId: p.id,
      handle: p.handle,
      status: p.status,
      image: p.featuredMedia?.preview?.image?.url ?? null,
      variants: p.variants.nodes.map((v) => ({ title: v.title, price: v.price, compareAtPrice: v.compareAtPrice })),
    }];
  });
}

/* -------------------------------------------------- creating / updating -- */

/** Each item's options become options of the kit ("Hoodie size"), with all their values. */
async function components(admin: AdminClient, items: KitItem[]) {
  const out = [];
  for (const item of items) {
    const data = await gql(admin, `#graphql
      query CroKitProductOptions($id: ID!) { product(id: $id) { id title options { id name optionValues { name } } } }`, { id: item.productId });
    const p = data.product;
    if (!p) throw new AdminError(`${item.title} no longer exists. Remove it from the bundle.`);
    const options = (p.options ?? []).filter((o: any) => !(o.name === "Title" && o.optionValues?.length === 1 && o.optionValues[0].name === "Default Title"));
    out.push({
      productId: item.productId,
      quantity: item.qty,
      optionSelections: options.map((o: any) => ({
        componentOptionId: o.id,
        // Unique per item, so two items with a "Size" each get their own selector.
        name: `${p.title} ${o.name}`.slice(0, 255),
        values: o.optionValues.map((v: any) => v.name),
      })),
    });
  }
  return out;
}

/** Shopify builds the bundle in the background: wait for it (a few seconds at most). */
async function waitFor(admin: AdminClient, operationId: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const data = await gql(admin, `#graphql
      query CroKitOperation($id: ID!) { productOperation(id: $id) { status ... on ProductBundleOperation { id product { id handle } userErrors { field message } } } }`, { id: operationId });
    const op = data.productOperation;
    if (op?.userErrors?.length) throw new AdminError(op.userErrors.map((e: any) => e.message).join("; "));
    if (op?.status === "COMPLETE") {
      if (!op.product?.id) throw new AdminError("Shopify didn't create the bundle product. Try again.");
      return op.product.id;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new AdminError("Shopify is still building the bundle product. Refresh in a minute.");
}

/**
 * Sets every kit variant's price from its items (and the compare-at price). Exported for the
 * products/update webhook: run again when an item's price changes.
 */
export async function applyKitPrices(admin: AdminClient, kit: Kit) {
  if (!kit.productId) return;
  const p = (await kitProducts(admin, [kit.productId])).get(kit.productId);
  if (!p) return;
  const variants = p.variants.nodes.map((v) => {
    const total = v.productVariantComponents.nodes.reduce((sum, c) => sum + Number(c.productVariant.price) * c.quantity, 0);
    return { id: v.id, ...kitVariantPrice(kit, total), old: { price: v.price, compareAtPrice: v.compareAtPrice } };
  });
  // Only write when something changed (the webhook calls this for every product update).
  const changed = variants.filter((v) => Number(v.old.price) !== Number(v.price) || (v.old.compareAtPrice ? Number(v.old.compareAtPrice) : null) !== (v.compareAtPrice ? Number(v.compareAtPrice) : null));
  if (!changed.length) return;
  await gql(admin, `#graphql
    mutation CroKitPrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
    }`, { productId: kit.productId, variants: changed.map(({ id, price, compareAtPrice }) => ({ id, price, compareAtPrice })) });
}

export async function saveKit(admin: AdminClient, kit: Kit): Promise<Kit> {
  const errors = validateKit(kit);
  if (errors.length) throw new AdminError(errors.join(" "));
  const input = { title: kit.title.trim(), components: await components(admin, kit.items) };
  let productId = kit.productId;
  if (productId) {
    const data = await gql(admin, `#graphql
      mutation CroKitUpdate($input: ProductBundleUpdateInput!) {
        productBundleUpdate(input: $input) { productBundleOperation { id status } userErrors { field message } }
      }`, { input: { ...input, productId } });
    await waitFor(admin, data.productBundleUpdate.productBundleOperation.id);
  } else {
    const data = await gql(admin, `#graphql
      mutation CroKitCreate($input: ProductBundleCreateInput!) {
        productBundleCreate(input: $input) { productBundleOperation { id status } userErrors { field message } }
      }`, { input });
    productId = await waitFor(admin, data.productBundleCreate.productBundleOperation.id);
    await finishNewKit(admin, productId, kit);
  }
  const saved: Kit = { ...kit, productId, title: input.title };
  const list = await readList(admin);
  await writeList(admin, [...list.filter((k) => k.productId !== productId), saved]);
  await applyKitPrices(admin, saved);
  return saved;
}

const escHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Shopify creates bundle products as drafts with no picture or description. Make a new kit ready to
 * sell: the first item's picture, a "What's inside" list, Active and published to the Online Store.
 * If a step fails (e.g. the publishing permission isn't approved yet), the kit stays a draft and the
 * editor says so; the kit itself is saved either way.
 */
async function finishNewKit(admin: AdminClient, productId: string, kit: Kit) {
  const image = kit.items.find((i) => i.image)?.image ?? null;
  const inside = kit.items.map((i) => `<li>${i.qty > 1 ? `${i.qty} × ` : ""}${escHtml(i.title)}</li>`).join("");
  try {
    const data = await gql(admin, `#graphql
      mutation CroKitFinish($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
        productUpdate(product: $product, media: $media) { product { id } userErrors { field message } }
      }`, {
      product: { id: productId, status: "ACTIVE", descriptionHtml: `<p>What's inside:</p><ul>${inside}</ul>` },
      media: image ? [{ originalSource: image, mediaContentType: "IMAGE", alt: kit.title }] : [],
    });
    if (data.productUpdate?.userErrors?.length) throw new Error(data.productUpdate.userErrors.map((e: any) => e.message).join(" "));
    await publishToOnlineStore(admin, productId);
  } catch (e) {
    console.error("Finishing a new bundle product:", e);
  }
}

/** Removes the kit from the app and deletes its product in Shopify (the items are untouched). */
export async function deleteKit(admin: AdminClient, productId: string) {
  const list = await readList(admin);
  await writeList(admin, list.filter((k) => k.productId !== productId));
  try {
    await gql(admin, `#graphql
      mutation CroKitDelete($input: ProductDeleteInput!) { productDelete(input: $input) { deletedProductId userErrors { field message } } }`, { input: { id: productId } });
  } catch {
    // Already deleted in Shopify.
  }
}

/** products/update webhook: an item's price changed → reprice the kits that contain it. */
export async function repriceKitsWith(admin: AdminClient, productId: string) {
  const kits = (await readList(admin)).filter((k) => k.items.some((i) => i.productId === productId));
  for (const kit of kits) await applyKitPrices(admin, kit);
  return kits.length;
}

/** The product ids of every kit (cheap: no product reads). */
export async function listKitIds(admin: AdminClient) {
  return (await readList(admin)).flatMap((k) => (k.productId ? [k.productId] : []));
}
