/** Size guide (app/lib/size-guide.ts and the storefront copy of its rules). Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { convertCell, recommendSize, SAMPLE_CHART, toStorefrontSizeGuide, withSizeGuideDefaults, type Fit } from "../../app/lib/size-guide";
import { FEATURE_PLAN } from "../../app/lib/plans";
import { feature } from "../../app/lib/catalog";

// The storefront script keeps its own copy of the rules; load it and compare.
const sandbox: Record<string, unknown> = { document: { querySelectorAll: () => [] } };
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync("extensions/cro-storefront/assets/ucs-size-guide.js", "utf8"), sandbox);
const js = sandbox.__ucsSgRecommend as (c: unknown, h: number | null, w: number | null, f: string) => { size: string; index: number } | null;
const jsConvert = sandbox.__ucsSgConvert as (t: string, a: string, b: string) => string;

test("the size comes only from the merchant's ranges", () => {
  const c = SAMPLE_CHART;
  assert.equal(recommendSize(c, 172, 70)?.size, "M");
  assert.equal(recommendSize(c, 150, 40), null);
  // Height and weight point to different sizes: the larger one.
  assert.equal(recommendSize(c, 163, 80)?.size, "L");
  // Fit shifts one size, and stays inside the chart.
  assert.equal(recommendSize(c, 172, 70, "snug")?.size, "S");
  assert.equal(recommendSize(c, 172, 70, "relaxed")?.size, "L");
  assert.equal(recommendSize(c, 162, 56, "snug")?.size, "S");
  assert.equal(recommendSize(c, 190, 95, "relaxed")?.size, "XL");
  // With "ask for the fit" off, the fit choice does nothing.
  assert.equal(recommendSize({ ...c, rec: { on: true, fit: false } }, 172, 70, "relaxed")?.size, "M");
  // A chart with only weight ranges answers from weight.
  const w = { ...c, rows: c.rows.map((r) => ({ ...r, height: [null, null] as [null, null] })) };
  assert.equal(recommendSize(w, null, 70)?.size, "M");
});

test("the storefront script gives the same answers as the app", () => {
  const fits: Fit[] = ["snug", "regular", "relaxed"];
  for (const h of [null, 150, 160, 165, 172, 180, 190, 200]) for (const w of [null, 40, 58, 66, 70, 80, 95, 120]) for (const f of fits) {
    assert.equal(JSON.stringify(js(SAMPLE_CHART, h, w, f)), JSON.stringify(recommendSize(SAMPLE_CHART, h, w, f)), `${h} ${w} ${f}`);
  }
  for (const t of ["86", "86 to 91", "Chest 88.5", ""]) for (const [a, b] of [["cm", "in"], ["in", "cm"], ["cm", "cm"]] as const) assert.equal(jsConvert(t, a, b), convertCell(t, a, b));
  assert.equal(convertCell("86 to 91", "cm", "in"), "34 to 36");
});

test("charts are cleaned, assigned and copied for the store", () => {
  const d = withSizeGuideDefaults({ charts: [{ id: "a b!", name: "", columns: ["Chest"], rows: [{ size: "M", values: ["94", "extra"], height: [180, 170], weight: ["x", 70] }], match: { all: false, tags: "Tees, Men" } }, { id: "a b!" }] });
  assert.equal(d.charts[0].id, "ab");
  assert.notEqual(d.charts[0].id, d.charts[1].id);
  assert.deepEqual(d.charts[0].rows[0].values, ["94"]);
  assert.deepEqual(d.charts[0].rows[0].height, [170, 180]);
  assert.deepEqual(d.charts[0].rows[0].weight, [null, 70]);
  const store = toStorefrontSizeGuide(d);
  assert.deepEqual(store.charts[0].m.tags, ["tees", "men"]);
  assert.equal(store.charts.length, 2);
  assert.equal(withSizeGuideDefaults({}).charts.length, 1);
  for (const t of Object.values(withSizeGuideDefaults({}).text)) assert.doesNotMatch(t, /[—–]/);
});

test("the size guide is a Starter feature in the section library", () => {
  assert.equal(FEATURE_PLAN.size_guide, "starter");
  assert.equal(feature("size_guide").area, "library");
  assert.equal(feature("size_guide").group, "product");
});

test("the size option words in the app and in the theme block are the same", async () => {
  const { SIZE_OPTION_WORDS, hasSizeOption } = await import("../../app/lib/size-guide");
  const liquid = fs.readFileSync("theme/blocks/ucs-size-guide.liquid", "utf8");
  const list = /assign size_words = '([^']+)' \| split/.exec(liquid)?.[1].split(",");
  assert.deepEqual(list, SIZE_OPTION_WORDS);
  assert.equal(hasSizeOption(["Color", "Shoe Size"]), true);
  assert.equal(hasSizeOption(["Title"]), false);
  assert.equal(hasSizeOption([]), false);
});
