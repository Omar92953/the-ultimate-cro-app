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
  // A cart line as the validation sees it after the cart transform: `merged` is the stamp the transform wrote on a merged bundle line.
  const bl = (lineId, productId, title, merged) => ({ id: lineId, quantity: 1, merged: merged === undefined ? null : { value: merged }, merchandise: { __typename: "ProductVariant", product: { id: `gid://shopify/Product/${productId}`, title } } });
  const guard = (lines, config = { bundles: ["7"], st: "tok" }) => cartValidationsGenerateRun({ cart: { cost: { subtotalAmount: { amount: "10" } }, lines }, validation: { metafield: { jsonValue: config } } });
  const BARE = ["Gift box is a bundle. Pick its items on its page, then add it to your cart."];
  test("a bundle product added alone (no stamp) is refused", () => {
    expect(messages(guard([bl("a", 7, "Gift box"), bl("b", 1, "Mug")]))).toEqual(BARE);
  });
  test("a bundle line the cart transform merged (stamped) passes", () => {
    expect(messages(guard([bl("a", 7, "Gift box", "tok")]))).toEqual([]);
  });
  test("a kit (not a mix and match bundle id) and a normal product pass, stamped or not", () => {
    expect(messages(guard([bl("k", 8, "Kit"), bl("b", 1, "Mug"), bl("c", 2, "Cap", "tok")]))).toEqual([]);
  });
  test("a forged stamp is refused when the shop has a token: the shopper cannot guess it", () => {
    expect(messages(guard([bl("a", 7, "Gift box", "1")]))).toEqual(BARE);
    expect(messages(guard([bl("a", 7, "Gift box", "")]))).toEqual(BARE);
  });
  test("without a token in the config any stamp counts (a config made before tokens)", () => {
    expect(messages(guard([bl("a", 7, "Gift box", "1")], { bundles: ["7"] }))).toEqual([]);
    expect(messages(guard([bl("a", 7, "Gift box")], { bundles: ["7"] }))).toEqual(BARE);
  });
  test("no bundle ids: everything passes (guard off, or line mode)", () => {
    expect(messages(guard([bl("a", 7, "Gift box")], { bundles: [], st: "tok" }))).toEqual([]);
    expect(checkBundles([], { lines: [bl("a", 7, "Gift box")] })).toEqual([]);
  });
  test("each bare bundle line gets its own message and the order limits still run", () => {
    expect(messages(guard([bl("a", 7, "Gift box"), bl("b", 9, "Duo")], { bundles: ["7", "9"], st: "tok", rules: [{ kind: "maxItems", value: 1 }] }))).toEqual([
      "Gift box is a bundle. Pick its items on its page, then add it to your cart.",
      "Duo is a bundle. Pick its items on its page, then add it to your cart.",
      "You can order up to 1 items.",
    ]);
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
