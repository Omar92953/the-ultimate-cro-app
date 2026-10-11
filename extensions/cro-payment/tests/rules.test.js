import { describe, expect, test } from "vitest";
import { cartPaymentMethodsTransformRun } from "../src/cart_payment_methods_transform_run.js";

const cart = (total, extra = {}) => ({ cost: { subtotalAmount: { amount: String(total) } }, lines: [{ merchandise: { __typename: "ProductVariant", product: { id: "gid://shopify/Product/1" } } }], deliveryGroups: [{ deliveryAddress: { countryCode: "EG" } }], buyerIdentity: null, ...extra });
const methods = [{ id: "pm1", name: "Credit card" }, { id: "pm2", name: "Cash on Delivery (COD)" }];
const run = (rules, c) => cartPaymentMethodsTransformRun({ cart: c, paymentMethods: methods, paymentCustomization: { metafield: { jsonValue: { rules } } } });

describe("payment rules", () => {
  test("no config, no changes", () => {
    expect(cartPaymentMethodsTransformRun({ cart: cart(10), paymentMethods: methods, paymentCustomization: { metafield: null } }).operations).toEqual([]);
  });
  test("hides cash on delivery above a total", () => {
    const rules = [{ match: "cash on delivery", action: "hide", when: { min: 100 } }];
    expect(run(rules, cart(50)).operations).toEqual([]);
    expect(run(rules, cart(150)).operations).toEqual([{ paymentMethodHide: { paymentMethodId: "pm2" } }]);
  });
  test("country and returning customer conditions", () => {
    const rules = [{ match: "cod", action: "rename", name: "Pay at your door", when: { countries: ["EG"], customer: "returning" } }];
    expect(run(rules, cart(10)).operations).toEqual([]);
    expect(run(rules, cart(10, { buyerIdentity: { customer: { numberOfOrders: 2 } } })).operations).toEqual([{ paymentMethodRename: { paymentMethodId: "pm2", name: "Pay at your door" } }]);
    expect(run(rules, cart(10, { deliveryGroups: [{ deliveryAddress: { countryCode: "US" } }], buyerIdentity: { customer: { numberOfOrders: 2 } } })).operations).toEqual([]);
  });
  test("moves a method to the top", () => {
    expect(run([{ match: "cash", action: "move", index: 0 }], cart(10)).operations).toEqual([{ paymentMethodMove: { paymentMethodId: "pm2", index: 0 } }]);
  });
});
