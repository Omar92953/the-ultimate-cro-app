/** The email pop up's sign up never changes another customer (audit 2026-10-23). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminClient } from "../../app/lib/admin.server";
import { mayConsent, popupBase, popupEmail, subscribe } from "../../app/lib/popup-subscribe.server";

/** A store whose customer search returns `found` for any query, recording every call. */
function store(found: { id: string; email: string; state?: string }[]) {
  const calls: { op: string; vars: Record<string, unknown> }[] = [];
  const admin = {
    graphql: async (q: string, o?: { variables?: Record<string, unknown> }) => {
      const op = /(query|mutation) (\w+)/.exec(q)?.[2] ?? "";
      calls.push({ op, vars: o?.variables ?? {} });
      const data =
        op === "CroPopupCustomer" ? { customers: { nodes: found.map((c) => ({ id: c.id, defaultEmailAddress: { emailAddress: c.email }, emailMarketingConsent: { marketingState: c.state ?? "NOT_SUBSCRIBED" } })) } }
        : op === "CroPopupCreate" ? { customerCreate: { customer: { id: "gid://shopify/Customer/NEW" }, userErrors: [] } }
        : { customerEmailMarketingConsentUpdate: { userErrors: [] }, tagsAdd: { userErrors: [] } };
      return { json: async () => ({ data }) };
    },
  } as unknown as AdminClient;
  return { admin, calls };
}

test("a loose search hit for someone else is never subscribed or tagged: a new customer is made", async () => {
  const s = store([{ id: "gid://shopify/Customer/OTHER", email: "victim@example.com" }]);
  const id = await subscribe(s.admin, "new@example.com");
  assert.equal(id, "gid://shopify/Customer/NEW");
  assert.deepEqual(s.calls.map((c) => c.op), ["CroPopupCustomer", "CroPopupCreate"]);
  assert.ok(!s.calls.some((c) => JSON.stringify(c.vars).includes("OTHER")), "the other customer is not touched");
});

test("the customer whose own email matches (any case) is reused and subscribed", async () => {
  const s = store([{ id: "gid://shopify/Customer/A", email: "someone@example.com" }, { id: "gid://shopify/Customer/ME", email: "Me@Example.com" }]);
  assert.equal(await subscribe(s.admin, "me@example.com"), "gid://shopify/Customer/ME");
  assert.deepEqual(s.calls.map((c) => c.op), ["CroPopupCustomer", "CroPopupConsent", "CroPopupTag"]);
  assert.equal((s.calls[1].vars.input as { customerId: string }).customerId, "gid://shopify/Customer/ME");
});

test("emails with search characters are refused before any search", async () => {
  for (const bad of ["*@*.*", 'a"@b.com', "a\\@b.com", "a b@c.com", "a@b", "x@y.com OR tag:vip", ""]) assert.equal(popupEmail(bad), "", bad);
  assert.equal(popupEmail("  Sara.O'Neil+news@Example.co.uk "), "sara.o'neil+news@example.co.uk");
  const s = store([]);
  await assert.rejects(subscribe(s.admin, "*@*.*"));
  assert.equal(s.calls.length, 0);
});

test("someone who unsubscribed is never subscribed again by the pop up (audit A4)", async () => {
  const s = store([{ id: "gid://shopify/Customer/ME", email: "me@example.com", state: "UNSUBSCRIBED" }]);
  assert.equal(await subscribe(s.admin, "me@example.com"), "gid://shopify/Customer/ME");
  assert.deepEqual(s.calls.map((c) => c.op), ["CroPopupCustomer", "CroPopupTag"]);
  assert.equal(mayConsent("NOT_SUBSCRIBED"), true);
  assert.equal(mayConsent(null), true);
  for (const st of ["SUBSCRIBED", "UNSUBSCRIBED", "PENDING", "REDACTED", "INVALID"]) assert.equal(mayConsent(st), false, st);
});

test("tagged copies of one address share its code and limit (audit A4)", () => {
  assert.equal(popupBase("name+1@gmail.com"), "name@gmail.com");
  assert.equal(popupBase("name+a+b@gmail.com"), "name@gmail.com");
  assert.equal(popupBase("name@gmail.com"), "name@gmail.com");
  assert.equal(popupBase("+x@gmail.com"), "+x@gmail.com");
});
