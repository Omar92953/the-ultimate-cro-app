/** Saves what the Track page sells (next order discount…): lib/track-sell.ts. Resource route used by the Track page editor. */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { planContext } from "../lib/rules.server";
import { requireFeature } from "../lib/rules";
import { saveTrackSell } from "../lib/track-sell.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const { plan, trial } = await planContext(admin, session.shop);
    requireFeature(plan, "track", trial);
    const sell = await saveTrackSell(admin, session.shop, JSON.parse(String(form.get("sell"))));
    return Response.json({ ok: true, error: null, sell });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e), sell: null });
  }
};
