import { describe, expect, test } from "vitest";
import { percentOff, validGroup } from "../src/cart_transform_run.js";

const COL = "gid://shopify/Collection/900";
const pick = (variant, step, { qty = 1, member = true, product = 10 } = {}) => ({
  step,
  line: { quantity: qty, merchandise: { __typename: "ProductVariant", id: `v${variant}`, product: { id: `gid://shopify/Product/${product}` }, inCollections: [{ collectionId: COL, isMember: member }] } },
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
