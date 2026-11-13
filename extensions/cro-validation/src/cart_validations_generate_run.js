// @ts-check

/*
 * CRO Toolbox — checkout limits (Checkout → Order limits).
 *
 * The dashboard writes the rules to this validation's `$app.function-configuration` metafield:
 * { "rules": [{ "kind": "minTotal" | "maxTotal" | "minItems" | "maxItems" | "minPerProduct" | "maxPerProduct",
 *               "value": 3, "products": [gid] (per-product rules; empty = every product), "message": "…" }] }
 * A broken rule blocks checkout with its message. {limit} in a message is replaced by the rule's value (a price for
 * the order total rules, in the buyer's currency, as the admin preview shows it) and {product} by the product's name.
 * Shopify runs validations on every cart change too: minimums wait for checkout (buyerJourney.step), otherwise the
 * first item added to an empty cart is refused and the shopper can never reach the minimum (2026-11-13). Maximums,
 * the bundle guard and the points guard also check the cart.
 *
 * The same function also runs as the "bundle guard" (a second validation made by the app when the
 * store has mix and match bundles), configured with { "bundles": ["<bundle product id>", …], "st": "<token>" }: a line
 * of a bundle product that the cart transform did not stamp as merged (`_cro_merged` = the token) is refused, so a bundle
 * product can't be bought alone, e.g. through a theme's quick add button. It also refuses a bundle product
 * (tag cro-bundle) added as a pick (a line with the `_bundle` property), which the builder never
 * offers but a hand made request could.
 *
 * And as the "points guard" (a third validation, made by the app when the Points shop has a product sold only with points),
 * configured with { "points": [{ "p": "<product gid>", "m": <money part per item> }] }: a line of such a product that
 * costs more than its money part per item (after discounts, so with the member's points code) is refused.
 */

/**
 * @typedef {import("../generated/api").CartValidationsGenerateRunInput} RunInput
 * @typedef {import("../generated/api").CartValidationsGenerateRunResult} RunResult
 */

/** @type {RunResult} */
const EMPTY = { operations: [] };

/** A price as the admin shows it: "EGP 1,000", "USD 12.50". */
export function price(amount, currency) {
  const fixed = (Math.round(amount * 100) / 100).toFixed(Number.isInteger(Math.round(amount * 100) / 100) ? 0 : 2);
  const [whole, cents] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency ? `${currency} ` : ""}${grouped}${cents ? `.${cents}` : ""}`;
}

const MINIMUMS = new Set(["minTotal", "minItems", "minPerProduct"]);

const fill = (message, limit, product = "") => String(message || "").replace(/\{limit\}/g, String(limit)).replace(/\{product\}/g, product).slice(0, 250);

/**
 * The error messages for a cart, one per broken rule (or per product for per-product rules). `rate` converts the rules'
 * amounts (the shop's currency) to the cart's; `atCart` is true while the shopper is still filling the cart, when only
 * maximums apply.
 */
export function check(rules, cart, rate = 1, atCart = false) {
  const errors = [];
  const total = Number(cart.cost?.subtotalAmount?.amount) || 0;
  const currency = cart.cost?.subtotalAmount?.currencyCode || "";
  const r = Number(rate) > 0 ? Number(rate) : 1;
  const products = new Map();
  let items = 0;
  for (const line of cart.lines) {
    items += line.quantity;
    const m = /** @type {any} */ (line.merchandise);
    if (m.__typename !== "ProductVariant" || !m.product) continue;
    const p = products.get(m.product.id) ?? { title: m.product.title || "", qty: 0 };
    p.qty += line.quantity;
    products.set(m.product.id, p);
  }
  for (const rule of rules) {
    const value = Number(rule?.value) || 0;
    if (value <= 0 || (atCart && MINIMUMS.has(rule.kind))) continue;
    const money = value * r;
    const message = (fallback) => fill(rule.message || fallback, value);
    const moneyMessage = (fallback) => fill(rule.message || fallback, price(money, currency));
    switch (rule.kind) {
      case "minTotal":
        if (items && total < money) errors.push(moneyMessage("The minimum order is {limit}."));
        break;
      case "maxTotal":
        if (total > money) errors.push(moneyMessage("The maximum order is {limit}."));
        break;
      case "minItems":
        if (items && items < value) errors.push(message("Add at least {limit} items to check out."));
        break;
      case "maxItems":
        if (items > value) errors.push(message("You can order up to {limit} items."));
        break;
      case "minPerProduct":
      case "maxPerProduct": {
        const only = Array.isArray(rule.products) && rule.products.length ? rule.products : null;
        for (const [id, p] of products) {
          if (only && !only.includes(id)) continue;
          const broken = rule.kind === "minPerProduct" ? p.qty < value : p.qty > value;
          if (broken) errors.push(fill(rule.message || (rule.kind === "minPerProduct" ? "{product}: order at least {limit}." : "{product}: you can order up to {limit}."), value, p.title));
        }
        break;
      }
    }
  }
  return errors;
}

/**
 * Errors for mix and match bundle products in the cart that were not merged from picks: the cart transform (cro-bundles) stamps every
 * bundle line it merges with `_cro_merged` = the shop's token, so a line of a bundle product without that stamp was added alone
 * (a theme's quick add, /cart/add) and is refused. `stamp` is the token from this validation's config; without one any stamp counts.
 * Only the product ids listed (the store's mix and match bundles) are checked: kits and normal products are never touched.
 * @param {any} bundles numeric product ids
 * @param {any} cart
 * @param {string} [stamp]
 */
export function checkBundles(bundles, cart, stamp = "") {
  const ids = new Set(Array.isArray(bundles) ? bundles.map(String) : []);
  if (!ids.size) return [];
  const errors = [];
  for (const line of cart.lines) {
    const m = /** @type {any} */ (line.merchandise);
    if (m.__typename !== "ProductVariant" || !m.product) continue;
    if (!ids.has(String(m.product.id).split("/").pop())) continue;
    const got = line.merged?.value;
    if (stamp ? got === stamp : got) continue;
    errors.push(`${m.product.title || "This bundle"} is a bundle. Pick its items on its page, then add it to your cart.`.slice(0, 250));
  }
  return errors;
}

/**
 * Errors for Points shop products sold only with points: each item of such a line may cost at most its money part (the
 * member's code takes the rest off one item, so a second item, or the product without the code, is refused).
 * @param {any} points [{ p: product gid, m: money per item, in the shop's currency }]
 * @param {any} cart
 * @param {number} rate the buyer's currency per 1 of the shop's (input.presentmentCurrencyRate): line costs are in it
 */
export function checkPoints(points, cart, rate = 1) {
  const r = Number(rate) > 0 ? Number(rate) : 1;
  const money = new Map(Array.isArray(points) ? points.map((x) => [String(x?.p), (Number(x?.m) || 0) * r]) : []);
  if (!money.size) return [];
  const errors = [];
  for (const line of cart.lines) {
    const m = /** @type {any} */ (line.merchandise);
    if (m.__typename !== "ProductVariant" || !m.product || !money.has(m.product.id)) continue;
    const each = (Number(line.cost?.totalAmount?.amount) || 0) / (line.quantity || 1);
    // Half a cent of room for rounding.
    if (each > /** @type {number} */ (money.get(m.product.id)) + 0.005) errors.push(`${m.product.title || "This product"} can only be bought with points.`.slice(0, 250));
  }
  return errors;
}

/** Errors for bundle products used as picks inside a bundle. */
export function checkNested(cart) {
  const errors = [];
  for (const line of cart.lines) {
    const m = /** @type {any} */ (line.merchandise);
    if (m.__typename !== "ProductVariant" || !m.product?.isBundle || !line.bundle?.value) continue;
    errors.push(`${m.product.title || "A bundle"} is a bundle, so it can't be an item inside another bundle. Remove it from the cart.`.slice(0, 250));
  }
  return errors;
}

/**
 * @param {RunInput} input
 * @returns {RunResult}
 */
export function cartValidationsGenerateRun(input) {
  /** @type {any} */
  const config = input.validation?.metafield?.jsonValue;
  const rules = Array.isArray(config?.rules) ? config.rules : [];
  const errors = [...checkNested(input.cart), ...checkBundles(config?.bundles, input.cart, config?.st ? String(config.st) : ""), ...checkPoints(config?.points, input.cart, Number(input.presentmentCurrencyRate) || 1), ...(rules.length ? check(rules, input.cart, Number(input.presentmentCurrencyRate) || 1, input.buyerJourney?.step === "CART_INTERACTION") : [])];
  if (!errors.length) return EMPTY;
  return { operations: [{ validationAdd: { errors: errors.map((message) => ({ message, target: "$.cart" })) } }] };
}
