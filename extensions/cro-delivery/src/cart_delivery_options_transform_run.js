// @ts-check

/*
 * CRO Toolbox — delivery rules (Checkout → Payment & delivery rules).
 *
 * The dashboard writes the rules to this customization's `$app.function-configuration` metafield:
 * { "rules": [{ "match": "express", "action": "hide" | "rename" | "move",
 *               "name": "…" (rename), "index": 0 (move), "when": When }] }
 * When = { "min": 0, "max": 0, "countries": ["EG"], "products": [gid], "customer": "any" | "guest" | "new" | "returning" }
 * (0 / empty = no limit). A rule applies to every delivery option whose title contains `match`
 * (case-insensitive) when all of its conditions are met. Rules run in order.
 * Shopify keeps the carrier name in front of a renamed option.
 *
 * App Store rule 1.1.10: the cheapest shipping option must stay selected by default, so rules never
 * hide the cheapest option still shown in a group, never move a pricier option to the top and never
 * move the cheapest option down. The last option of a group is never hidden either.
 */

/**
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunInput} RunInput
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunResult} RunResult
 */

/** @type {RunResult} */
const EMPTY = { operations: [] };

/** Whether the cart meets a rule's conditions. Same logic as cro-payment. */
export function matches(when, cart) {
  if (!when) return true;
  const total = Number(cart.cost?.subtotalAmount?.amount) || 0;
  if (when.min > 0 && total < when.min) return false;
  if (when.max > 0 && total > when.max) return false;
  if (Array.isArray(when.countries) && when.countries.length) {
    const codes = (cart.deliveryGroups || []).map((g) => g.deliveryAddress?.countryCode).filter(Boolean);
    if (!codes.some((c) => when.countries.includes(c))) return false;
  }
  if (Array.isArray(when.products) && when.products.length) {
    const ids = (cart.lines || []).map((l) => (l.merchandise.__typename === "ProductVariant" ? l.merchandise.product?.id : null));
    if (!ids.some((id) => id && when.products.includes(id))) return false;
  }
  const customer = cart.buyerIdentity?.customer;
  if (when.customer === "guest" && customer) return false;
  if (when.customer === "new" && customer && customer.numberOfOrders > 0) return false;
  if (when.customer === "returning" && !(customer && customer.numberOfOrders > 0)) return false;
  return true;
}

/**
 * @param {RunInput} input
 * @returns {RunResult}
 */
export function cartDeliveryOptionsTransformRun(input) {
  /** @type {any} */
  const config = input.deliveryCustomization?.metafield?.jsonValue;
  const rules = Array.isArray(config?.rules) ? config.rules : [];
  if (!rules.length) return EMPTY;
  /** @type {RunResult["operations"]} */
  const operations = [];
  const hidden = new Set();
  const cost = (o) => Number(o.cost?.amount ?? 0) || 0;
  for (const rule of rules) {
    const match = String(rule?.match || "").trim().toLowerCase();
    if (!match || !matches(rule.when, input.cart)) continue;
    for (const group of input.cart.deliveryGroups) {
      const visible = group.deliveryOptions.filter((o) => !hidden.has(o.handle));
      for (const option of visible) {
        if (!(option.title || "").toLowerCase().includes(match)) continue;
        const shown = group.deliveryOptions.filter((o) => !hidden.has(o.handle));
        const cheapest = Math.min(...shown.map(cost));
        const isCheapest = cost(option) <= cheapest;
        if (rule.action === "hide") {
          // Never the last option (no way to check out) nor the cheapest one (rule 1.1.10).
          if (shown.length <= 1 || isCheapest) continue;
          hidden.add(option.handle);
          operations.push({ deliveryOptionHide: { deliveryOptionHandle: option.handle } });
        } else if (rule.action === "rename" && rule.name) {
          operations.push({ deliveryOptionRename: { deliveryOptionHandle: option.handle, title: String(rule.name).slice(0, 100) } });
        } else if (rule.action === "move") {
          let index = Math.max(0, Math.floor(Number(rule.index) || 0));
          // The top stays the cheapest option (rule 1.1.10).
          if (index === 0 && !isCheapest) index = 1;
          if (isCheapest && index > 0 && shown.filter((o) => cost(o) <= cheapest).length === 1) continue;
          operations.push({ deliveryOptionMove: { deliveryOptionHandle: option.handle, index } });
        }
      }
    }
  }
  return { operations };
}
