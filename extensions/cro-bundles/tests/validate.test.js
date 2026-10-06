import { describe, expect, test } from "vitest";
import { validate } from "../src/cart_transform_run.js";

const b36 = (n) => Number(n).toString(36);
// One step: pick 2 of variants 44 and 55, no duplicates.
const bundle = { d: 0, s: [{ n: 2, x: 2, v: [b36(44), b36(55)] }] };

describe("bundle pick validation (shopper-controlled property)", () => {
  test("accepts a valid pick", () => {
    expect(validate("44,55", bundle)).toEqual(new Map([["44", 1], ["55", 1]]));
  });
  test("rejects a leading-zero copy used to dodge the no-duplicates rule", () => {
    expect(validate("44,044", bundle)).toBeNull();
  });
  test("rejects variants that aren't in the step", () => {
    expect(validate("44,66", bundle)).toBeNull();
  });
  test("rejects the wrong number of picks", () => {
    expect(validate("44", bundle)).toBeNull();
    expect(validate("44,55|", bundle)).toBeNull();
  });
});
