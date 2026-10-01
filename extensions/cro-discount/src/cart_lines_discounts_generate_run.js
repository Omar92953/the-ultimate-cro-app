// @ts-check

/*
 * The Ultimate CRO App — offer discounts.
 *
 * The dashboard writes the configuration below to this discount's
 * `$app.function-configuration` metafield every time a rule is saved, so what the
 * storefront shows and what checkout charges come from the same save:
 *
 * {
 *   "upsell":    [{ "trigger": Trigger, "tiers": [{ "qty": 2, "pct": 10 }], "label": "…" },
 *                 { "trigger": Trigger, "type": "variant", "option": "Size",
 *                   "tiers": [{ "value": "100 ml", "pct": 10 }], "label": "…" }],
 *   "crossSell": [{ "trigger": Trigger, "offered": ["gid://shopify/Product/1"], "pct": 10, "label": "…" }]
 * }
 * Trigger = { "type": "all" | "products" | "collections", "products": [gid], "collections": [gid] }
 * Rules arrive sorted by priority; for upsells the first matching rule wins, like on the storefront.
 *
 * Each cart line gets at most one candidate (the highest percentage it qualifies for), so our
 * own offers never stack on each other. Bundle lines (built by the bundle builder) are skipped:
 * their price is already the bundle price.
 */

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} RunResult
 */

/** @type {RunResult} */
const EMPTY = { operations: [] };

/**
 * @param {RunInput} input
 * @returns {RunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.discount.discountClasses.includes("PRODUCT")) return EMPTY;

  /** @type {any} */
  const config = input.discount.metafield?.jsonValue;
  if (!config || typeof config !== "object") return EMPTY;

  const lines = [];
  for (const line of input.cart.lines) {
    const merchandise = /** @type {any} */ (line.merchandise);
    if (merchandise.__typename !== "ProductVariant") continue;
    if (line.bundle?.value) continue;
    lines.push({
      id: line.id,
      quantity: line.quantity,
      product: merchandise.product,
      // "M / Red" → ["m", "red"]: the variant's option values, for size-upgrade tiers.
      values: String(merchandise.title || "").split(" / ").map((v) => v.trim().toLowerCase()),
    });
  }
  if (!lines.length) return EMPTY;

  /** @type {Map<string, { pct: number, message: string }>} */
  const best = new Map();
  const offer = (/** @type {string} */ lineId, /** @type {number} */ pct, /** @type {string} */ message) => {
    if (!(pct > 0)) return;
    const current = best.get(lineId);
    if (!current || pct > current.pct) best.set(lineId, { pct: Math.min(pct, 100), message });
  };

  // ---- Upsell: quantity tiers, counted per product across all its variants ----------
  /** @type {Map<string, { product: any, quantity: number, lineIds: string[] }>} */
  const byProduct = new Map();
  for (const line of lines) {
    const entry = byProduct.get(line.product.id) || { product: line.product, quantity: 0, lineIds: [] };
    entry.quantity += line.quantity;
    entry.lineIds.push(line.id);
    byProduct.set(line.product.id, entry);
  }

  // Size-upgrade tiers: each line is discounted by the tier matching its option value.
  for (const line of lines) {
    const rule = (config.upsell || []).find((/** @type {any} */ r) => matches(r.trigger, line.product));
    if (!rule || rule.type !== "variant") continue;
    const tier = (rule.tiers || []).find((/** @type {any} */ t) => line.values.includes(String(t.value).trim().toLowerCase()));
    if (tier) offer(line.id, Number(tier.pct) || 0, rule.label || "");
  }

  for (const { product, quantity, lineIds } of byProduct.values()) {
    const rule = (config.upsell || []).find((/** @type {any} */ r) => matches(r.trigger, product));
    if (!rule || rule.type === "variant") continue;
    let pct = 0;
    let bestQty = 0;
    for (const tier of rule.tiers || []) {
      const qty = Number(tier.qty);
      if (qty <= quantity && qty >= bestQty) {
        bestQty = qty;
        pct = Number(tier.pct) || 0;
      }
    }
    for (const lineId of lineIds) offer(lineId, pct, rule.label || "");
  }

  // ---- Cross-sell: offered products are discounted while a trigger product is in the cart ----
  for (const rule of config.crossSell || []) {
    const pct = Number(rule.pct) || 0;
    if (pct <= 0) continue;
    const offered = new Set(rule.offered || []);
    const hasTrigger = lines.some((line) => !offered.has(line.product.id) && matches(rule.trigger, line.product));
    if (!hasTrigger) continue;
    for (const line of lines) {
      if (offered.has(line.product.id)) offer(line.id, pct, rule.label || "");
    }
  }

  if (!best.size) return EMPTY;

  const candidates = [];
  for (const [lineId, { pct, message }] of best) {
    candidates.push({
      message,
      targets: [{ cartLine: { id: lineId } }],
      value: { percentage: { value: pct } },
    });
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: /** @type {any} */ ("ALL"),
        },
      },
    ],
  };
}

/**
 * @param {any} trigger
 * @param {any} product
 */
function matches(trigger, product) {
  if (!trigger || trigger.type === "all") return true;
  if (trigger.type === "products") return (trigger.products || []).includes(product.id);
  if (trigger.type === "collections") {
    const wanted = new Set(trigger.collections || []);
    return (product.inCollections || []).some(
      (/** @type {any} */ m) => m.isMember && wanted.has(m.collectionId),
    );
  }
  return false;
}
