/**
 * Loyalty at the POS counter (extensions/cro-loyalty-pos): a customer's points and rewards (GET ?customer=ID) and
 * spending points on one (POST { customer, reward }). Store credit rewards go to the customer's store credit; the
 * others return a code the extension adds to the POS cart. Authenticated with the POS session token (`dest` is the
 * store); POS sends it to the app's own address by itself.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { tooMany } from "../lib/proxy-guard.server";
import { counterContext, customerIdOf, memberOf, redeemAtCounter, rewardsFor, shopOf, summaryOf } from "../lib/loyalty/counter.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.pos(request);
  const shop = shopOf(sessionToken.dest);
  const ctx = shop ? await counterContext(shop) : null;
  if (!shop || !ctx) return cors(Response.json({ ok: false, error: "off" }));
  const customerId = customerIdOf(new URL(request.url).searchParams.get("customer"));
  const member = customerId ? await memberOf(shop, customerId) : null;
  if (!member) return cors(Response.json({ ok: true, member: null, unit: ctx.config.unit }));
  return cors(Response.json({ ok: true, member: summaryOf(ctx.config, member), rewards: member.blocked ? [] : rewardsFor(ctx.config, member, false) }));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.pos(request);
  const shop = shopOf(sessionToken.dest);
  const ctx = shop ? await counterContext(shop) : null;
  if (!shop || !ctx) return cors(Response.json({ ok: false, error: "off" }));
  if (tooMany(request, shop, "loyalty-pos", 60)) return cors(Response.json({ ok: false, error: "too many" }, { status: 429 }));
  const body = (await request.json().catch(() => null)) as { customer?: unknown; reward?: unknown } | null;
  const customerId = customerIdOf(body?.customer);
  const member = customerId ? await memberOf(shop, customerId) : null;
  if (!member || member.blocked) return cors(Response.json({ ok: false, error: "This customer can't use rewards." }));
  const rewardId = String(body?.reward ?? "");
  if (!rewardsFor(ctx.config, member, false).some((r) => r.id === rewardId)) return cors(Response.json({ ok: false, error: "This reward can't be used for this customer." }));
  return cors(Response.json(await redeemAtCounter(ctx, shop, member.id, rewardId)));
};
