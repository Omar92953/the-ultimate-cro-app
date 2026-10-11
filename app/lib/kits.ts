/**
 * Bundle products ("kits"): types and checks shared by the editor and the server (kits.server.ts).
 */
export type KitItem = { productId: string; title: string; image: string | null; qty: number };
export type Kit = {
  productId: string | null;
  title: string;
  items: KitItem[];
  /** "percent": pct off the items' total (follows the options chosen); "fixed": one price for every option. */
  pricing: "percent" | "fixed";
  pct: number;
  price: number;
  /** Show the items' total as the compare-at price, and keep it up to date. */
  compareAt: boolean;
};
export type KitRow = Kit & { productId: string; handle: string | null; status: string | null; image: string | null; variants: { title: string; price: string; compareAtPrice: string | null }[] };

export const blankKit = (): Kit => ({ productId: null, title: "", items: [], pricing: "percent", pct: 10, price: 0, compareAt: true });

/** Shopify's limit for one fixed bundle. */
export const MAX_KIT_ITEMS = 30;

export function validateKit(kit: Kit): string[] {
  const errors: string[] = [];
  if (!kit.title.trim()) errors.push("Give the bundle product a name.");
  if (kit.items.length < 2 && !(kit.items.length === 1 && kit.items[0].qty > 1)) errors.push("Add at least two items, or one item with a quantity of 2 or more (a multipack).");
  if (kit.items.length > MAX_KIT_ITEMS) errors.push(`A bundle product can have up to ${MAX_KIT_ITEMS} items.`);
  if (new Set(kit.items.map((i) => i.productId)).size !== kit.items.length) errors.push("The same product is listed twice: raise its quantity instead.");
  kit.items.forEach((i) => {
    if (!(Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 99)) errors.push(`${i.title}: quantity must be between 1 and 99.`);
  });
  if (kit.pricing === "percent" && !(kit.pct >= 0 && kit.pct <= 90)) errors.push("The discount must be between 0% and 90%.");
  if (kit.pricing === "fixed" && !(kit.price > 0)) errors.push("Enter the bundle price.");
  return [...new Set(errors)];
}

const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/**
 * One kit option's price from its items' total (store currency): % off the total, or the fixed
 * price; the compare-at price is the items' total when it's higher than the price (and switched on).
 */
export function kitVariantPrice(kit: Pick<Kit, "pricing" | "pct" | "price" | "compareAt">, itemsTotal: number) {
  const price = kit.pricing === "fixed" ? kit.price : itemsTotal * (1 - Math.min(90, Math.max(0, kit.pct)) / 100);
  return { price: money(price), compareAtPrice: kit.compareAt && itemsTotal > price + 0.004 ? money(itemsTotal) : null };
}

/** "gid://shopify/Product/123" → "123" (usable in the browser; admin.server's numericId isn't). */
export const productNumber = (gid: string) => String(gid).split("/").pop() || "";
