/** CRO sections (app/lib/cro-sections.ts) and the pop up code (proxy.subscribe.tsx). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import { BLOCK_KINDS, SEC_KINDS, SEC_META, SEC_PRESETS, applySecPreset, defaultSec, kindOfSlug, secSlug, toStorefrontSec, withSecDefaults } from "../../app/lib/cro-sections";
import { FEATURES } from "../../app/lib/catalog";
import { FEATURE_PLAN } from "../../app/lib/plans";
import { popupCode } from "../../app/lib/popup-code.server";

test("every kind is a feature with a plan and a design page at its slug", () => {
  for (const k of SEC_KINDS) {
    assert.ok(FEATURES[k], k);
    assert.ok(FEATURE_PLAN[k], k);
    assert.equal(FEATURES[k].tabs[0].href, `/app/designs/cro/${secSlug(k)}`);
    assert.equal(kindOfSlug(secSlug(k)), k);
  }
  assert.equal(kindOfSlug("../etc"), null);
  assert.ok(!(BLOCK_KINDS as string[]).includes("email_popup"));
});

test("defaults survive a round trip, and bad input is cleaned", () => {
  for (const k of SEC_KINDS) assert.deepEqual(withSecDefaults(k, JSON.parse(JSON.stringify(defaultSec(k)))), defaultSec(k));
  const c = withSecDefaults("compare_table", { look: { bg: "red", radius: 999 }, content: { them: ["A", "B", "C", "D"], rows: [{ label: "x", us: "y", them: ["n"] }] } });
  assert.equal(c.look.bg, "#ffffff");
  assert.equal(c.look.radius, 40);
  assert.equal(c.content.them.length, 3);
  assert.deepEqual(c.content.rows[0].them, ["n", "n", "n"]);
  assert.equal(withSecDefaults("product_tabs", { content: { tabs: [{ title: "Care", mf: "custom.care" }, { title: "Bad", mf: "x' | y" }] } }).content.tabs[1].mf, "");
});

test("each template changes only the look and layout, never the merchant's content", () => {
  for (const k of SEC_KINDS) {
    assert.ok(SEC_PRESETS[k].length >= 3, k);
    const base = withSecDefaults(k, { heading: "Mine", content: defaultSec(k).content });
    for (const p of SEC_PRESETS[k]) {
      const out = applySecPreset(base, p.key);
      assert.equal(out.heading, "Mine");
      assert.deepEqual(out.content, base.content);
    }
  }
});

test("the storefront copy carries the kind, its class and only drawable items", () => {
  const b = toStorefrontSec(withSecDefaults("benefits", { content: { items: [{ icon: "truck", title: "Fast" }, { icon: "", title: "", text: "" }] } }));
  assert.equal(b.k, "benefits");
  assert.match(b.cls, /usec-benefits/);
  assert.equal((b.d as { items: unknown[] }).items.length, 1);
  assert.match((b.d as { items: { i: string }[] }).items[0].i, /<path/);
  const pop = toStorefrontSec(withSecDefaults("email_popup", {})) as { on: boolean; d: Record<string, unknown> };
  assert.equal(pop.on, false);
  assert.equal("discount" in pop.d, false, "the discount terms stay on the server");
});

test("titles and texts have no dashes", () => {
  for (const k of SEC_KINDS) {
    assert.doesNotMatch(SEC_META[k].title + SEC_META[k].hint + FEATURES[k].about, /[—–]| - /);
    for (const p of SEC_PRESETS[k]) assert.doesNotMatch(p.title, /[—–-]/);
  }
});

test("the pop up code is the same for the same email and differs between emails and shops", () => {
  const a = popupCode("a.myshopify.com", "x@y.com", "s");
  assert.match(a, /^WELCOME-[A-Z2-9]{6}$/);
  assert.equal(popupCode("a.myshopify.com", "x@y.com", "s"), a);
  assert.notEqual(popupCode("a.myshopify.com", "z@y.com", "s"), a);
  assert.notEqual(popupCode("b.myshopify.com", "x@y.com", "s"), a);
});
