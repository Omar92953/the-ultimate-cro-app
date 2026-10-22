/**
 * Loyalty in Shopify Plus checkout (extensions/cro-loyalty-checkout, reductions block): the signed in customer's
 * rewards (GET) and spending points on one (POST { reward }), which returns a code the extension applies.
 * Authenticated with the checkout session token: `dest` is the store, `sub` the signed in customer (absent for
 * guests: nothing to spend). Needs the extension's network access, approved in the Partner Dashboard.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { tooMany } from "../lib/proxy-guard.server";
import { counterContext, customerIdOf, memberOf, redeemAtCounter, rewardsFor, shopOf, summaryOf } from "../lib/loyalty/counter.server";

async function context(request: Request) {
  const { sessionToken, cors } = await authenticate.public.checkout(request);
  const shop = shopOf(sessionToken.dest);
  const customerId = customerIdOf(sessionToken.sub);
  const ctx = shop ? await counterContext(shop) : null;
  const member = ctx && shop && customerId ? await memberOf(shop, customerId) : null;
  return { cors, shop, ctx, member };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { cors, ctx, member } = await context(request);
  if (!ctx || !member || member.blocked) return cors(Response.json({ ok: false, error: "off" }));
  return cors(Response.json({ ok: true, member: summaryOf(ctx.config, member), rewards: rewardsFor(ctx.config, member, true) }));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { cors, shop, ctx, member } = await context(request);
  if (!ctx || !shop || !member || member.blocked) return cors(Response.json({ ok: false, error: "off" }));
  if (tooMany(request, shop, "loyalty-checkout", 20)) return cors(Response.json({ ok: false, error: "too many" }, { status: 429 }));
  const body = (await request.json().catch(() => null)) as { reward?: unknown } | null;
  const rewardId = String(body?.reward ?? "");
  if (!rewardsFor(ctx.config, member, true).some((r) => r.id === rewardId)) return cors(Response.json({ ok: false, error: "This reward can't be used here." }));
  return cors(Response.json(await redeemAtCounter(ctx, shop, member.id, rewardId)));
};
