/** The A/B snippet must pass Shopify's theme check: Liquid's HTML parser reads "i<els" inside a script as the start of a tag. Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

test("ucro-ab.liquid has no '<' followed by a letter inside its script", () => {
  const src = fs.readFileSync("theme/snippets/ucro-ab.liquid", "utf8");
  const script = /<script>([\s\S]*)<\/script>/.exec(src)?.[1] ?? "";
  assert.ok(script.length > 100);
  assert.deepEqual(script.match(/<[a-zA-Z/!]/g), null);
});
