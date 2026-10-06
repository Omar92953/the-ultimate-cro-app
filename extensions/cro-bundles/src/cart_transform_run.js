// @ts-check

/*
 * The Ultimate CRO App — mix-and-match bundles.
 *
 * A bundle is sold as its own product (with its own price). The bundle builder block adds that
 * product with a hidden line property:
 *
 *   _bundle_components = "111,111|222"   (variant ids; one "|"-separated group per step)
 *
 * This function expands such a line into the real component variants, so their inventory is
 * decremented and they appear on the order. Because no per-item price is given, the customer
 * pays exactly the bundle product's price (Shopify's lineExpand pricing rule).
 *
 * The property is written by the shopper's browser, so it is NOT trusted: every pick is checked
 * against the bundle configuration the dashboard writes to this cart transform's
 * `$app.bundles` metafield. Anything that doesn't validate is left untouched (the line stays the
 * bundle product at the bundle price) — a crafted property can never swap in other products.
 *
 * Config (compact to stay under Shopify's 10,000-byte metafield limit for function input):
 * { "b": { "<bundle product numeric id>": { "d": 0|1, "s": [{ "n": min, "x": max, "v": ["<variant id base36>", …] }] } } }
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

  const operations = [];

  for (const line of input.cart.lines) {
    const raw = line.components?.value;
    if (!raw) continue;
    const merchandise = /** @type {any} */ (line.merchandise);
    if (merchandise.__typename !== "ProductVariant") continue;

    const bundle = bundles[numericId(merchandise.product.id)];
    if (!bundle) continue;

    const counts = validate(raw, bundle);
    if (!counts) continue;

    operations.push({
      lineExpand: {
        cartLineId: line.id,
        expandedCartItems: Array.from(counts, ([id, quantity]) => ({
          merchandiseId: `gid://shopify/ProductVariant/${id}`,
          quantity,
        })),
      },
    });
  }

  return operations.length ? { operations } : NO_CHANGES;
}

/**
 * Returns variant id -> quantity (per one bundle), or null when the picks don't match the config.
 * @param {string} raw
 * @param {any} bundle
 * @returns {Map<string, number> | null}
 */
export function validate(raw, bundle) {
  const steps = Array.isArray(bundle.s) ? bundle.s : [];
  const groups = String(raw).split("|");
  if (!steps.length || groups.length !== steps.length) return null;

  /** @type {Map<string, number>} */
  const counts = new Map();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const ids = groups[i] ? groups[i].split(",").filter(Boolean) : [];
    const min = Number(step.n) || 0;
    const max = Number(step.x) || 0;
    if (ids.length < min || (max > 0 && ids.length > max)) return null;

    const allowed = new Set(step.v || []);
    for (const id of ids) {
      // Plain ids only: no leading zeros, so "044" can't pose as a second, different "44".
      if (!/^[1-9]\d{0,15}$/.test(id)) return null;
      if (!allowed.has(Number(id).toString(36))) return null;
      if (!bundle.d && counts.has(id)) return null;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }

  return counts.size ? counts : null;
}

/** @param {string} gid */
function numericId(gid) {
  return String(gid).split("/").pop() || "";
}
