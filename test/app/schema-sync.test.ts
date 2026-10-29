/**
 * Local development uses prisma/schema.prisma (SQLite) and production prisma/postgres/schema.prisma (Postgres, Render).
 * A table added to one and not the other breaks only production, so both must have the same models and fields, and
 * each migration folder needs its twin. Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

const models = (file: string) => {
  const out: Record<string, string[]> = {};
  for (const m of fs.readFileSync(file, "utf8").matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    out[m[1]] = m[2].split("\n").map((l) => l.trim().split(/\s+/)[0]).filter((w) => /^[a-z]\w*$/.test(w)).sort();
  }
  return out;
};

test("the SQLite and Postgres schemas have the same tables and fields", () => {
  assert.deepEqual(models("prisma/postgres/schema.prisma"), models("prisma/schema.prisma"));
});

test("every migration has its Postgres twin from the scheduled offers on", () => {
  const sqlite = fs.readdirSync("prisma/migrations").filter((d) => /^\d{14}_/.test(d) && d >= "20261107000000");
  const pg = new Set(fs.readdirSync("prisma/postgres/migrations"));
  assert.deepEqual(sqlite.filter((d) => !pg.has(d)), []);
});
