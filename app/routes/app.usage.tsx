/**
 * Data for the usage bars (components/UsageBars.tsx): this month's use of each plan limit, and the "Allow extra"
 * switches (lib/usage.server.ts). Loaded by the bars wherever they show; no page of its own.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getPlan } from "../lib/billing.server";
import { setExtra, usageSummary } from "../lib/usage.server";
import { METER_KEYS, type MeterKey } from "../lib/plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { plan } = await getPlan(admin, session.shop);
  return { meters: await usageSummary(session.shop, plan) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const meter = String(form.get("meter")) as MeterKey;
  if (!METER_KEYS.includes(meter)) return { ok: false };
  await setExtra(session.shop, meter, form.get("on") === "true");
  return { ok: true };
};
