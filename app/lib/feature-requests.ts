/**
 * "Request a feature" (Home, Growth and up): what a merchant may send and how a request's status
 * is shown. Pure, so test/app can load it. Saving: feature-requests.server.ts.
 */
export const REQUEST_STATUSES = ["new", "planned", "done", "declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** What the merchant sees for each status (Omar sets the status in the database, docs/billing.md). */
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: "Received",
  planned: "We're building it",
  done: "Built",
  declined: "Not planned",
};

export const MAX_TEXT = 2000;
export const MAX_PLACE = 300;

/** Trims and checks a request. Returns the clean values, or the message to show. */
export function cleanRequest(text: unknown, place: unknown): { ok: true; text: string; place: string } | { ok: false; error: string } {
  const t = String(text ?? "").trim();
  const p = String(place ?? "").trim();
  if (!t) return { ok: false, error: "Tell us what your store should do." };
  if (t.length > MAX_TEXT) return { ok: false, error: `Please keep it under ${MAX_TEXT} characters.` };
  if (p.length > MAX_PLACE) return { ok: false, error: `Where it should show: please keep it under ${MAX_PLACE} characters.` };
  return { ok: true, text: t, place: p };
}
