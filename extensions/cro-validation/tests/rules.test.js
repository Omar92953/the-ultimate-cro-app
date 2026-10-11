import { describe, expect, test } from "vitest";
import { cartValidationsGenerateRun } from "../src/cart_validations_generate_run.js";

const line = (id, title, quantity) => ({ quantity, merchandise: { __typename: "ProductVariant", product: { id: `gid://shopify/Product/${id}`, title } } });
const run = (rules, total, lines) => cartValidationsGenerateRun({ cart: { cost: { subtotalAmount: { amount: String(total) } }, lines }, validation: { metafield: { jsonValue: { rules } } } });
const messages = (out) => (out.operations[0]?.validationAdd.errors ?? []).map((e) => e.message);

describe("order limits", () => {
  test("minimum order total", () => {
    const rules = [{ kind: "minTotal", value: 300, message: "Minimum order {limit} EGP" }];
    expect(messages(run(rules, 200, [line(1, "Mug", 1)]))).toEqual(["Minimum order 300 EGP"]);
    expect(messages(run(rules, 300, [line(1, "Mug", 1)]))).toEqual([]);
  });
  test("max per product, only for listed products", () => {
    const rules = [{ kind: "maxPerProduct", value: 2, products: ["gid://shopify/Product/1"] }];
    expect(messages(run(rules, 10, [line(1, "Mug", 3), line(2, "Cap", 5)]))).toEqual(["Mug: you can order up to 2."]);
  });
  test("item count limits and targets the cart", () => {
    const out = run([{ kind: "maxItems", value: 4 }], 10, [line(1, "Mug", 3), line(2, "Cap", 2)]);
    expect(out.operations[0].validationAdd.errors).toEqual([{ message: "You can order up to 4 items.", target: "$.cart" }]);
  });
  test("empty cart is not blocked by minimums", () => {
    expect(messages(run([{ kind: "minItems", value: 2 }, { kind: "minTotal", value: 50 }], 0, []))).toEqual([]);
  });
});
