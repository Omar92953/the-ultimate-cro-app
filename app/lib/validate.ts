/** Validation shared by the dashboard (instant feedback) and the server (authoritative). */
import type { Bundle, Rule } from "./types";

export function validateRule(rule: Rule): string[] {
  const errors: string[] = [];
  if (!rule.name.trim()) errors.push("Give the offer a name.");
  if (rule.triggerType === "products" && !rule.triggerProducts.length) errors.push("Pick at least one trigger product.");
  if (rule.triggerType === "collections" && !rule.triggerCollections.length) errors.push("Pick at least one trigger collection.");
  if (rule.kind === "cross_sell") {
    if (!rule.offeredProducts.length) errors.push("Pick at least one product to offer.");
    if (!rule.placements.length) errors.push("Choose where the offer appears.");
    if (rule.discountPercent < 0 || rule.discountPercent > 100) errors.push("Discount must be between 0 and 100%.");
  } else if (rule.upsellType === "variant") {
    if (!rule.optionName.trim()) errors.push("Enter the option the tiers choose between, e.g. Size.");
    if (!rule.tiers.length) errors.push("Add at least one size tier.");
    const seen = new Set<string>();
    for (const t of rule.tiers) {
      const v = (t.value || "").trim().toLowerCase();
      if (!v) errors.push("Every size tier needs an option value, e.g. 100 ml.");
      if (!(t.pct >= 0 && t.pct <= 90)) errors.push("Tier discounts must be between 0 and 90%.");
      if (v && seen.has(v)) errors.push(`Two tiers use “${t.value}”.`);
      seen.add(v);
    }
  } else {
    if (!rule.tiers.length) errors.push("Add at least one quantity tier.");
    const seen = new Set<number>();
    for (const t of rule.tiers) {
      if (!(t.qty >= 1 && t.qty <= 99)) errors.push("Tier quantities must be between 1 and 99.");
      if (!(t.pct >= 0 && t.pct <= 90)) errors.push("Tier discounts must be between 0 and 90%.");
      if (seen.has(t.qty)) errors.push(`Two tiers use quantity ${t.qty}.`);
      seen.add(t.qty);
    }
  }
  return [...new Set(errors)];
}

export function validateBundle(bundle: Bundle, others: Bundle[]): string[] {
  const errors: string[] = [];
  if (!bundle.name.trim()) errors.push("Give the bundle a name.");
  if (!bundle.product) errors.push("Choose the product customers buy (the bundle product).");
  if (bundle.product && others.some((b) => b.handle !== bundle.handle && b.product?.id === bundle.product!.id)) {
    errors.push("Another bundle already uses that bundle product.");
  }
  if (!bundle.steps.length) errors.push("Add at least one step.");
  bundle.steps.forEach((s, i) => {
    const n = i + 1;
    if (!s.label.trim()) errors.push(`Step ${n} needs a label.`);
    if (!s.products.length && !s.collection) errors.push(`Step ${n} needs products or a collection to choose from.`);
    if (s.max < 1) errors.push(`Step ${n}: maximum must be at least 1.`);
    if (s.required && s.min > s.max) errors.push(`Step ${n}: minimum is larger than maximum.`);
    if (bundle.product && s.products.some((p) => p.id === bundle.product!.id)) {
      errors.push(`Step ${n} contains the bundle product itself.`);
    }
  });
  if (bundle.steps.every((s) => !s.required)) errors.push("At least one step must be required.");
  if (bundle.pricing === "tiers") {
    const tiers = bundle.tiers ?? [];
    if (!tiers.length) errors.push("Add at least one price tier (how many items, and the price).");
    tiers.forEach((t, i) => {
      if (!(Number.isInteger(t.qty) && t.qty >= 1)) errors.push(`Tier ${i + 1}: the number of items must be 1 or more.`);
      if (!(t.price > 0)) errors.push(`Tier ${i + 1}: enter a price above 0.`);
    });
    if (new Set(tiers.map((t) => t.qty)).size !== tiers.length) errors.push("Two tiers have the same number of items.");
    const most = bundle.steps.reduce((n, s) => n + Math.max(1, s.max), 0);
    if (tiers.some((t) => t.qty > most)) errors.push(`A tier needs more items than the steps allow (${most} at most). Raise the steps' maximum.`);
  }
  if (bundle.pricing === "percent_tiers" || bundle.pricing === "amount_tiers") {
    const pct = bundle.pricing === "percent_tiers";
    const tiers = bundle.tiers ?? [];
    if (!tiers.length) errors.push(pct ? "Add at least one discount tier (how many items, and the % off)." : "Add at least one discount tier (how many items, and the amount off).");
    tiers.forEach((t, i) => {
      if (!(Number.isInteger(t.qty) && t.qty >= 1)) errors.push(`Tier ${i + 1}: the number of items must be 1 or more.`);
      if (pct && !(t.price >= 1 && t.price <= 90)) errors.push(`Tier ${i + 1}: the discount must be between 1% and 90%.`);
      if (!pct && !(t.price > 0)) errors.push(`Tier ${i + 1}: enter an amount above 0.`);
    });
    if (new Set(tiers.map((t) => t.qty)).size !== tiers.length) errors.push("Two tiers have the same number of items.");
    const most = bundle.steps.reduce((n, s) => n + Math.max(1, s.max), 0);
    if (tiers.some((t) => t.qty > most)) errors.push(`A tier needs more items than the steps allow (${most} at most). Raise the steps' maximum.`);
    // A bigger box must never give a smaller discount.
    const sorted = [...tiers].sort((x, y) => x.qty - y.qty);
    if (sorted.some((t, i) => i > 0 && t.price < sorted[i - 1].price)) errors.push("Each tier with more items should give at least the same discount as the one before.");
  }
  (bundle.extras ?? []).forEach((x, i) => {
    if (!x.value.trim()) errors.push(`Extra charge ${i + 1}: enter the option value (e.g. XL).`);
    if (!(x.amount > 0)) errors.push(`Extra charge ${i + 1}: enter an amount above 0.`);
  });
  return [...new Set(errors)];
}
