/**
 * What the app creates for bundles so merchants don't have to:
 *  - the bundle product of a mix & match bundle: a real product (title, picture, starting price)
 *    that the builder sits on and that checkout merges the picks into. Its stock isn't tracked (the
 *    picked items' own stock goes down) and it's published to the Online Store.
 *  - a store page (/pages/…) for bundles built on their own page.
 *  - publishing for bundle products (kits), which Shopify creates as drafts.
 * Needs the write_publications and write_online_store_pages scopes (shopify.app.toml).
 */
import { AdminError, gql, type AdminClient } from "./admin.server";

export type BundleProductInput = {
  title: string;
  /** A picture to copy onto the product (any public image URL, e.g. from Content → Files). */
  imageUrl?: string | null;
  /** The starting price shown before anything is picked (store currency). */
  price: number;
  descriptionHtml?: string;
  /** Keep it out of search and sitemaps (the bundle lives on a store page instead). */
  hidden?: boolean;
  /** A draft product: not active, not on the Online Store, so nothing shows until it is activated (the assistant's drafts). */
  draft?: boolean;
};

const userErrors = (errors: { field?: string[] | null; message: string }[] | undefined | null) => {
  if (errors?.length) throw new AdminError(errors.map((e) => e.message).join(" "));
};

/** Missing new permission: say so plainly instead of Shopify's raw access error. */
export function isScopeError(e: unknown) {
  return /access denied|not approved|write_publications|write_online_store_pages|ACCESS_DENIED|required access/i.test(String((e as Error)?.message ?? e));
}
export const SCOPE_MESSAGE = "CRO Toolbox needs one more permission for this. Open the app from Apps and approve the new permission, then try again.";

/** The Online Store's publication (where products must be published to show on the store). */
async function onlineStorePublication(admin: AdminClient): Promise<string> {
  const data = await gql(admin, `#graphql
    query CroPublications { publications(first: 25) { nodes { id channels(first: 5) { nodes { handle name } } } } }`);
  type Pub = { id: string; channels?: { nodes?: { handle?: string | null; name?: string | null }[] } | null };
  const pub = ((data.publications?.nodes ?? []) as Pub[]).find((p) =>
    (p.channels?.nodes ?? []).some((c) => c.handle === "online_store" || /online store/i.test(c.name ?? "")),
  );
  if (!pub) throw new AdminError("The Online Store sales channel wasn't found, so the product can't be published.");
  return pub.id;
}

/** Publish a product to the Online Store (bundle products and kits). */
export async function publishToOnlineStore(admin: AdminClient, productId: string) {
  const publicationId = await onlineStorePublication(admin);
  const data = await gql(admin, `#graphql
    mutation CroPublish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) { userErrors { field message } }
    }`, { id: productId, input: [{ publicationId }] });
  userErrors(data.publishablePublish?.userErrors);
}

/** Price, untracked stock and "keep selling" on the product's only variant. */
async function setStartingPrice(admin: AdminClient, productId: string, price: number) {
  const data = await gql(admin, `#graphql
    query CroBundleVariant($id: ID!) { product(id: $id) { variants(first: 1) { nodes { id } } } }`, { id: productId });
  const variantId = data.product?.variants?.nodes?.[0]?.id;
  if (!variantId) return;
  const amount = (Math.round(Math.max(0, price) * 100) / 100).toFixed(2);
  const write = (inventory: Record<string, unknown>) =>
    gql(admin, `#graphql
      mutation CroBundleVariantSet($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
      }`, { productId, variants: [{ id: variantId, price: amount, ...inventory }] });
  // Stock isn't tracked (the picks' own stock goes down). If untracking needs a permission the app
  // doesn't have, selling past zero gives the same result.
  let res = await write({ inventoryItem: { tracked: false }, inventoryPolicy: "CONTINUE" });
  if (res.productVariantsBulkUpdate?.userErrors?.length) res = await write({ inventoryPolicy: "CONTINUE" });
  userErrors(res.productVariantsBulkUpdate?.userErrors);
}

/** Create, price and publish a bundle product; returns its id, title and handle. */
export async function createBundleProduct(admin: AdminClient, input: BundleProductInput) {
  const title = input.title.trim() || "Build your bundle";
  const data = await gql(admin, `#graphql
    mutation CroBundleProductCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
      productCreate(product: $product, media: $media) {
        product { id title handle featuredMedia { preview { image { url } } } }
        userErrors { field message }
      }
    }`, {
    product: {
      title,
      status: input.draft ? "DRAFT" : "ACTIVE",
      tags: ["cro-bundle"],
      descriptionHtml: input.descriptionHtml ?? "",
      ...(input.hidden ? { metafields: [{ namespace: "seo", key: "hidden", type: "number_integer", value: "1" }] } : {}),
    },
    media: input.imageUrl ? [{ originalSource: input.imageUrl, mediaContentType: "IMAGE", alt: title }] : [],
  });
  userErrors(data.productCreate?.userErrors);
  const product = data.productCreate?.product;
  if (!product?.id) throw new AdminError("Shopify didn't create the bundle product. Please try again.");
  await setStartingPrice(admin, product.id, input.price);
  if (!input.draft) await publishToOnlineStore(admin, product.id);
  return { id: product.id as string, title: product.title as string, handle: product.handle as string, image: product.featuredMedia?.preview?.image?.url ?? null };
}

/** Makes a draft bundle product live: Active and published to the Online Store. */
export async function activateBundleProduct(admin: AdminClient, productId: string) {
  const data = await gql(admin, `#graphql
    mutation CroBundleProductActivate($product: ProductUpdateInput!) {
      productUpdate(product: $product) { product { id } userErrors { field message } }
    }`, { product: { id: productId, status: "ACTIVE" } });
  userErrors(data.productUpdate?.userErrors);
  await publishToOnlineStore(admin, productId);
}

/** Keep an app-created bundle product's title, picture and starting price in step with the bundle. */
export async function updateBundleProduct(admin: AdminClient, productId: string, input: Partial<BundleProductInput>) {
  if (input.title !== undefined || input.imageUrl) {
    const data = await gql(admin, `#graphql
      mutation CroBundleProductUpdate($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
        productUpdate(product: $product, media: $media) { product { id } userErrors { field message } }
      }`, {
      product: { id: productId, ...(input.title !== undefined ? { title: input.title.trim() || "Build your bundle" } : {}) },
      media: input.imageUrl ? [{ originalSource: input.imageUrl, mediaContentType: "IMAGE", alt: input.title ?? "" }] : [],
    });
    userErrors(data.productUpdate?.userErrors);
  }
  if (input.price !== undefined) await setStartingPrice(admin, productId, input.price);
}

/** A published store page for a bundle (/pages/<handle>); the builder block shows it there. */
export async function createBundlePage(admin: AdminClient, title: string) {
  const data = await gql(admin, `#graphql
    mutation CroBundlePageCreate($page: PageCreateInput!) {
      pageCreate(page: $page) { page { id title handle } userErrors { field message } }
    }`, { page: { title: title.trim() || "Build your bundle", body: "", isPublished: true } });
  userErrors(data.pageCreate?.userErrors);
  const page = data.pageCreate?.page;
  if (!page?.id) throw new AdminError("Shopify didn't create the page. Please try again.");
  return { id: page.id as string, title: page.title as string, handle: page.handle as string };
}
