// @ts-check

/*
 * CRO Toolbox — offer discounts.
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
 *
 *   "deals": [   // bundle types, applied before upsells/cross-sells; a line used by a deal gets nothing else
 *     { "t": "fixed",  "items": [{ "p": gid, "q": 1 }], "pct": 15, "label": "…" },            // all items together
 *     { "t": "bogo",   "buy": Trigger, "x": 2, "get": Trigger, "y": 1, "pct": 100, "label": "…" }, // cheapest "get" items
 *     { "t": "volume", "trigger": Trigger, "tiers": [{ "qty": 2, "pct": 10 }], "label": "…" },  // count across products
 *     { "t": "gift",   "id": "g1", "variant": gid, "min": 50, "label": "…" }                   // line marked _cro_gift=id
 *   ]
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
      variant: merchandise.id,
      price: Number(line.cost?.amountPerQuantity?.amount) || 0,
      gift: line.gift?.value || "",
      product: merchandise.product,
      // "M / Red" → ["m", "red"]: the variant's option values, for size-upgrade tiers.
      values: String(merchandise.title || "").split(" / ").map((v) => v.trim().toLowerCase()),
    });
  }
  if (!lines.length) return EMPTY;

  // ---- Bundle deals first: they set exact quantities, and the lines they use get nothing else ----
  const dealCandidates = [];
  /** @type {Set<string>} */
  const used = new Set();
  const rate = Number(input.presentmentCurrencyRate) || 1;
  const subtotal = Number(input.cart.cost?.subtotalAmount?.amount) || 0;
  for (const deal of config.deals || []) {
    const result = applyDeal(deal, lines.filter((l) => !used.has(l.id)), { rate, subtotal });
    for (const c of result) {
      dealCandidates.push(c);
      for (const t of c.targets) used.add(t.cartLine.id);
    }
  }

  /** @type {Map<string, { pct: number, message: string }>} */
  const best = new Map();
  const offer = (/** @type {string} */ lineId, /** @type {number} */ pct, /** @type {string} */ message) => {
    if (!(pct > 0) || used.has(lineId)) return;
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

  if (!best.size && !dealCandidates.length) return EMPTY;

  const candidates = [...dealCandidates];
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
export function matches(trigger, product) {
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

/**
 * Quantity-limited targets: `count` units taken from the given lines in order.
 * @param {any[]} lines
 * @param {number} count
 */
function take(lines, count) {
  const targets = [];
  for (const line of lines) {
    if (count <= 0) break;
    const q = Math.min(line.quantity, count);
    targets.push({ cartLine: { id: line.id, quantity: q } });
    count -= q;
  }
  return targets;
}

/**
 * One bundle deal → zero or more discount candidates.
 * @param {any} deal
 * @param {any[]} lines lines not used by an earlier deal (gift lines are only ever gifts)
 * @param {{ rate: number, subtotal: number }} cart
 */
export function applyDeal(deal, lines, cart) {
  const pct = Math.min(100, Number(deal.pct) || 0);
  const message = deal.label || "";
  const paid = lines.filter((l) => !l.gift);
  const candidate = (/** @type {any[]} */ targets, /** @type {number} */ value) =>
    targets.length && value > 0 ? [{ message, targets, value: { percentage: { value } } }] : [];

  if (deal.t === "fixed") {
    const items = deal.items || [];
    if (!items.length) return [];
    // How many complete sets are in the cart?
    let sets = Infinity;
    for (const item of items) {
      const have = paid.filter((l) => l.product.id === item.p).reduce((n, l) => n + l.quantity, 0);
      sets = Math.min(sets, Math.floor(have / (Number(item.q) || 1)));
    }
    if (!(sets >= 1)) return [];
    const targets = items.flatMap((item) => take(paid.filter((l) => l.product.id === item.p), sets * (Number(item.q) || 1)));
    return candidate(targets, pct);
  }

  if (deal.t === "bogo") {
    const x = Math.max(1, Number(deal.x) || 1);
    const y = Math.max(1, Number(deal.y) || 1);
    const buy = paid.filter((l) => matches(deal.buy, l.product));
    const get = paid.filter((l) => matches(deal.get, l.product));
    const buyQty = buy.reduce((n, l) => n + l.quantity, 0);
    const getQty = get.reduce((n, l) => n + l.quantity, 0);
    const shared = get.some((g) => buy.includes(g));
    // Same pool (buy 2 get 1 of the same items): every x + y items earn y rewards.
    const rewards = shared ? Math.floor(buyQty / (x + y)) * y : Math.min(Math.floor(buyQty / x) * y, getQty);
    if (rewards <= 0) return [];
    const cheapestFirst = [...get].sort((a, b) => a.price - b.price);
    return candidate(take(cheapestFirst, rewards), pct || 100);
  }

  if (deal.t === "volume") {
    const pool = paid.filter((l) => matches(deal.trigger, l.product));
    const qty = pool.reduce((n, l) => n + l.quantity, 0);
    let best = 0;
    let bestQty = 0;
    for (const tier of deal.tiers || []) {
      const need = Number(tier.qty) || 0;
      if (need <= qty && need >= bestQty) {
        bestQty = need;
        best = Number(tier.pct) || 0;
      }
    }
    return candidate(pool.map((l) => ({ cartLine: { id: l.id } })), best);
  }

  if (deal.t === "gift") {
    const giftLine = lines.find((l) => l.gift === String(deal.id) && l.variant === deal.variant);
    if (!giftLine) return [];
    // The rest of the cart (without the gift) must reach the minimum, in the shopper's currency.
    const rest = cart.subtotal - giftLine.price * giftLine.quantity;
    const min = (Number(deal.min) || 0) * cart.rate;
    const hasTrigger = !deal.trigger || paid.some((l) => l.id !== giftLine.id && matches(deal.trigger, l.product));
    if (rest + 0.001 < min || !hasTrigger) return [];
    return candidate([{ cartLine: { id: giftLine.id, quantity: 1 } }], 100);
  }

  return [];
}
