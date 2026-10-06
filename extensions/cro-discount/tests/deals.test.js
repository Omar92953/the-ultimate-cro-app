import { describe, expect, test } from "vitest";
import { applyDeal, cartLinesDiscountsGenerateRun } from "../src/cart_lines_discounts_generate_run.js";

const P = (n) => `gid://shopify/Product/${n}`;
const V = (n) => `gid://shopify/ProductVariant/${n}`;
const line = (id, product, quantity, price, extra = {}) => ({ id, quantity, price, variant: V(product * 10), gift: "", product: { id: P(product), inCollections: [] }, ...extra });
const cart = { rate: 1, subtotal: 0 };

describe("fixed bundle", () => {
  const deal = { t: "fixed", items: [{ p: P(1), q: 1 }, { p: P(2), q: 1 }], pct: 15, label: "Set" };
  test("discounts one complete set", () => {
    const out = applyDeal(deal, [line("a", 1, 2, 50), line("b", 2, 1, 20)], cart);
    expect(out).toHaveLength(1);
    expect(out[0].value.percentage.value).toBe(15);
    expect(out[0].targets).toEqual([{ cartLine: { id: "a", quantity: 1 } }, { cartLine: { id: "b", quantity: 1 } }]);
  });
  test("nothing when the set is incomplete", () => {
    expect(applyDeal(deal, [line("a", 1, 3, 50)], cart)).toEqual([]);
  });
});

describe("buy X get Y", () => {
  test("buy 2 get 1 free from the same items: the cheapest is free", () => {
    const deal = { t: "bogo", buy: { type: "all" }, x: 2, get: { type: "all" }, y: 1, pct: 100 };
    const out = applyDeal(deal, [line("a", 1, 2, 30), line("b", 2, 1, 10)], cart);
    expect(out[0].targets).toEqual([{ cartLine: { id: "b", quantity: 1 } }]);
    expect(out[0].value.percentage.value).toBe(100);
  });
  test("2 items are not enough for buy 2 get 1", () => {
    const deal = { t: "bogo", buy: { type: "all" }, x: 2, get: { type: "all" }, y: 1, pct: 100 };
    expect(applyDeal(deal, [line("a", 1, 2, 30)], cart)).toEqual([]);
  });
  test("buy a camera, get the case 50% off", () => {
    const deal = { t: "bogo", buy: { type: "products", products: [P(1)] }, x: 1, get: { type: "products", products: [P(2)] }, y: 1, pct: 50 };
    const out = applyDeal(deal, [line("cam", 1, 1, 300), line("case", 2, 3, 20)], cart);
    expect(out[0].targets).toEqual([{ cartLine: { id: "case", quantity: 1 } }]);
    expect(out[0].value.percentage.value).toBe(50);
  });
});

describe("volume tiers", () => {
  const deal = { t: "volume", trigger: { type: "all" }, tiers: [{ qty: 2, pct: 10 }, { qty: 3, pct: 15 }] };
  test("counts across different products", () => {
    const out = applyDeal(deal, [line("a", 1, 1, 10), line("b", 2, 2, 10)], cart);
    expect(out[0].value.percentage.value).toBe(15);
    expect(out[0].targets).toHaveLength(2);
  });
  test("below the first tier: nothing", () => {
    expect(applyDeal(deal, [line("a", 1, 1, 10)], cart)).toEqual([]);
  });
});

describe("gift with purchase", () => {
  const deal = { t: "gift", id: "g1", variant: V(90), min: 50 };
  const gift = line("gift", 9, 1, 15, { gift: "g1" });
  test("free once the rest of the cart reaches the minimum", () => {
    const out = applyDeal(deal, [line("a", 1, 1, 60), gift], { rate: 1, subtotal: 75 });
    expect(out[0].targets).toEqual([{ cartLine: { id: "gift", quantity: 1 } }]);
    expect(out[0].value.percentage.value).toBe(100);
  });
  test("not free below the minimum (the gift's own price doesn't count)", () => {
    expect(applyDeal(deal, [line("a", 1, 1, 40), gift], { rate: 1, subtotal: 55 })).toEqual([]);
  });
  test("minimum converted to the shopper's currency", () => {
    expect(applyDeal(deal, [line("a", 1, 1, 60), gift], { rate: 2, subtotal: 75 })).toEqual([]);
  });
  test("a gift marker on another variant is ignored", () => {
    const fake = line("fake", 5, 1, 99, { gift: "g1" });
    expect(applyDeal(deal, [line("a", 1, 1, 200), fake], { rate: 1, subtotal: 299 })).toEqual([]);
  });
});

describe("deals and upsells together", () => {
  test("a line used by a deal gets no upsell discount on top", () => {
    const input = {
      presentmentCurrencyRate: "1.0",
      discount: {
        discountClasses: ["PRODUCT"],
        metafield: {
          jsonValue: {
            deals: [{ t: "volume", trigger: { type: "all" }, tiers: [{ qty: 2, pct: 10 }], label: "Volume" }],
            upsell: [{ trigger: { type: "all" }, tiers: [{ qty: 2, pct: 20 }], label: "Upsell" }],
          },
        },
      },
      cart: {
        cost: { subtotalAmount: { amount: "40.0" } },
        lines: [
          { id: "a", quantity: 2, bundle: null, gift: null, cost: { amountPerQuantity: { amount: "20.0" } }, merchandise: { __typename: "ProductVariant", id: V(10), title: "Default", product: { id: P(1), inCollections: [] } } },
        ],
      },
    };
    const out = cartLinesDiscountsGenerateRun(input);
    const candidates = out.operations[0].productDiscountsAdd.candidates;
    expect(candidates).toHaveLength(1);
    expect(candidates[0].message).toBe("Volume");
  });
});
