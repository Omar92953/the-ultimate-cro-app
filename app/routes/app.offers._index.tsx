/**
 * Offers hub: every offer of every type in one table (lib/offer-types.ts, lib/offers.server.ts),
 * with filters, plus the product-page extras (add-ons, personalization). "Create offer" opens the
 * type picker (/app/offers/new).
 */
import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { listOffers } from "../lib/offers.server";
import { OFFER_TYPES, OFFER_TYPE_KEYS, type OfferTypeKey } from "../lib/offer-types";
import { area, feature, featureHref, type FeatureKey } from "../lib/catalog";
import { FEATURE_PLAN, PLANS, canUse } from "../lib/plans";
import { Button, Select, TextField } from "../components/fields";
import { Pill } from "../components/ui";
import { usePlan } from "../components/Upgrade";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return { offers: await listOffers(admin) };
};

const EXTRAS: FeatureKey[] = ["addons", "personalize"];

export default function OffersHub() {
  const { offers } = useLoaderData<typeof loader>();
  const { plan } = usePlan();
  const [type, setType] = useState<"all" | OfferTypeKey>("all");
  const [status, setStatus] = useState<"all" | "on" | "off">("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = offers.filter(
    (o) => (type === "all" || o.type === type) && (status === "all" || (status === "on") === o.active) && (!q || o.name.toLowerCase().includes(q)),
  );
  const types = OFFER_TYPE_KEYS.filter((k) => offers.some((o) => o.type === k));

  return (
    <s-page heading="Offers" inlineSize="large">
      <Button slot="primary-action" variant="primary" href="/app/offers/new">
        Create offer
      </Button>
      <s-stack gap="base">
        <s-text color="subdued">{area("offers").intro}</s-text>

        <s-section padding="none">
          {offers.length ? (
            <s-stack gap="none">
              <s-box padding="small-300">
                <s-grid gridTemplateColumns="minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)" gap="small-200" alignItems="end">
                  <TextField label="Search" placeholder="Search offers" value={query} onValue={setQuery} />
                  <Select
                    label="Type"
                    value={type}
                    onValue={(v) => setType(v as typeof type)}
                    options={[{ value: "all", label: "All types" }, ...types.map((k) => ({ value: k, label: OFFER_TYPES[k].title }))]}
                  />
                  <Select
                    label="Status"
                    value={status}
                    onValue={(v) => setStatus(v as typeof status)}
                    options={[
                      { value: "all", label: "All" },
                      { value: "on", label: "On" },
                      { value: "off", label: "Off" },
                    ]}
                  />
                </s-grid>
              </s-box>
              <s-table>
                <s-table-header-row>
                  <s-table-header listSlot="primary">Name</s-table-header>
                  <s-table-header listSlot="secondary">Type</s-table-header>
                  <s-table-header listSlot="inline">Status</s-table-header>
                  <s-table-header>Where it shows</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {shown.map((o) => (
                    <s-table-row key={`${o.type}-${o.id}`}>
                      <s-table-cell>
                        <s-link href={o.href}>{o.name}</s-link>
                      </s-table-cell>
                      <s-table-cell>{OFFER_TYPES[o.type].title}</s-table-cell>
                      <s-table-cell>
                        <s-badge tone={o.active ? "success" : "neutral"}>{o.active ? "On" : "Off"}</s-badge>
                      </s-table-cell>
                      <s-table-cell>{o.where}</s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
              {!shown.length ? (
                <s-box padding="base">
                  <s-text color="subdued">No offers match these filters.</s-text>
                </s-box>
              ) : null}
            </s-stack>
          ) : (
            <s-box padding="large-200">
              <s-stack gap="base" alignItems="center">
                <s-heading>Create your first offer</s-heading>
                <s-paragraph>Upsells, cross-sells, bundles and deals raise the order value. Pick where it shows, then what it offers.</s-paragraph>
                <Button variant="primary" href="/app/offers/new">
                  Create offer
                </Button>
              </s-stack>
            </s-box>
          )}
        </s-section>

        <s-section heading="Extras on product pages">
          <s-stack gap="small-200">
            {EXTRAS.map((k) => (
              <s-stack key={k} direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
                <s-stack gap="none">
                  <Link to={featureHref(k)}>{feature(k).title}</Link>
                  <s-text color="subdued">{feature(k).about}</s-text>
                </s-stack>
                {canUse(plan, k) ? null : <Pill>{`${PLANS[FEATURE_PLAN[k]].name} plan`}</Pill>}
              </s-stack>
            ))}
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
