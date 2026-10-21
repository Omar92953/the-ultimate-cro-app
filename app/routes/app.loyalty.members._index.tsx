/** Loyalty → Members: search by email or referral code, with points, pending points, lifetime points and orders. */
import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { listMembers } from "../lib/loyalty/program.server";
import { Button, TextField } from "../components/fields";
import { HomeRow, HomeRows, PageIntro, Pill } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";
import css from "../components/OfferList.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const members = await listMembers(session.shop, q, 100);
  return { q, members: members.map((m) => ({ id: m.id, email: m.email, points: m.points, pending: m.pending, lifetime: m.lifetime, orders: m.orders, blocked: m.blocked, joinedAt: m.joinedAt.toISOString() })) };
};

export default function LoyaltyMembers() {
  const d = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text="Everyone in the program, newest activity first. Open a member to see their history or change their points." />
        <HomeRow title="Members" bare>
          <section className={css.list}>
            <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="end">
              <TextField label="Search" placeholder="Email or referral code" value={q} onValue={setQ} />
              <Button onClick={() => navigate(q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "?")}>Search</Button>
            </s-grid>
            {d.members.length ? (
              <div className={css.table} role="table" aria-label="Members">
                <div className={`${css.row} ${css.header}`} role="row">
                  <span role="columnheader">Member</span>
                  <span role="columnheader">Ready</span>
                  <span role="columnheader" className={css.num}>Lifetime</span>
                  <span role="columnheader" className={css.num}>Orders</span>
                </div>
                {d.members.map((m) => (
                  <div key={m.id} className={css.row} role="row">
                    <span className={css.main} role="cell">
                      <a className={css.name} href={`/app/loyalty/members/${m.id}`} onClick={(e) => (e.preventDefault(), navigate(`/app/loyalty/members/${m.id}`))}>
                        {m.email || `Member ${m.id}`}
                      </a>
                      <span className={css.sub}>
                        <span>{`Joined ${new Date(m.joinedAt).toLocaleDateString()}`}</span>
                        {m.blocked ? <Pill>Blocked</Pill> : null}
                      </span>
                    </span>
                    <span role="cell" className={css.stat} data-label="Ready">
                      {m.points.toLocaleString()}
                      {m.pending ? <span className={css.muted}>{` +${m.pending.toLocaleString()} pending`}</span> : null}
                    </span>
                    <span role="cell" className={`${css.num} ${css.stat}`} data-label="Lifetime">
                      {m.lifetime.toLocaleString()}
                    </span>
                    <span role="cell" className={`${css.num} ${css.stat}`} data-label="Orders">
                      {m.orders}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={css.empty}>
                <strong>{d.q ? "No member matches" : "No members yet"}</strong>
                <span>{d.q ? "Try another email or code." : "Customers join with their first paid order or their account once the program is on."}</span>
              </div>
            )}
          </section>
        </HomeRow>
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
