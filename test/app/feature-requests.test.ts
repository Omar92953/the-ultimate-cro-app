import test from "node:test";
import assert from "node:assert/strict";
import { cleanRequest, MAX_TEXT } from "../../app/lib/feature-requests";

test("a request needs text", () => {
  assert.equal(cleanRequest("  ", "cart").ok, false);
  assert.equal(cleanRequest(undefined, "").ok, false);
});

test("text and place are trimmed", () => {
  assert.deepEqual(cleanRequest("  gift wrap ", " cart "), { ok: true, text: "gift wrap", place: "cart" });
});

test("too long text is refused, place is optional", () => {
  assert.equal(cleanRequest("x".repeat(MAX_TEXT + 1), "").ok, false);
  assert.equal(cleanRequest("ok", "").ok, true);
});
