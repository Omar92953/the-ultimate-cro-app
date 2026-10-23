/**
 * The email pop up's sign up (routes/proxy.subscribe.tsx): finds or creates the store's customer for a typed email and
 * sets email marketing consent. Shopify's customer search is loose (a typed "*" or a partial address can match
 * someone else), so a customer is only used when their own email is exactly the typed one: a visitor can never
 * change another customer's consent or tags.
 */
import { AdminError, gql, type AdminClient } from "./admin.server";

/** A plain email address (no search characters), lower case; "" when it isn't one. */
export function popupEmail(raw: unknown) {
  const email = String(raw ?? "").trim().toLowerCase().slice(0, 120);
  return /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) ? email : "";
}

const CONSENT = () => ({ marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN", consentUpdatedAt: new Date().toISOString() });

/** Finds (exact email only) or creates the customer and sets email marketing consent. Returns the customer id. */
export async function subscribe(admin: AdminClient, email: string): Promise<string> {
  if (!popupEmail(email)) throw new AdminError("Not an email address.");
  const found = await gql(admin, `#graphql
    query CroPopupCustomer($q: String!) { customers(first: 10, query: $q) { nodes { id defaultEmailAddress { emailAddress } emailMarketingConsent { marketingState } } } }`, { q: `email:"${email}"` });
  const c = (found.customers?.nodes ?? []).find((n: { defaultEmailAddress?: { emailAddress?: string | null } | null }) => String(n.defaultEmailAddress?.emailAddress ?? "").toLowerCase() === email);
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
