/**
 * The webhook link a store gives its carrier or tracking service (Tracking & Returns → where tracking comes from).
 * POST a tracking update; the secret in the address says which store it is for. Public: no admin session.
 */
import { tooLarge } from "../lib/body-limit.server";
import type { ActionFunctionArgs } from "react-router";
import { ingestPush } from "../lib/tracking/tracking.server";

export const loader = () => new Response("Use POST.", { status: 405, headers: { Allow: "POST" } });

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== "POST") return new Response("Use POST.", { status: 405, headers: { Allow: "POST" } });
  if (tooLarge(request, 256 * 1024)) return new Response("Too large", { status: 413 });
  const raw = await request.text();
  if (raw.length > 256 * 1024) return new Response("Too large", { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Send JSON.", { status: 400 });
  }
  const ok = await ingestPush(String(params.shop ?? "").slice(0, 120), String(params.secret ?? "").slice(0, 120), body).catch(() => false);
  // The same answer for a wrong link and a wrong body: nothing to learn about other stores.
  return ok ? new Response("ok", { status: 200 }) : new Response("Not accepted", { status: 404 });
};
