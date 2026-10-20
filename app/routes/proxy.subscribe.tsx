/**
 * The email pop up on the store posts here through the app proxy (/apps/ucro/subscribe). Shopify signs the request.
 * Adds the email to the store's own customers with email marketing consent (tag cro-popup) and returns a one use
 * discount code that only this customer can use. The code is derived from the shop and email, so the same email
 * gets the same code back and the app stores nothing (no email, no code). Needs write_customers and write_discounts.
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { AdminError, gql, type AdminClient } from "../lib/admin.server";
import { getSec } from "../lib/designs.server";
import type { SecContent } from "../lib/cro-sections";
import { popupCode } from "../lib/popup-code.server";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// A few sign ups per visitor per hour (per server process), against code farming.
const recent = new Map<string, number[]>();
function tooMany(key: string) {
  const now = Date.now();
  const list = (recent.get(key) ?? []).filter((t) => now - t < 60 * 60_000);
  if (list.length >= 5) return true;
  recent.set(key, [...list, now]);
  if (recent.size > 5000) recent.clear();
  return false;
}

const CONSENT = () => ({ marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN", consentUpdatedAt: new Date().toISOString() });

/** Finds or creates the customer and sets email marketing consent. Returns the customer id. */
async function subscribe(admin: AdminClient, email: string): Promise<string> {
  const found = await gql(admin, `#graphql
    query CroPopupCustomer($q: String!) { customers(first: 1, query: $q) { nodes { id emailMarketingConsent { marketingState } } } }`, { q: `email:"${email.replace(/"/g, "")}"` });
  const c = found.customers?.nodes?.[0];
  if (!c) {
    const made = await gql(admin, `#graphql
      mutation CroPopupCreate($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { field message } } }`, { input: { email, tags: ["cro-popup"], emailMarketingConsent: CONSENT() } });
    const id = made.customerCreate?.customer?.id;
    if (!id) throw new AdminError(made.customerCreate?.userErrors?.[0]?.message ?? "Customer not created");
    return id;
  }
  if (c.emailMarketingConsent?.marketingState !== "SUBSCRIBED") {
    await gql(admin, `#graphql
      mutation CroPopupConsent($input: CustomerEmailMarketingConsentUpdateInput!) { customerEmailMarketingConsentUpdate(input: $input) { userErrors { field message } } }`, { input: { customerId: c.id, emailMarketingConsent: CONSENT() } });
  }
  await gql(admin, `#graphql
    mutation CroPopupTag($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`, { id: c.id, tags: ["cro-popup"] });
  return c.id;
}

/** The customer's own code: once, only for them, product discounts may combine. Already made = same code. */
async function ensureCode(admin: AdminClient, code: string, customerId: string, d: SecContent["email_popup"]["discount"]) {
  const value = d.type === "percent" ? { percentage: d.value / 100 } : { discountAmount: { amount: d.value.toFixed(2), appliesOnEachItem: false } };
  try {
    await gql(admin, `#graphql
      mutation CroPopupCode($d: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message code } } }`, {
      d: {
        title: `Email pop up: ${code}`,
        code,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + d.days * 86_400_000).toISOString(),
        usageLimit: 1,
        appliesOncePerCustomer: true,
        context: { customers: { add: [customerId] } },
        customerGets: { value, items: { all: true } },
        ...(d.minimum > 0 ? { minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: d.minimum.toFixed(2) } } } : {}),
        combinesWith: { productDiscounts: true, orderDiscounts: false, shippingDiscounts: true },
      },
    });
  } catch (e) {
    // The same email signing up again: its code already exists.
    if (!(e instanceof AdminError) || !/taken|unique|already/i.test(e.message)) throw e;
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.public.appProxy(request);
  if (!session || !admin) return json({ ok: false, error: "This store can't take sign ups right now." }, 503);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Something went wrong. Please try again." }, 400);
  }
  if (String(body.company ?? "").trim()) return json({ ok: true, code: "" });
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "Please enter a valid email." }, 400);
  if (body.ok !== true) return json({ ok: false, error: "Please tick the box to sign up." }, 400);
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (tooMany(`${session.shop}|${ip}`)) return json({ ok: false, error: "Please wait a little and try again." }, 429);
  try {
    const { config } = await getSec(admin, "email_popup");
    if (!config.content.on) return json({ ok: false, error: "Sign ups are closed right now." }, 403);
    const customerId = await subscribe(admin, email);
    const code = popupCode(session.shop, email);
    await ensureCode(admin, code, customerId, config.content.discount);
    return json({ ok: true, code });
  } catch (e) {
    console.error("[popup] sign up failed", session.shop, e instanceof Error ? e.message : e);
    return json({ ok: false, error: "Could not sign you up. Please try again." }, 500);
  }
};
