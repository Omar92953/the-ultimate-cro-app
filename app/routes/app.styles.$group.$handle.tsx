/**
 * Opens the style of one offer. An offer that has its own style goes straight to it; the first time,
 * it gets the next free style (a copy of the default, made on the first save). See lib/offer-style.server.ts.
 */
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { existingSlots, freeSlot, isStyleGroup, STYLE_GROUPS, styleOffers } from "../lib/offer-style.server";
import { getPlan } from "../lib/billing.server";
import { limitOf } from "../lib/plans";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { group, handle } = params;
  if (!isStyleGroup(group) || !handle) throw new Response("Not found", { status: 404 });
  const meta = STYLE_GROUPS[group];
  const offers = await styleOffers(admin, group);
  const offer = offers.find((o) => o.handle === handle);
  if (!offer) throw new Response("Offer not found", { status: 404 });
  const q = `offer=${encodeURIComponent(handle)}`;
  if (offer.design > 1) throw redirect(`${meta.design}?design=${offer.design}&${q}`);
  const plan = (await getPlan(admin, session.shop)).plan;
  const slot = freeSlot(offers, await existingSlots(admin, meta.base), limitOf(plan, "designsPerSection") ?? 5);
  if (!slot) throw redirect(`/app/styles/${group}?full=1`);
  throw redirect(`${meta.design}?design=${slot}&copy=1&${q}`);
};
