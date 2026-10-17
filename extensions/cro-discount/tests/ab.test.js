import { describe, expect, test } from "vitest";
import { abEffective, cartLinesDiscountsGenerateRun, parseGroups } from "../src/cart_lines_discounts_generate_run.js";

const P = (n) => `gid://shopify/Product/${n}`;
const input = (config, ab) => ({
  presentmentCurrencyRate: 1,
  cart: {
    ab: ab === undefined ? null : { value: ab },
    cost: { subtotalAmount: { amount: "100" } },
    lines: [
      { id: "l1", quantity: 1, bundle: null, gift: null, cost: { amountPerQuantity: { amount: "50" } }, merchandise: { __typename: "ProductVariant", id: "gid://shopify/ProductVariant/10", title: "Default Title", product: { id: P(1), inCollections: [] } } },
      { id: "l2", quantity: 2, bundle: null, gift: null, cost: { amountPerQuantity: { amount: "25" } }, merchandise: { __typename: "ProductVariant", id: "gid://shopify/ProductVariant/20", title: "Default Title", product: { id: P(2), inCollections: [] } } },
    ],
  },
  discount: { discountClasses: ["PRODUCT"], metafield: { jsonValue: config } },
});
const pct = (out) => Object.fromEntries(out.operations[0].productDiscountsAdd.candidates.map((c) => [c.targets[0].cartLine.id, c.value.percentage.value]));

describe("A/B groups", () => {
  test("reads the cart attribute", () => {
    expect(parseGroups("t1:B,t2:A")).toEqual({ t1: "B", t2: "A" });
    expect(parseGroups("t1:C,junk,:B")).toEqual({});
    expect(parseGroups(undefined)).toEqual({});
  });

  test("group B gets B's discount fields laid over the rule, A and strangers get the rule", () => {
    const rule = { trigger: { type: "all" }, offered: [P(2)], pct: 10, label: "A deal", ab: { id: "t1", b: { pct: 25, label: "B deal" } } };
    expect(abEffective(rule, { t1: "B" })).toMatchObject({ pct: 25, label: "B deal", offered: [P(2)] });
    expect(abEffective(rule, { t1: "A" })).toBe(rule);
    expect(abEffective(rule, {})).toBe(rule);
    expect(abEffective(rule, { other: "B" })).toBe(rule);
    expect(abEffective({ trigger: {}, pct: 5 }, { t1: "B" })).toEqual({ trigger: {}, pct: 5 });
  });

  const cross = { crossSell: [{ trigger: { type: "products", products: [P(1)], collections: [] }, offered: [P(2)], pct: 10, label: "Pair", ab: { id: "t1", b: { pct: 25 } } }] };
  test("a cross sell test changes the percentage by group", () => {
    expect(pct(cartLinesDiscountsGenerateRun(input(cross, "t1:B")))).toEqual({ l2: 25 });
    expect(pct(cartLinesDiscountsGenerateRun(input(cross, "t1:A")))).toEqual({ l2: 10 });
    expect(pct(cartLinesDiscountsGenerateRun(input(cross)))).toEqual({ l2: 10 });
  });

  test("an upsell test changes the tiers by group", () => {
    const up = { upsell: [{ trigger: { type: "products", products: [P(2)], collections: [] }, tiers: [{ qty: 2, pct: 10 }], label: "Buy more", ab: { id: "u1", b: { tiers: [{ qty: 2, pct: 20 }] } } }] };
    expect(pct(cartLinesDiscountsGenerateRun(input(up, "u1:B")))).toEqual({ l2: 20 });
    expect(pct(cartLinesDiscountsGenerateRun(input(up, "u1:A")))).toEqual({ l2: 10 });
  });

  test("a bundle deal test changes the discount by group", () => {
    const deals = { deals: [{ t: "fixed", items: [{ p: P(1), q: 1 }, { p: P(2), q: 1 }], pct: 10, label: "Set", ab: { id: "d1", b: { pct: 30 } } }] };
    const outB = cartLinesDiscountsGenerateRun(input(deals, "d1:B"));
    expect(outB.operations[0].productDiscountsAdd.candidates[0].value.percentage.value).toBe(30);
    const outA = cartLinesDiscountsGenerateRun(input(deals, "d1:A"));
    expect(outA.operations[0].productDiscountsAdd.candidates[0].value.percentage.value).toBe(10);
  });
});
