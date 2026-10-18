/**
 * Wording rule for the app's own text (Omar, 2026-10-18): buttons, labels, helper text and tool descriptions are written the way Shopify's
 * admin writes them, short and neutral, never in the first person ("See it on my store", "Create it for me", "I've done it").
 * Text the merchant writes for shoppers, and words a shopper says ("Find my order", "Notify me", "Changed my mind"), are not the app's voice and stay.
 * Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []));

/** Source without comments, so a note to a developer may still quote an old label. */
const withoutComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

const FORBIDDEN: [RegExp, string][] = [
  [/See it on my store/i, "Preview on store"],
  [/I(?:'|&apos;|’)ve done it/i, "Mark as done"],
  [/Create it for me/i, "Create a new one"],
  [/Use a product I have/i, "Connect existing product"],
  [/\bfor me\b/i, "neutral wording"],
  [/\bmy (?:theme|store|shop|plan|files|views|computer|own|products|account|settings|colours|colors)\b/i, "the theme, the store, the plan, own ..."],
  [/\b(?:show|let|give|tell|help|make) me\b/i, "neutral wording"],
  [/\bI(?:'|&apos;|’)(?:m|ll|ve|d)\b/, "neutral wording"],
  [/\bI (?:have|want|need|will|can)\b/, "neutral wording"],
  [/your requests/i, "neutral wording"],
];

test("the app's own text is neutral, not first person", () => {
  const bad: string[] = [];
  for (const dir of ["app/routes", "app/components", "app/lib"]) {
    for (const file of walk(dir)) {
      if (/\/(privacy|terms)\.tsx$/.test(file)) continue; // legal text
      const lines = withoutComments(fs.readFileSync(file, "utf8")).split("\n");
      lines.forEach((line, i) => {
        for (const [re, instead] of FORBIDDEN) if (re.test(line)) bad.push(`${file}:${i + 1}: ${line.trim().slice(0, 100)}  (write: ${instead})`);
      });
    }
  }
  assert.deepEqual(bad, []);
});

test("the wording check catches the old phrases", () => {
  for (const s of ["See it on my store", "I've done it", "Create it for me", "Use a product I have", "Show my store's payment icons", "Match my theme", "Hide my files"]) {
    assert.ok(FORBIDDEN.some(([re]) => re.test(s)), s);
  }
  for (const s of ["Preview on store", "Mark as done", "Find my order", "Notify me", "Changed my mind", "Share my wishlist", "Show the store's payment icons"]) {
    assert.ok(!FORBIDDEN.some(([re]) => re.test(s)), s);
  }
});
