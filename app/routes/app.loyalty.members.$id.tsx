/** Loyalty → one member: balance, points history, change points (with a reason), block or unblock. */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { adjustPoints, memberWithHistory, setBlocked } from "../lib/loyalty/program.server";
import { eventLabel } from "../lib/loyalty/labels";
import { Button, NumberField, TextField } from "../components/fields";
import { HomeRow, HomeRows, Panel, Pill, StatGrid, StatTile } from "../components/ui";
import css from "../components/TrackingHub.module.css";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const found = await memberWithHistory(session.shop, Number(params.id));
  if (!found) throw new Response("Not found", { status: 404 });
  const { member: m, events } = found;
  return {
    member: { id: m.id, email: m.email, customerId: m.customerId, points: m.points, pending: m.pending, lifetime: m.lifetime, orders: m.orders, spent: m.spent, blocked: m.blocked, referralCode: m.referralCode, joinedAt: m.joinedAt.toISOString() },
    events: events.map((e) => ({ id: e.id, kind: e.kind, points: e.points, note: e.note, status: e.status, createdAt: e.createdAt.toISOString(), availableAt: e.availableAt.toISOString() })),
    shop: session.shop,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const intent = String(form.get("intent"));
    if (intent === "adjust") {
      const done = await adjustPoints(session.shop, Number(params.id), Math.round(Number(form.get("points"))), String(form.get("note") ?? ""));
      if (!done) throw new Error("Type a whole number of points other than 0.");
    } else if (intent === "block") await setBlocked(session.shop, Number(params.id), form.get("blocked") === "true");
    return { ok: true, error: null, intent };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent: "" };
  }
};

export default function LoyaltyMember() {
  const d = useLoaderData<typeof loader>();
  const m = d.member;
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [points, setPoints] = useState(0);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else shopify.toast.show(fetcher.data.intent === "adjust" ? "Points changed" : "Saved");
  }, [fetcher.state, fetcher.data, shopify]);
  const [seen, setSeen] = useState(fetcher.data);
  if (fetcher.data !== seen) {
    setSeen(fetcher.data);
    if (fetcher.data?.ok && fetcher.data.intent === "adjust") {
      setPoints(0);
      setNote("");
    }
  }
  const store = d.shop.replace(".myshopify.com", "");

  return (
    <s-page heading={m.email || `Member ${m.id}`} inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/loyalty/members">
        Members
      </s-link>
      <Button slot="secondary-actions" href={`https://admin.shopify.com/store/${store}/customers/${m.customerId}`} target="_top">
        Open in Shopify
      </Button>
      <HomeRows>
        <HomeRow title="Points" bare>
          <Panel>
            <StatGrid>
              <StatTile label="Ready to use" value={m.points.toLocaleString()} note={m.pending ? `${m.pending.toLocaleString()} pending` : undefined} />
              <StatTile label="Earned in total" value={m.lifetime.toLocaleString()} />
              <StatTile label="Orders" value={String(m.orders)} note={`Referral code ${m.referralCode}`} />
            </StatGrid>
          </Panel>
        </HomeRow>

        <HomeRow title="Change points">
          <s-stack gap="base">
            <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 2fr)" gap="base">
              <NumberField label="Points" details="A minus number takes points away." min={-1000000} max={1000000} step={10} value={points} onValue={setPoints} />
              <TextField label="Reason (the member sees it in their history)" maxLength={200} value={note} onValue={setNote} />
            </s-grid>
            <s-stack direction="inline" gap="small-200">
              <Button variant="primary" disabled={!points} loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "adjust"} onClick={() => fetcher.submit({ intent: "adjust", points: String(points), note }, { method: "post" })}>
                {points < 0 ? "Take away points" : "Add points"}
              </Button>
              <Button variant="tertiary" tone={m.blocked ? undefined : "critical"} onClick={() => fetcher.submit({ intent: "block", blocked: String(!m.blocked) }, { method: "post" })}>
                {m.blocked ? "Unblock" : "Block from earning and rewards"}
              </Button>
            </s-stack>
          </s-stack>
        </HomeRow>

        <HomeRow title="History">
          {d.events.length ? (
            <div className={css.list}>
              {d.events.map((e) => (
                <div key={e.id} className={css.item}>
                  <span>{`${eventLabel(e.kind, e.note)} · ${new Date(e.createdAt).toLocaleDateString()}${e.status === "pending" ? ` · usable from ${new Date(e.availableAt).toLocaleDateString()}` : ""}`}</span>
                  <Pill tone={e.points >= 0 ? "ok" : undefined}>{`${e.points > 0 ? "+" : ""}${e.points.toLocaleString()}`}</Pill>
                </div>
              ))}
            </div>
          ) : (
            <s-text color="subdued">No points changes yet.</s-text>
          )}
        </HomeRow>
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
