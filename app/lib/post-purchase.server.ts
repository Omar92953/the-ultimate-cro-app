/**
 * Saves the post-purchase offer (see post-purchase.ts) and signs the shopper's one-click change.
 * The metafield needs a definition that checkout may read (storefront PUBLIC_READ); it's made once.
 */
import { jwtVerify, SignJWT } from "jose";
import { appSecret } from "./app-secret.server";
import { AdminError, gql, type AdminClient } from "./admin.server";
import { POST_PURCHASE_METAFIELD, offerChanges, withPostPurchaseDefaults, type PostPurchaseConfig } from "./post-purchase";

const { namespace, key } = POST_PURCHASE_METAFIELD;

export const appUrl = () => (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");

export async function getPostPurchase(admin: AdminClient) {
  const data = await gql(
    admin,
    `#graphql
    query CroPostPurchase {
      shop { id currencyCode offer: metafield(namespace: "cro_toolbox", key: "post_purchase") { value } }
    }`,
  );
  let raw: unknown = null;
  try {
    raw = JSON.parse(data.shop.offer?.value ?? "null");
  } catch {
    raw = null;
  }
  return { shopId: data.shop.id as string, currency: data.shop.currencyCode as string, saved: !!data.shop.offer, config: withPostPurchaseDefaults(raw) };
}

async function ensureDefinition(admin: AdminClient) {
  const data = await gql(
    admin,
    `#graphql
    mutation CroPostPurchaseDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) { createdDefinition { id } userErrors { code message } }
    }`,
    { definition: { name: "CRO Toolbox after-purchase offer", namespace, key, ownerType: "SHOP", type: "json", access: { storefront: "PUBLIC_READ" } } },
  );
  const errors = (data.metafieldDefinitionCreate.userErrors as { code: string; message: string }[]).filter((e) => e.code !== "TAKEN");
  if (errors.length) throw new AdminError(errors.map((e) => e.message).join(" "));
}

export async function savePostPurchase(admin: AdminClient, shopId: string, raw: unknown): Promise<PostPurchaseConfig> {
  const config = { ...withPostPurchaseDefaults(raw), url: appUrl() };
  await ensureDefinition(admin);
  const set = await gql(
    admin,
    `#graphql
    mutation CroPostPurchaseSave($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) { userErrors { field message } }
    }`,
    { metafields: [{ ownerId: shopId, namespace, key, type: "json", value: JSON.stringify(config) }] },
  );
  const errors = set.metafieldsSet.userErrors as { message: string }[];
  if (errors.length) throw new AdminError(errors.map((e) => e.message).join(" "));
  return config;
}

/** The app address changes in development (a new tunnel each run): keep the saved copy current. */
export async function refreshPostPurchaseUrl(admin: AdminClient) {
  const { shopId, saved, config } = await getPostPurchase(admin);
  if (saved && config.url !== appUrl()) await savePostPurchase(admin, shopId, config);
}

const secret = () => new TextEncoder().encode(appSecret());

/**
 * Checks the token Shopify gave the extension (signed with the app's secret) and returns the shop
 * and the order's reference.
 */
export async function verifyPostPurchaseToken(token: string) {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  const input = (payload as { input_data?: { initialPurchase?: { referenceId?: string }; shop?: { domain?: string } } }).input_data;
  const referenceId = input?.initialPurchase?.referenceId;
  const shop = input?.shop?.domain || String((payload as { dest?: string }).dest ?? "").replace(/^https?:\/\//, "");
  if (!referenceId || !/^[a-z0-9-]+\.myshopify\.com$/.test(shop)) throw new Error("Invalid token");
  return { referenceId, shop };
}

/**
 * What the extension shows, from the store as it is now (App Store rule 5.8.3: the same name,
 * picture and price as in the store): null when the offer is off or the variant can't be sold.
 */
export async function currentOffer(admin: AdminClient, config: PostPurchaseConfig) {
  if (!config.on || !config.product) return null;
  const data = await gql(
    admin,
    `#graphql
    query CroPostPurchaseVariant($id: ID!) {
      productVariant(id: $id) {
        title price availableForSale
        image { url altText }
        product { title status featuredMedia { preview { image { url altText } } } }
      }
    }`,
    { id: config.product.variantId },
  );
  const v = data.productVariant;
  if (!v || !v.availableForSale || v.product?.status !== "ACTIVE") return null;
  const image = v.image ?? v.product.featuredMedia?.preview?.image ?? null;
  return {
    heading: config.heading,
    text: config.text,
    pct: config.pct,
    title: v.product.title as string,
    variantTitle: v.title === "Default Title" ? "" : (v.title as string),
    price: Number(v.price) || 0,
    image: (image?.url as string) ?? null,
    alt: (image?.altText as string) || (v.product.title as string),
    variantId: config.product.variantId,
  };
}

/** Signs the offer's change for this order, from the saved offer (never from what the browser sent). */
export async function signOfferChangeset(config: PostPurchaseConfig, referenceId: string) {
  if (!config.on || !config.product) throw new Error("No offer");
  return new SignJWT({ changes: offerChanges(config) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(process.env.SHOPIFY_API_KEY || "")
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setSubject(referenceId)
    .sign(secret());
}
