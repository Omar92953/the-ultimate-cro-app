import { describe, expect, test } from "vitest";
import { cartDeliveryOptionsTransformRun } from "../src/cart_delivery_options_transform_run.js";

const group = (options, country = "EG") => ({ deliveryAddress: { countryCode: country }, deliveryOptions: options.map(([handle, title, amount = "0"]) => ({ handle, title, cost: { amount } })) });
const cart = (total, groups, extra = {}) => ({ cost: { subtotalAmount: { amount: String(total) } }, lines: [{ merchandise: { __typename: "ProductVariant", product: { id: "gid://shopify/Product/1" } } }], deliveryGroups: groups, buyerIdentity: null, ...extra });
const run = (rules, c) => cartDeliveryOptionsTransformRun({ cart: c, deliveryCustomization: { metafield: { jsonValue: { rules } } } });

describe("delivery rules", () => {
  test("hides express for a product", () => {
    const c = cart(10, [group([["s", "Standard", "50"], ["e", "Express", "120"]])]);
    expect(run([{ match: "express", action: "hide", when: { products: ["gid://shopify/Product/1"] } }], c).operations).toEqual([{ deliveryOptionHide: { deliveryOptionHandle: "e" } }]);
    expect(run([{ match: "express", action: "hide", when: { products: ["gid://shopify/Product/9"] } }], c).operations).toEqual([]);
  });
  test("never hides the last option of a group", () => {
    const c = cart(10, [group([["s", "Standard"]])]);
    expect(run([{ match: "standard", action: "hide" }], c).operations).toEqual([]);
  });
  test("keeps the cheapest option the default (App Store 1.1.10)", () => {
    const c = cart(10, [group([["f", "Free shipping", "0"], ["e", "Express", "120"]])]);
    expect(run([{ match: "free", action: "hide" }], c).operations).toEqual([]);
    expect(run([{ match: "express", action: "move", index: 0 }], c).operations).toEqual([{ deliveryOptionMove: { deliveryOptionHandle: "e", index: 1 } }]);
    expect(run([{ match: "free", action: "move", index: 1 }], c).operations).toEqual([]);
  });
  test("renames above a total", () => {
    const c = cart(200, [group([["s", "Standard"]])]);
    expect(run([{ match: "standard", action: "rename", name: "Free 2–3 day delivery", when: { min: 150 } }], c).operations).toEqual([{ deliveryOptionRename: { deliveryOptionHandle: "s", title: "Free 2–3 day delivery" } }]);
  });
});
