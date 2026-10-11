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
 * Shopify keeps the carrier name in front of a renamed option, and the cheapest option stays selected.
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
  for (const rule of rules) {
    const match = String(rule?.match || "").trim().toLowerCase();
    if (!match || !matches(rule.when, input.cart)) continue;
    for (const group of input.cart.deliveryGroups) {
      const visible = group.deliveryOptions.filter((o) => !hidden.has(o.handle));
      for (const option of visible) {
        if (!(option.title || "").toLowerCase().includes(match)) continue;
        if (rule.action === "hide") {
          // Never hide the last option of a group: the shopper couldn't check out at all.
          if (group.deliveryOptions.filter((o) => !hidden.has(o.handle)).length <= 1) continue;
          hidden.add(option.handle);
          operations.push({ deliveryOptionHide: { deliveryOptionHandle: option.handle } });
        } else if (rule.action === "rename" && rule.name) {
          operations.push({ deliveryOptionRename: { deliveryOptionHandle: option.handle, title: String(rule.name).slice(0, 100) } });
        } else if (rule.action === "move") {
          operations.push({ deliveryOptionMove: { deliveryOptionHandle: option.handle, index: Math.max(0, Math.floor(Number(rule.index) || 0)) } });
        }
      }
    }
  }
  return { operations };
}
