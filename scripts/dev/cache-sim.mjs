/**
 * Dev only: counts the Admin API reads a short session needs with the old rule (every save forgets the
 * whole shop cache) and the new one (a save forgets only what it can change), and what that costs at
 * 150 ms per Shopify call (the 0.1 to 0.5 s of docs/hosting.md).
 *   node --experimental-strip-types --no-warnings --import ./test/app/resolve-ts.mjs scripts/dev/cache-sim.mjs
 */
import { forgetShop, namesToForget, remember } from "../../app/lib/short-cache.server.ts";

const CALL_MS = 150;
// Page → the Shopify reads its loader asks for (cached names; the number is how many calls the read makes).
const READS = { frame: [["plan", 2]], storefront: [["hub", 6], ["status", 1], ["style", 1]], home: [["hub", 6], ["status", 1], ["home", 5]] };
const session = [
  ["open Storefront", "storefront"], ["save a design", { save: "/app/designs/upsell" }], ["open Storefront", "storefront"],
  ["save an offer", { save: "/app/offers/upsell/new" }], ["open Home", "home"], ["see on store (draft)", { save: "/app/designs/upsell", intent: "draft" }], ["open Home", "home"],
  ["save a design", { save: "/app/designs/faq" }], ["open Storefront", "storefront"],
];

async function run(label, forget, planMs) {
  const shop = `${label}.myshopify.com`;
  let calls = 0;
  const get = (name, n, ttl = 30000) => remember(shop, name, ttl, async () => ((calls += n), name));
  const rows = [];
  for (const [what, step] of session) {
    const before = calls;
    if (typeof step === "string") {
      await get("plan", READS.frame[0][1], planMs); // the app frame (every page)
      for (const [name, n] of READS[step]) await get(name, n);
    } else {
      forget(shop, step.save, step.intent);
      await get("plan", READS.frame[0][1], planMs); // a save also checks the plan
    }
    rows.push(`${what.padEnd(24)} ${String(calls - before).padStart(2)} calls`);
  }
  return { rows, calls };
}
const old = await run("old", (shop) => forgetShop(shop), 60000);
const now = await run("new", (shop, path, intent) => forgetShop(shop, namesToForget(path, intent)), 300000);
console.log("step                      old        |  new");
old.rows.forEach((r, i) => console.log(`${r}  |  ${now.rows[i].slice(24)}`));
console.log(`total Shopify calls: ${old.calls} -> ${now.calls}; at ${CALL_MS} ms each: ${old.calls * CALL_MS} ms -> ${now.calls * CALL_MS} ms`);
