import { describe, expect, test } from "vitest";
import { extraCents, growTier, percentOff, tierPrice, validGroup } from "../src/cart_transform_run.js";

const COL = "gid://shopify/Collection/900";
const pick = (variant, step, { qty = 1, member = true, product = 10, title = "Default Title" } = {}) => ({
  step,
  line: { quantity: qty, merchandise: { __typename: "ProductVariant", id: `v${variant}`, title, product: { id: `gid://shopify/Product/${product}` }, inCollections: [{ collectionId: COL, isMember: member }] } },
});
const bundle = { pv: "1", d: 0, s: [{ n: 2, x: 3, c: "900" }, { n: 0, x: 1, p: [(7).toString(36)] }] };

describe("bundle group validation (shopper-controlled property)", () => {
  test("accepts 2-3 picks from the collection plus an optional extra", () => {
    expect(validGroup([pick(1, 0), pick(2, 0)], bundle)).toBe(true);
    expect(validGroup([pick(1, 0), pick(2, 0), pick(3, 0), pick(4, 1, { product: 7 })], bundle)).toBe(true);
  });
  test("rejects too many picks in a step", () => {
    expect(validGroup([pick(1, 0), pick(2, 0), pick(3, 0), pick(4, 0)], bundle)).toBe(false);
  });
  test("rejects a step index that doesn't exist", () => {
    expect(validGroup([pick(1, 0), pick(2, 0), pick(3, 5)], bundle)).toBe(false);
  });
  test("rejects products from outside the step", () => {
    expect(validGroup([pick(1, 0), pick(2, 0, { member: false })], bundle)).toBe(false);
    expect(validGroup([pick(1, 0), pick(2, 0), pick(3, 1, { product: 8 })], bundle)).toBe(false);
  });
});

describe("bundle price", () => {
  test("fixed price becomes a percentage of the picks' total, never an increase", () => {
    expect(percentOff({ k: "f", pr: 6000 }, 80, 1)).toBe(25);
    expect(percentOff({ k: "f", pr: 120000 }, 1634.95, 1)).toBe(26.6033);
    expect(percentOff({ k: "f", pr: 6000 }, 50, 1)).toBe(0);
    expect(percentOff({ k: "f", pr: 6000 }, 160, 2)).toBe(25);
  });
  test("percent off is used as is, capped at 100", () => {
    expect(percentOff({ k: "p", pc: 15 }, 80, 1)).toBe(15);
    expect(percentOff({ k: "p", pc: 150 }, 80, 1)).toBe(100);
  });
});

describe("price tiers (price by number of items)", () => {
  const tiered = { pv: "1", d: 1, k: "t", tr: [[3, 3000], [6, 5500]], s: [{ n: 1, x: 6, c: "900" }] };
  const picks = (n) => Array.from({ length: n }, (_, i) => pick(i + 1, 0));
  test("complete only at a tier's exact count", () => {
    expect(validGroup(picks(3), tiered)).toBe(true);
    expect(validGroup(picks(6), tiered)).toBe(true);
    expect(validGroup(picks(4), tiered)).toBe(false);
    expect(validGroup(picks(2), tiered)).toBe(false);
  });
  test("the tier's price becomes the discount", () => {
    expect(tierPrice(tiered, 6)).toBe(5500);
    expect(tierPrice(tiered, 5)).toBe(null);
    expect(percentOff(tiered, 40, 1, 0, 3)).toBe(25); // 40 → 30
    expect(percentOff(tiered, 80, 1, 0, 6)).toBe(31.25); // 80 → 55
    expect(percentOff(tiered, 80, 1, 0, 5)).toBe(0); // no tier: no discount
  });
});

describe("option extras (a pricier option costs more inside the bundle)", () => {
  const b = { k: "f", pr: 6000, ex: { xl: 500 } };
  test("adds the extra for every matching item", () => {
    expect(extraCents([pick(1, 0, { title: "XL / Red" }), pick(2, 0, { title: "M / Red" }), pick(3, 0, { title: "XL", qty: 2 })], b)).toBe(1500);
    expect(extraCents([pick(1, 0, { title: "S" })], b)).toBe(0);
    expect(extraCents([pick(1, 0, { title: "XL" })], { k: "f" })).toBe(0);
  });
  test("the bundle price includes the extras", () => {
    expect(percentOff(b, 80, 1, 1000)).toBe(12.5); // 60 + 10 = 70 of 80
  });
});

describe("growing discounts (more items, bigger discount)", () => {
  const picks = (n) => Array.from({ length: n }, (_, i) => pick(i + 1, 0));
  const pctTiers = { pv: "1", d: 1, k: "pt", pt: [[2, 10], [3, 15], [4, 20]], s: [{ n: 1, x: 8, c: "900" }] };
  const amtTiers = { pv: "1", d: 1, k: "at", at: [[2, 500], [3, 1000]], s: [{ n: 1, x: 8, c: "900" }] };
  test("the highest tier reached applies", () => {
    expect(growTier(pctTiers.pt, 1)).toBe(null);
    expect(growTier(pctTiers.pt, 2)).toBe(10);
    expect(growTier(pctTiers.pt, 3)).toBe(15);
    expect(growTier(pctTiers.pt, 7)).toBe(20);
    expect(growTier([[3, 15], [2, 10]], 3)).toBe(15); // order doesn't matter
  });
  test("any count that fits the steps is a complete bundle (no exact-count rule)", () => {
    expect(validGroup(picks(1), pctTiers)).toBe(true);
    expect(validGroup(picks(5), pctTiers)).toBe(true);
    expect(validGroup(picks(9), pctTiers)).toBe(false); // over the step's maximum
  });
  test("% off grows with the number of items", () => {
    expect(percentOff(pctTiers, 100, 1, 0, 1)).toBe(0);
    expect(percentOff(pctTiers, 100, 1, 0, 2)).toBe(10);
    expect(percentOff(pctTiers, 100, 1, 0, 3)).toBe(15);
    expect(percentOff(pctTiers, 100, 1, 0, 6)).toBe(20);
  });
  test("amount off becomes a percentage of the picks' total, in the shopper's currency", () => {
    expect(percentOff(amtTiers, 40, 1, 0, 2)).toBe(12.5); // $5 off $40
    expect(percentOff(amtTiers, 40, 1, 0, 3)).toBe(25); // $10 off $40
    expect(percentOff(amtTiers, 40, 2, 0, 3)).toBe(50); // rate 2: $10 = 20 off 40
    expect(percentOff(amtTiers, 5, 1, 0, 3)).toBe(100); // never below zero
    expect(percentOff(amtTiers, 40, 1, 0, 1)).toBe(0);
  });
});
