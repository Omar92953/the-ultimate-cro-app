import { describe, expect, test } from "vitest";
import { cartDeliveryOptionsTransformRun } from "../src/cart_delivery_options_transform_run.js";

const group = (options, country = "EG") => ({ deliveryAddress: { countryCode: country }, deliveryOptions: options.map(([handle, title]) => ({ handle, title })) });
const cart = (total, groups, extra = {}) => ({ cost: { subtotalAmount: { amount: String(total) } }, lines: [{ merchandise: { __typename: "ProductVariant", product: { id: "gid://shopify/Product/1" } } }], deliveryGroups: groups, buyerIdentity: null, ...extra });
const run = (rules, c) => cartDeliveryOptionsTransformRun({ cart: c, deliveryCustomization: { metafield: { jsonValue: { rules } } } });

describe("delivery rules", () => {
  test("hides express for a product", () => {
    const c = cart(10, [group([["s", "Standard"], ["e", "Express"]])]);
    expect(run([{ match: "express", action: "hide", when: { products: ["gid://shopify/Product/1"] } }], c).operations).toEqual([{ deliveryOptionHide: { deliveryOptionHandle: "e" } }]);
    expect(run([{ match: "express", action: "hide", when: { products: ["gid://shopify/Product/9"] } }], c).operations).toEqual([]);
  });
  test("never hides the last option of a group", () => {
    const c = cart(10, [group([["s", "Standard"]])]);
    expect(run([{ match: "standard", action: "hide" }], c).operations).toEqual([]);
  });
  test("renames above a total", () => {
    const c = cart(200, [group([["s", "Standard"]])]);
    expect(run([{ match: "standard", action: "rename", name: "Free 2–3 day delivery", when: { min: 150 } }], c).operations).toEqual([{ deliveryOptionRename: { deliveryOptionHandle: "s", title: "Free 2–3 day delivery" } }]);
  });
});
