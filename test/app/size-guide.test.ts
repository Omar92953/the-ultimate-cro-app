/** Size guide (app/lib/size-guide.ts and the storefront copy of its rules). Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { applyFinderStarter, convertCell, finderAsks, recommendSize, SAMPLE_CHART, toStorefrontSizeGuide, usualFromSizes, withSizeGuideDefaults, type Fit } from "../../app/lib/size-guide";

const c0 = () => structuredClone(SAMPLE_CHART);
import { FEATURE_PLAN } from "../../app/lib/plans";
import { feature } from "../../app/lib/catalog";

// The storefront script keeps its own copy of the rules; load it and compare.
const sandbox: Record<string, unknown> = { document: { querySelectorAll: () => [] } };
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync("extensions/cro-storefront/assets/ucs-size-guide.js", "utf8"), sandbox);
const js = sandbox.__ucsSgRecommend as (c: unknown, h: number | null, w: number | null, f: string, u?: string | null) => { size: string; index: number } | null;
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
  assert.equal(recommendSize({ ...c, rec: { ...c.rec, fit: false } }, 172, 70, "relaxed")?.size, "M");
  // A chart with only weight ranges answers from weight.
  const w = { ...c, rows: c.rows.map((r) => ({ ...r, height: [null, null] as [null, null] })) };
  assert.equal(recommendSize(w, null, 70)?.size, "M");
});

test("the size finder: questions switched off are skipped, and a usual size answers on its own", () => {
  const c = SAMPLE_CHART;
  // Height switched off: only weight counts.
  assert.equal(recommendSize({ ...c, rec: { ...c.rec, height: false } }, 150, 70)?.size, "M");
  // Usual size: "M elsewhere" maps to L here; the fit question still moves it.
  const u = { ...c, rec: { ...c.rec, usual: { on: true, answers: [{ answer: "M", size: "L" }, { answer: "L", size: "XL" }] } } };
  assert.equal(recommendSize(u, null, null, "regular", "M")?.size, "L");
  assert.equal(recommendSize(u, null, null, "snug", "M")?.size, "M");
  // An unknown answer falls back to height and weight.
  assert.equal(recommendSize(u, 172, 70, "regular", "XS")?.size, "M");
  assert.deepEqual(finderAsks(u), { height: true, weight: true, usual: true, fit: true });
});

test("starters fill typical ranges by size name, and usual answers can start from the chart's sizes", () => {
  const blank = { ...c0(), rows: c0().rows.map((r) => ({ ...r, height: [null, null] as [null, null], weight: [null, null] as [null, null] })) };
  const t = applyFinderStarter(blank, "tops");
  assert.deepEqual(t.rows.find((r) => r.size === "M")?.height, [166, 176]);
  assert.equal(recommendSize(t, 170, 66)?.size, "M");
  const u = usualFromSizes(blank);
  assert.deepEqual(u.rec.usual.answers.map((a) => a.answer), ["S", "M", "L", "XL"]);
});

test("the storefront script gives the same answers as the app", () => {
  const usualChart = { ...SAMPLE_CHART, rec: { ...SAMPLE_CHART.rec, height: false, usual: { on: true, answers: [{ answer: "M", size: "L" }] } } };
  for (const u of [null, "M", "XS"]) for (const w of [null, 58, 70, 95]) for (const f of ["snug", "regular", "relaxed"] as Fit[]) {
    assert.equal(JSON.stringify(js(usualChart, 172, w, f, u)), JSON.stringify(recommendSize(usualChart, 172, w, f, u)), `usual ${u} ${w} ${f}`);
  }
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
