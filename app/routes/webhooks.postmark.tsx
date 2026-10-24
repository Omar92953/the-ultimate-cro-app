/**
 * Postmark calls this for bounces, spam complaints and unsubscribes on loyalty emails (made by
 * startLoyaltyJobs with the key in the address). The member is marked so no more emails go to them.
 */
import { tooLarge } from "../lib/body-limit.server";
import type { ActionFunctionArgs } from "react-router";
import { sameSecret } from "../lib/tracking/secret.server";
import { providerEvent, webhookKey } from "../lib/loyalty/mailer.server";

export const loader = () => new Response("Use POST.", { status: 405, headers: { Allow: "POST" } });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!sameSecret(new URL(request.url).searchParams.get("key") ?? "", webhookKey())) return new Response("Not accepted", { status: 404 });
  if (tooLarge(request, 256 * 1024)) return new Response("Too large", { status: 413 });
  const raw = await request.text();
  if (raw.length > 256 * 1024) return new Response("Too large", { status: 413 });
  try {
    await providerEvent(JSON.parse(raw));
  } catch {
    return new Response("Send JSON.", { status: 400 });
  }
  return new Response("ok");
};
