import { describe, expect, test } from "vitest";
import { cartValidationsGenerateRun, checkBundles, checkNested } from "../src/cart_validations_generate_run.js";

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

describe("bundle guard", () => {
  const bl = (lineId, productId, title, parent) => ({ id: lineId, quantity: 1, parentRelationship: parent ? { parent: { id: parent } } : null, merchandise: { __typename: "ProductVariant", product: { id: `gid://shopify/Product/${productId}`, title } } });
  const guard = (lines) => cartValidationsGenerateRun({ cart: { cost: { subtotalAmount: { amount: "10" } }, lines }, validation: { metafield: { jsonValue: { bundles: ["7"] } } } });
  test("a bare bundle product is refused", () => {
    expect(messages(guard([bl("a", 7, "Gift box"), bl("b", 1, "Mug")]))).toEqual(["Gift box is a bundle. Pick its items on its page, then add it to your cart."]);
  });
  test("a bundle line with picks under it passes", () => {
    expect(messages(guard([bl("a", 7, "Gift box"), bl("b", 1, "Mug", "a"), bl("c", 2, "Cap", "a")]))).toEqual([]);
  });
  test("other products and an empty list pass", () => {
    expect(messages(guard([bl("b", 1, "Mug")]))).toEqual([]);
    expect(checkBundles([], { lines: [bl("a", 7, "Gift box")] })).toEqual([]);
  });
});

describe("bundle product inside a bundle", () => {
  const nl = (title, isBundle, bundle) => ({ id: title, quantity: 1, bundle: bundle ? { value: bundle } : null, merchandise: { __typename: "ProductVariant", product: { id: "gid://shopify/Product/1", title, isBundle } } });
  test("a bundle product used as a pick is refused", () => {
    expect(checkNested({ lines: [nl("Gift box", true, "7:abc:0")] })).toEqual(["Gift box is a bundle, so it can't be an item inside another bundle. Remove it from the cart."]);
  });
  test("a plain pick, or a bundle product on its own line, is not this error", () => {
    expect(checkNested({ lines: [nl("Mug", false, "7:abc:0"), nl("Gift box", true, null)] })).toEqual([]);
  });
});
