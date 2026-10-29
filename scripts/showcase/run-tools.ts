/**
 * Runs the app's own MCP build tools (app/lib/mcp) against a dev store through the Shopify CLI, so a showcase store is
 * set up with the same save code as the app's pages. Usage:
 *   node --experimental-strip-types --no-warnings --import ./test/app/resolve-ts.mjs scripts/showcase/run-tools.ts <store> <steps.json>
 * steps.json: [{ "tool": "create_offer", "args": { ... } }, ...]. Only for dev stores (Testing 3).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { READ_TOOLS, type Tool, type ToolContext } from "../../app/lib/mcp/tools.server";
import { BUILD_TOOLS, PUBLISH_TOOLS } from "../../app/lib/mcp/build-tools.server";
import { DEAL_TOOLS } from "../../app/lib/mcp/deal-tools.server";
import { BUNDLE_TOOLS } from "../../app/lib/mcp/bundle-tools.server";
import { listBundles, listRules, saveBundle, saveRule } from "../../app/lib/cro.server";
import { listDeals, saveDeal } from "../../app/lib/deals.server";

const [store, stepsFile] = process.argv.slice(2);
if (!store?.endsWith(".myshopify.com") || !stepsFile) throw new Error("usage: run-tools.ts <store>.myshopify.com <steps.json>");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cro-tools-"));
let n = 0;
const admin = {
  async graphql(query: string, options?: { variables?: Record<string, unknown> }) {
    const q = path.join(dir, `q${++n}.graphql`), out = path.join(dir, `o${n}.json`);
    fs.writeFileSync(q, query);
    const r = spawnSync("shopify", ["app", "execute", "-s", store, "--no-input", "--query-file", q, "-v", JSON.stringify(options?.variables ?? {}), "--output-file", out], { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "--dns-result-order=ipv4first" } });
    let body: unknown;
    try { body = { data: JSON.parse(fs.readFileSync(out, "utf8")) }; } catch { body = { errors: [{ message: (r.stdout + r.stderr).slice(-800) }] }; }
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  },
};
// switch_off: the build tools only switch offers on; this turns an offer, deal or bundle off with the app's own save code.
const SWITCH_OFF: Tool = {
  name: "switch_off",
  description: "Switch an offer, deal or bundle off (by id or handle).",
  needs: "publish",
  schema: {},
  async run(c, args) {
    const id = String(args.id);
    const rule = (await listRules(c.admin)).find((r) => r.id === id || r.handle === id);
    if (rule) return saveRule(c.admin, { ...rule, active: false });
    const deal = (await listDeals(c.admin)).find((d) => d.id === id || d.handle === id);
    if (deal) return saveDeal(c.admin, { ...deal, active: false });
    const bundle = (await listBundles(c.admin)).find((b) => b.id === id || b.handle === id);
    if (bundle) return saveBundle(c.admin, { ...bundle, active: false });
    throw new Error("not found");
  },
};
const tools: Tool[] = [...READ_TOOLS, ...BUILD_TOOLS, ...DEAL_TOOLS, ...BUNDLE_TOOLS, ...PUBLISH_TOOLS, SWITCH_OFF];
const ctx: ToolContext = { admin, shop: store, plan: "pro", trial: null, planUrl: "", grant: { id: "showcase", shop: store, kind: "token", name: "showcase", scope: "build", allowPublish: true } };
for (const step of JSON.parse(fs.readFileSync(stepsFile, "utf8")) as { tool: string; args: Record<string, unknown> }[]) {
  const t = tools.find((x) => x.name === step.tool);
  if (!t) { console.log(`✗ ${step.tool}: no such tool`); continue; }
  try {
    console.log(`✓ ${step.tool}`, JSON.stringify(await t.run(ctx, step.args)).slice(0, 4000));
  } catch (e) {
    console.log(`✗ ${step.tool}`, (e as Error).message);
  }
}
