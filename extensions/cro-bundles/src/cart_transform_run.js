// @ts-check

/*
 * CRO Toolbox — mix-and-match bundles.
 *
 * Shoppers pick items anywhere in the store (the builder on the bundle's page, "Add to bundle" on
 * product pages, "+" buttons on collection pages). Each pick is added to the cart as its own line
 * with a hidden line property:
 *
 *   _bundle = "<bundle product id>:<group>:<step index>"
 *
 * One <group> is one bundle being built. This function checks every group against the bundle's
 * steps and, when it is complete, merges its lines into one bundle line (the bundle product) at the
 * bundle price. Each picked item stays a real component, so its stock goes down and it shows on
 * the order.
 *
 * The property is written by the shopper's browser, so it is NOT trusted. Every pick must be in its
 * step's collection (checked by Shopify through inCollections, so collections of any size work) or
 * in its step's product list, and the counts must fit. Anything that doesn't validate is left
 * alone: the items stay separate at their normal prices.
 *
 * Config, from the dashboard, in this cart transform's `$app.bundles` metafield:
 * { "b": { "<bundle product id>": {
 *     "pv": "<parent variant id>", "t": "<title>", "d": 0|1 (same item twice),
 *     "k": "f" (fixed: the bundle product's price) | "p" (percent off), "pr": <price in cents>, "pc": <percent>,
 *     "s": [{ "n": min, "x": max, "c": "<collection id>" | "p": ["<product id base36>", …] }] } } }
 * The step collections are also passed as input variables (`$app.bundle_vars`).
 */

/**
 * @typedef {import("../generated/api").CartTransformRunInput} RunInput
 * @typedef {import("../generated/api").CartTransformRunResult} RunResult
 */

/** @type {RunResult} */
const NO_CHANGES = { operations: [] };

/**
 * @param {RunInput} input
 * @returns {RunResult}
 */
export function cartTransformRun(input) {
  /** @type {any} */
  const config = input.cartTransform?.metafield?.jsonValue;
  const bundles = config && config.b;
  if (!bundles) return NO_CHANGES;
  const rate = Number(input.presentmentCurrencyRate) || 1;

  /** @type {Map<string, { line: any, step: number }[]>} */
  const groups = new Map();
  for (const line of input.cart.lines) {
    const tag = line.bundle?.value;
    if (!tag) continue;
    const m = /^(\d{1,20}):([A-Za-z0-9]{1,24}):(\d{1,2})$/.exec(String(tag));
    if (!m) continue;
    const key = m[1] + ":" + m[2];
    const list = groups.get(key) || [];
    list.push({ line, step: Number(m[3]) });
    groups.set(key, list);
  }

  const operations = [];
  for (const [key, picks] of groups) {
    const bundle = bundles[key.split(":")[0]];
    if (!bundle || !validGroup(picks, bundle)) continue;
    const total = picks.reduce((sum, p) => sum + Number(p.line.cost?.amountPerQuantity?.amount || 0) * p.line.quantity, 0);
    const off = percentOff(bundle, total, rate);
    /** @type {any} */
    const merge = {
      cartLines: picks.map((p) => ({ cartLineId: p.line.id, quantity: p.line.quantity })),
      parentVariantId: `gid://shopify/ProductVariant/${bundle.pv}`,
    };
    if (bundle.t) merge.title = String(bundle.t).slice(0, 255);
    if (off > 0) merge.price = { percentageDecrease: { value: off } };
    operations.push({ linesMerge: merge });
  }
  return operations.length ? { operations } : NO_CHANGES;
}

/**
 * Whether a group of picks is one complete, allowed bundle.
 * @param {{ line: any, step: number }[]} picks
 * @param {any} bundle
 */
export function validGroup(picks, bundle) {
  const steps = Array.isArray(bundle.s) ? bundle.s : [];
  if (!steps.length || !bundle.pv) return false;
  const counts = steps.map(() => 0);
  /** @type {Map<string, number>} */
  const perVariant = new Map();

  for (const { line, step } of picks) {
    const s = steps[step];
    const merch = line.merchandise;
    if (!s || !merch || merch.__typename !== "ProductVariant") return false;
    const qty = Number(line.quantity) || 0;
    if (qty < 1) return false;
    if (!inStep(merch, s)) return false;
    counts[step] += qty;
    perVariant.set(merch.id, (perVariant.get(merch.id) || 0) + qty);
  }
  if (!bundle.d && [...perVariant.values()].some((n) => n > 1)) return false;
  return steps.every((/** @type {any} */ s, /** @type {number} */ i) => counts[i] >= (Number(s.n) || 0) && counts[i] <= Math.max(Number(s.x) || 0, Number(s.n) || 0, 1));
}

/**
 * @param {any} merch a ProductVariant from the input
 * @param {any} step
 */
function inStep(merch, step) {
  if (step.c) {
    const gid = `gid://shopify/Collection/${step.c}`;
    return (merch.inCollections || []).some((/** @type {any} */ m) => m.collectionId === gid && m.isMember);
  }
  const productId = String(merch.product?.id || "").split("/").pop() || "";
  if (!/^[1-9]\d{0,19}$/.test(productId)) return false;
  return Array.isArray(step.p) && step.p.includes(Number(productId).toString(36));
}

/**
 * The discount to reach the bundle price: a fixed price (the bundle product's, converted to the
 * shopper's currency) or a percentage. Never a price increase.
 * @param {any} bundle
 * @param {number} total the picks' total in the shopper's currency
 * @param {number} rate shop currency → shopper's currency
 */
export function percentOff(bundle, total, rate) {
  if (bundle.k === "p") return clamp(Number(bundle.pc) || 0);
  const price = ((Number(bundle.pr) || 0) / 100) * rate;
  if (!(total > 0) || !(price > 0) || price >= total) return 0;
  return clamp((1 - price / total) * 100);
}

/** @param {number} v */
function clamp(v) {
  return Math.round(Math.min(100, Math.max(0, v)) * 100) / 100;
}
