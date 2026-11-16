/**
 * The maths behind the free tools (/tools/). Pure functions with no imports, used twice: at build time,
 * so each page's HTML already shows the result for the example numbers (no layout shift, works
 * without JavaScript), and in the browser as the shopper types. One source, so both always agree.
 */

// ------------------------------------------------------------- formatting

export const CURRENCIES = [
  { code: "USD", label: "US dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British pound (£)" },
  { code: "CAD", label: "Canadian dollar (CA$)" },
  { code: "AUD", label: "Australian dollar (A$)" },
  { code: "", label: "No symbol" },
] as const;

/** 1234.5 → "$1,234.50" (or "1,234.50" with no currency). Negative amounts are shown as positive: the text says "loss". */
export function money(n: number, currency: string): string {
  const v = Math.abs(n);
  // Whole amounts without cents ($750), others with two decimals ($8.33).
  const d = Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2;
  const opts = { minimumFractionDigits: d, maximumFractionDigits: d };
  if (!currency) return v.toLocaleString("en-US", opts);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, ...opts }).format(v);
}
/** 0.125 → "12.5%". */
export const pct = (ratio: number, digits = 1) => `${Number((ratio * 100).toFixed(digits)).toLocaleString("en-US")}%`;
export const count = (n: number) => Math.round(n).toLocaleString("en-US");
/** The suggested threshold: one amount or a range. */
export const rangeText = (r: { hasRange: boolean; low: number; high: number }, cur: string) =>
  !r.hasRange ? "None found" : r.low === r.high ? money(r.low, cur) : `${money(r.low, cur)} to ${money(r.high, cur)}`;
/** "1 in 8" for 0.127; empty when the share is over a half or zero. */
export const oneIn = (ratio: number) => (ratio > 0 && ratio <= 0.5 ? `about 1 in ${Math.round(1 / ratio)}` : "");

const ok = (...n: number[]) => n.every((x) => Number.isFinite(x) && x >= 0);

// ------------------------------------------------- free shipping threshold

export type ShippingInput = {
  aov: number;
  orders: number;
  /** Gross margin, percent. */
  margin: number;
  /** The shipping fee the store stops collecting on an order that gets free shipping. */
  fee: number;
  threshold: number;
  /** Percent of orders already at or above the threshold. */
  above: number;
  /** What a shopper who tops up adds to the order. */
  extra: number;
  /** Percent of the orders under the threshold expected to top up. */
  topUpRate: number;
};

export type ShippingResult = {
  valid: boolean;
  /** Lowest threshold where a shopper at the average order who tops up pays for the free shipping, rounded up to 5. */
  low: number;
  /** Average order plus one typical added item, rounded down to 5. */
  high: number;
  /** low ≤ high: there is a threshold worth trying. */
  hasRange: boolean;
  /** Smallest extra spend that pays for the fee: fee ÷ margin. */
  minExtra: number;
  ordersAbove: number;
  ordersUnder: number;
  /** Free shipping given to orders that already qualify, per month. */
  cost: number;
  /** Extra spend × margin minus the fee. */
  netPerTopUp: number;
  /** Whole top ups needed to cover the cost; Infinity when a top up doesn't earn anything. */
  breakEven: number;
  breakEvenShare: number;
  topUps: number;
  /** Margin from the expected top ups minus the fee on them and on the orders already above. */
  monthly: number;
};

export function shipping(i: ShippingInput): ShippingResult {
  const m = i.margin / 100;
  const valid = ok(i.aov, i.orders, i.margin, i.fee, i.threshold, i.above, i.extra, i.topUpRate) && m > 0 && i.above <= 100 && i.topUpRate <= 100;
  const minExtra = m > 0 ? i.fee / m : Infinity;
  const low = Math.ceil((i.aov + minExtra) / 5) * 5;
  const high = Math.floor((i.aov + i.extra) / 5) * 5;
  const ordersAbove = Math.round((i.orders * i.above) / 100);
  const ordersUnder = Math.max(0, Math.round(i.orders) - ordersAbove);
  const cost = ordersAbove * i.fee;
  const netPerTopUp = i.extra * m - i.fee;
  const breakEven = netPerTopUp > 0 ? Math.ceil(cost / netPerTopUp - 1e-9) : Infinity;
  const breakEvenShare = ordersUnder ? breakEven / ordersUnder : Infinity;
  const topUps = Math.round((ordersUnder * i.topUpRate) / 100);
  const monthly = topUps * netPerTopUp - cost;
  return { valid, low, high, hasRange: Number.isFinite(minExtra) && low <= high, minExtra, ordersAbove, ordersUnder, cost, netPerTopUp, breakEven, breakEvenShare, topUps, monthly };
}

/** The result in plain words. */
export function shippingSummary(i: ShippingInput, r: ShippingResult, cur: string): string {
  if (!r.valid) return "Enter a number in every field (percentages from 0 to 100, a margin above 0) to see the result.";
  const t = money(i.threshold, cur);
  const parts = [
    r.hasRange
      ? `Try a threshold ${r.low === r.high ? `of ${money(r.low, cur)}` : `from ${money(r.low, cur)} to ${money(r.high, cur)}`}.`
      : `Adding ${money(i.extra, cur)} doesn't take a typical order far enough to pay for the fee at your margin, so a threshold may never pay; a lower flat rate can be the better offer.`,
    `At ${t}, free shipping costs you ${money(r.cost, cur)} a month on the ${count(r.ordersAbove)} orders that already reach it.`,
  ];
  if (r.netPerTopUp <= 0) {
    parts.push(
      `A shopper who adds ${money(i.extra, cur)} earns you ${money(i.extra * (i.margin / 100), cur)} of margin, which doesn't cover the ${money(i.fee, cur)} fee, so every top up loses money. A top up has to add at least ${money(r.minExtra, cur)} to pay for itself.`,
    );
    return parts.join(" ");
  }
  parts.push(`Each shopper who tops up earns you ${money(r.netPerTopUp, cur)} after the fee, so you need ${count(r.breakEven)} top ups a month to break even.`);
  if (r.breakEven > r.ordersUnder) parts.push(`That is more than the ${count(r.ordersUnder)} orders under ${t}: this threshold loses money.`);
  else {
    const share = oneIn(r.breakEvenShare);
    parts.push(`That is ${pct(r.breakEvenShare)}${share ? ` (${share})` : ""} of your ${count(r.ordersUnder)} orders under ${t}.`);
    parts.push(
      r.monthly >= 0
        ? `If ${pct(i.topUpRate / 100, 0)} of them top up, the threshold earns you ${money(r.monthly, cur)} a month.`
        : `If ${pct(i.topUpRate / 100, 0)} of them top up, the threshold costs you ${money(r.monthly, cur)} a month.`,
    );
  }
  return parts.join(" ");
}

// ------------------------------------------------------------------ bundle

export type BundleItem = { price: number; cost: number; qty: number };
export type BundleInput = { items: BundleItem[]; mode: "percent" | "fixed"; percent: number; fixed: number };
export type BundleResult = {
  valid: boolean;
  separatePrice: number;
  totalCost: number;
  separateMargin: number;
  bundlePrice: number;
  saving: number;
  savingShare: number;
  bundleMargin: number;
  marginChange: number;
  /** Extra bundles needed to earn the same total margin as full price sets: separate margin ÷ bundle margin minus 1. Infinity when the bundle earns nothing. */
  uplift: number;
};

export function bundle(i: BundleInput): BundleResult {
  const items = i.items.filter((it) => it.qty > 0);
  const valid =
    i.items.every((it) => ok(it.price, it.cost, it.qty)) &&
    items.length > 0 &&
    (i.mode === "percent" ? ok(i.percent) && i.percent <= 100 : ok(i.fixed));
  const separatePrice = items.reduce((s, it) => s + it.price * it.qty, 0);
  const totalCost = items.reduce((s, it) => s + it.cost * it.qty, 0);
  const bundlePrice = i.mode === "percent" ? separatePrice * (1 - i.percent / 100) : i.fixed;
  const separateMargin = separatePrice - totalCost;
  const bundleMargin = bundlePrice - totalCost;
  const saving = separatePrice - bundlePrice;
  return {
    valid: valid && separatePrice > 0,
    separatePrice,
    totalCost,
    separateMargin,
    bundlePrice,
    saving,
    savingShare: separatePrice ? saving / separatePrice : 0,
    bundleMargin,
    marginChange: bundleMargin - separateMargin,
    uplift: bundleMargin > 0 ? separateMargin / bundleMargin - 1 : Infinity,
  };
}

export const marginShare = (marginAmount: number, price: number) => (price > 0 ? marginAmount / price : 0);

export function bundleSummary(r: BundleResult, cur: string): string {
  if (!r.valid) return "Enter a price, a cost and a quantity for at least one item, and a discount from 0 to 100%, to see the result.";
  const b = money(r.bundlePrice, cur);
  if (r.bundleMargin <= 0)
    return `At ${b}, the bundle sells ${r.bundleMargin === 0 ? "at" : `${money(r.bundleMargin, cur)} below`} what the items cost you. No number of extra sales makes it pay: lower the discount.`;
  if (r.saving < 0) return `The bundle price ${b} is ${money(r.saving, cur)} more than buying the items separately, so shoppers have no reason to choose it.`;
  if (r.saving === 0) return `The bundle costs the same as the items bought separately (${b}), so it keeps your full margin of ${money(r.bundleMargin, cur)}, but shoppers save nothing.`;
  return `Shoppers save ${money(r.saving, cur)} (${pct(r.savingShare)}). Each bundle earns you ${money(r.bundleMargin, cur)} of margin, ${money(r.marginChange, cur)} less than the same items at full price. If those shoppers would have bought every item anyway, you need ${pct(r.uplift)} more bundle sales to earn the same. A shopper who would have bought only one item and takes the bundle adds the margin of the other items, less the discount.`;
}

// ----------------------------------------------------------------- loyalty

export type LoyaltyInput = {
  /** Points earned for each unit of currency spent. */
  perUnit: number;
  /** Points a reward costs. */
  points: number;
  /** What the reward is worth to the shopper. */
  value: number;
  /** What the reward costs the store (for money off, the same as its value; for a free product, its cost). */
  cost: number;
  /** Percent of earned points that are spent. */
  redemption: number;
  aov: number;
};
export type LoyaltyResult = {
  valid: boolean;
  pointValue: number;
  /** What shoppers get back, as a share of what they spend. */
  rewardRate: number;
  spendForReward: number;
  ordersForReward: number;
  pointCost: number;
  /** What the program costs, as a share of sales: points per unit × cost per point × redemption rate. */
  costRate: number;
  costPerOrder: number;
};

export function loyalty(i: LoyaltyInput): LoyaltyResult {
  const valid = ok(i.perUnit, i.points, i.value, i.cost, i.redemption, i.aov) && i.perUnit > 0 && i.points > 0 && i.redemption <= 100;
  const pointValue = i.points > 0 ? i.value / i.points : 0;
  const pointCost = i.points > 0 ? i.cost / i.points : 0;
  const costRate = i.perUnit * pointCost * (i.redemption / 100);
  const spendForReward = i.perUnit > 0 ? i.points / i.perUnit : 0;
  return {
    valid,
    pointValue,
    rewardRate: i.perUnit * pointValue,
    spendForReward,
    ordersForReward: i.aov > 0 ? spendForReward / i.aov : 0,
    pointCost,
    costRate,
    costPerOrder: i.aov * costRate,
  };
}

/** A point is often worth a fraction of a cent: show enough digits to see it. */
export function smallMoney(n: number, cur: string): string {
  if (n >= 0.1 || n <= 0) return money(n, cur);
  let digits = 2;
  while (digits < 5 && Math.abs(Number(n.toFixed(digits)) - n) > n * 0.005) digits++;
  if (!cur) return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function loyaltySummary(i: LoyaltyInput, r: LoyaltyResult, cur: string): string {
  if (!r.valid) return "Enter a number in every field (points above 0, a redemption rate from 0 to 100%) to see the result.";
  const orders = r.ordersForReward;
  const ordersText = orders > 0 ? ` That is about ${orders < 1 ? "one order" : `${Number(orders.toFixed(1)).toLocaleString("en-US")} orders`} at your average order.` : "";
  return `Each point is worth ${smallMoney(r.pointValue, cur)} to the shopper, so members get ${pct(r.rewardRate, 2)} back on what they spend. They reach the first reward after spending ${money(r.spendForReward, cur)}.${ordersText} If ${pct(i.redemption / 100, 0)} of points are spent, the program costs you ${pct(r.costRate, 2)} of sales: ${money(r.costPerOrder, cur)} on an average order.`;
}

// ---------------------------------------------------- what each page shows

/** Text for each output element (by id) and the summary. Used for the built HTML and in the browser. */
export type View = { values: Record<string, string>; summary: string };
const unset = (ids: string[], summary: string): View => ({ values: Object.fromEntries(ids.map((id) => [id, id.endsWith("-note") ? "" : "Not set"])), summary });

export function shippingView(i: ShippingInput, cur: string): View {
  const r = shipping(i);
  const ids = ["fs-range", "fs-range-note", "fs-cost", "fs-cost-note", "fs-net", "fs-net-note", "fs-break", "fs-break-note", "fs-month", "fs-month-note"];
  if (!r.valid) return unset(ids, shippingSummary(i, r, cur));
  const net = r.netPerTopUp;
  const never = !Number.isFinite(r.breakEven) || r.breakEven > r.ordersUnder;
  return {
    values: {
      "fs-range": rangeText(r, cur),
      "fs-range-note": `A top up must add at least ${money(r.minExtra, cur)} to pay for its free shipping.`,
      "fs-cost": `${money(r.cost, cur)} a month`,
      "fs-cost-note": `${count(r.ordersAbove)} orders × ${money(i.fee, cur)}`,
      "fs-net": net >= 0 ? money(net, cur) : `A loss of ${money(net, cur)}`,
      "fs-net-note": `${money(i.extra, cur)} × ${pct(i.margin / 100)} margin, minus the ${money(i.fee, cur)} fee`,
      "fs-break": !Number.isFinite(r.breakEven) ? "Never" : `${count(r.breakEven)} a month`,
      "fs-break-note": never ? "More than the orders under the threshold" : `${pct(r.breakEvenShare)} of the ${count(r.ordersUnder)} orders under the threshold`,
      "fs-month": r.monthly >= 0 ? `Earns ${money(r.monthly, cur)}` : `Costs ${money(r.monthly, cur)}`,
      "fs-month-note": `${count(r.topUps)} top ups × ${net >= 0 ? "" : "a loss of "}${money(net, cur)}, minus ${money(r.cost, cur)}`,
    },
    summary: shippingSummary(i, r, cur),
  };
}

export function bundleView(i: BundleInput, cur: string): View {
  const r = bundle(i);
  const ids = ["bp-separate", "bp-separate-note", "bp-price", "bp-price-note", "bp-margin", "bp-margin-note", "bp-change", "bp-uplift", "bp-uplift-note"];
  if (!r.valid) return unset(ids, bundleSummary(r, cur));
  return {
    values: {
      "bp-separate": money(r.separatePrice, cur),
      "bp-separate-note": `Margin ${r.separateMargin < 0 ? "a loss of " : ""}${money(r.separateMargin, cur)} (${pct(marginShare(r.separateMargin, r.separatePrice))}) on a cost of ${money(r.totalCost, cur)}`,
      "bp-price": money(r.bundlePrice, cur),
      "bp-price-note": r.saving >= 0 ? `Shoppers save ${money(r.saving, cur)} (${pct(r.savingShare)})` : `${money(r.saving, cur)} more than separately`,
      "bp-margin": r.bundleMargin >= 0 ? money(r.bundleMargin, cur) : `A loss of ${money(r.bundleMargin, cur)}`,
      "bp-margin-note": r.bundlePrice > 0 ? `${pct(marginShare(r.bundleMargin, r.bundlePrice))} of the bundle price` : "",
      "bp-change": Math.abs(r.marginChange) < 0.005 ? "No change" : `${money(r.marginChange, cur)} ${r.marginChange < 0 ? "less" : "more"}`,
      "bp-uplift": !Number.isFinite(r.uplift) ? "Never" : r.uplift <= 0 ? "None needed" : `${pct(r.uplift)} more sales`,
      "bp-uplift-note": !Number.isFinite(r.uplift) ? "The bundle earns no margin" : r.uplift <= 0 ? "The bundle keeps the full margin" : `${money(r.separateMargin, cur)} ÷ ${money(r.bundleMargin, cur)}, minus 1`,
    },
    summary: bundleSummary(r, cur),
  };
}

export function loyaltyView(i: LoyaltyInput, cur: string): View {
  const r = loyalty(i);
  const ids = ["lp-point", "lp-point-note", "lp-rate", "lp-rate-note", "lp-reward", "lp-reward-note", "lp-cost", "lp-cost-note", "lp-order", "lp-order-note"];
  if (!r.valid) return unset(ids, loyaltySummary(i, r, cur));
  const orders = Number(r.ordersForReward.toFixed(1)).toLocaleString("en-US");
  return {
    values: {
      "lp-point": smallMoney(r.pointValue, cur),
      "lp-point-note": `${money(i.value, cur)} ÷ ${count(i.points)} points`,
      "lp-rate": `${pct(r.rewardRate, 2)} back`,
      "lp-rate-note": `${i.perUnit.toLocaleString("en-US")} ${i.perUnit === 1 ? "point" : "points"} per unit spent × ${smallMoney(r.pointValue, cur)}`,
      "lp-reward": money(r.spendForReward, cur),
      "lp-reward-note": i.aov > 0 ? `About ${orders} ${orders === "1" ? "order" : "orders"} at your average order` : "",
      "lp-cost": `${pct(r.costRate, 2)} of sales`,
      "lp-cost-note": `${i.perUnit.toLocaleString("en-US")} × ${smallMoney(r.pointCost, cur)} a point × ${pct(i.redemption / 100, 0)} spent`,
      "lp-order": money(r.costPerOrder, cur),
      "lp-order-note": `${money(i.aov, cur)} × ${pct(r.costRate, 2)}`,
    },
    summary: loyaltySummary(i, r, cur),
  };
}
