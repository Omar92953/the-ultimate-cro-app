/**
 * Offers hub: every offer of every type in one table (lib/offer-types.ts, lib/offers.server.ts),
 * with filters, plus the product-page extras (add-ons, personalization). "Create offer" opens the
 * type picker (/app/offers/new).
 */
import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { listOffers } from "../lib/offers.server";
import { OFFER_TYPES, OFFER_TYPE_KEYS, type OfferTypeKey } from "../lib/offer-types";
import { area, feature, featureHref, type FeatureKey } from "../lib/catalog";
import { FEATURE_PLAN, PLANS, canUse, limitOf, planAbove } from "../lib/plans";
import { Button, Select, TextField } from "../components/fields";
import { LinkTiles, Pill } from "../components/ui";
import { UpgradeButton, usePlan } from "../components/Upgrade";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return { offers: await listOffers(admin) };
};

/** "2 of 3 offer slots used": every switched-on offer, any type, fills one slot (plans.ts offerSlots). */
function SlotMeter({ used }: { used: number }) {
  const { plan } = usePlan();
  const slots = limitOf(plan, "offerSlots");
  if (slots === null) return null;
  const next = planAbove("offerSlots", slots, plan);
  return (
    <s-section>
      <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
        <s-stack gap="small-100">
          <s-text type="strong">{`${Math.min(used, slots)} of ${slots} offer slots used`}</s-text>
          <s-text color="subdued">
            {`Any offer that's on fills a slot: upsells, cross-sells, bundles, deals and the after-purchase offer. Switch one off to free its slot.${next ? ` ${PLANS[next].name} has unlimited offers.` : ""}`}
          </s-text>
        </s-stack>
        {next ? <UpgradeButton to={next} variant={used >= slots ? "primary" : "secondary"} /> : null}
      </s-stack>
    </s-section>
  );
}

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
        <SlotMeter used={offers.filter((o) => o.active).length} />

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
          <LinkTiles
            items={EXTRAS.map((k) => ({
              key: k,
              title: feature(k).title,
              sub: feature(k).about,
              href: featureHref(k),
              end: canUse(plan, k) ? null : <Pill>{`${PLANS[FEATURE_PLAN[k]].name} plan`}</Pill>,
            }))}
          />
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
