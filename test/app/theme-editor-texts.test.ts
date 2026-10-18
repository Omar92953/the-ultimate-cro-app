/** The words merchants read in the theme editor use the app's names: "Cross sell" and "Style" (not "Cross-sell" and "Design"). Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

const strings = (v: unknown): string[] => (typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);

test("block schemas and notes in the theme editor say Cross sell and Style", () => {
  const bad = /Cross-sell|→ Design\b/;
  for (const f of fs.readdirSync("theme/blocks").filter((n) => n.endsWith(".liquid"))) {
    const m = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/.exec(fs.readFileSync(`theme/blocks/${f}`, "utf8"));
    if (!m) continue;
    for (const s of strings(JSON.parse(m[1]))) assert.doesNotMatch(s, bad, `${f}: ${s}`);
  }
  // The notes only the merchant sees in the theme editor, in the cross sell snippet.
  const body = fs.readFileSync("theme/snippets/ucro-cross-sell-body.liquid", "utf8");
  for (const line of body.split("\n").filter((l) => !/^\s*(#|\{%-?\s*comment)/.test(l))) assert.doesNotMatch(line, bad, line.trim());
});
