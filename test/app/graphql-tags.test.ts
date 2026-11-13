/**
 * A `#graphql` tag must end its line: in GraphQL `#` comments out the rest of the line, so `#graphql query X { … }` on one
 * line sends an empty query that always fails (the A/B tests and loyalty analytics showed dollars on every store, 2026-11-13).
 * Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? (e.name === "types" ? [] : files(p)) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

test("every #graphql tag is alone on its line", () => {
  const bad = files("app").filter((f) => /`#graphql[ \t]+\S/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(bad, []);
});
