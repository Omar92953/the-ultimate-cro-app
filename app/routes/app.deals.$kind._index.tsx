import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { cachedResults } from "../lib/value.server";
import { OfferList, offerStats } from "../components/OfferList";
import { errorMessage } from "../lib/admin.server";
import { deleteDeal, listDeals, setDealActive } from "../lib/deals.server";
import { requireOfferSlot } from "../lib/rules.server";
import { isRuleError } from "../lib/rules";
import { LimitUpgrade } from "../components/Upgrade";
import { getDiscountStatus } from "../lib/cro.server";
import { DEAL_TYPES, describeDeal, isDealKind, type DealKind } from "../lib/deals";
import { DeletedToast } from "../components/DeleteOffer";
import { Button } from "../components/fields";
import { PageIntro } from "../components/ui";
import { dealFeature } from "../lib/catalog";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, redirect, session } = await authenticate.admin(request);
  const kind = params.kind;
  if (!isDealKind(kind)) throw new Response("Not found", { status: 404 });
  // Frequently bought together bundles are listed with every other bundle.
  if (kind === "fixed") throw redirect("/app/bundles?tab=fbt");
  const [deals, discount, results] = await Promise.all([listDeals(admin), getDiscountStatus(admin).catch(() => null), cachedResults(admin, session.shop)]);
  return { kind, deals: deals.filter((d) => d.kind === kind), native: discount?.engine === "native", results: results ? { currency: results.currency, byOffer: results.byOffer } : null };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    // Only the id comes from the page: the deal itself is loaded fresh, so a stale tab can't
    // overwrite newer edits.
    const deal = (await listDeals(admin)).find((d) => d.id === String(form.get("id")));
    if (!deal) throw new Error("This bundle no longer exists. Reload the page.");
    if (form.get("intent") === "delete") await deleteDeal(admin, deal.id!);
    else {
      const active = form.get("active") === "true";
      await requireOfferSlot(admin, session.shop, { ...deal, active });
      await setDealActive(admin, deal, active);
    }
    return { ok: true, error: null, intent: String(form.get("intent")), upgrade: false };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent: String(form.get("intent")), upgrade: isRuleError(e) && e.upgrade };
  }
};

const INTRO: Record<DealKind, string> = {
  fixed: "Chosen products sold together at a discount, added to the cart with one button.",
  bogo: "Buy some, get others free or discounted, applied at checkout.",
  volume: "A bigger discount the more a shopper buys from a group of products.",
  gift: "A free gift once the cart reaches an amount or has a chosen product.",
  upgrade: "Offer a better option in place of the one chosen, for the price difference.",
};

export default function DealList() {
  const { kind, deals, native, results } = useLoaderData<typeof loader>();
  const t = DEAL_TYPES[kind];
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show(fetcher.data.intent === "delete" ? "Deleted" : "Saved");
    else shopify.toast.show(fetcher.data.error || "Something went wrong", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const featureKey = dealFeature(kind);
  return (
    <s-page heading={t.title} inlineSize="large">
      <CategoryCrumb feature={featureKey} />
      <DemoButton feature={featureKey} />
      <Button slot="primary-action" variant="primary" href={`/app/deals/${kind}/new`}>
        {t.addLabel}
      </Button>
      <DeletedToast />
      <s-stack gap="base">
        <FeatureTabs feature={featureKey} />
        {fetcher.data?.upgrade ? (
          <s-banner tone="warning" heading="Not switched on">
            <s-stack gap="small-200">
              {fetcher.data.error}
              <LimitUpgrade show />
            </s-stack>
          </s-banner>
        ) : null}
        <PageIntro text={INTRO[kind]} />
        {native ? (
          <s-banner tone="warning" heading="Not available with native discounts">
            This store uses Shopify&apos;s native discounts (Settings → Discounts), which can&apos;t apply this bundle type. Switch to the app&apos;s discount engine to use it.
          </s-banner>
        ) : null}
        <OfferList
          title={`Your ${t.title.toLowerCase()}`}
          currency={results?.currency ?? "USD"}
          measured={!!results}
          create={{ href: `/app/deals/${kind}/new`, label: t.addLabel }}
          empty={{ title: `No ${t.singular}s yet`, text: t.example }}
          rows={deals.map((d) => ({
            key: d.id ?? d.name,
            name: d.name,
            href: `/app/deals/${kind}/${d.handle}`,
            active: d.active,
            detail: describeDeal(d),
            stats: offerStats(results?.byOffer, [...(d.handle ? [`o:${d.handle}`] : []), `t:${d.name}`]),
            actions: (
              <>
                <Button variant="tertiary" onClick={() => fetcher.submit({ intent: "active", active: String(!d.active), id: d.id ?? "" }, { method: "post" })}>
                  {d.active ? "Pause" : "Activate"}
                </Button>
                {confirming === d.id ? (
                  <>
                    <Button tone="critical" variant="primary" onClick={() => { setConfirming(null); fetcher.submit({ intent: "delete", id: d.id ?? "" }, { method: "post" }); }}>
                      Delete
                    </Button>
                    <Button variant="tertiary" onClick={() => setConfirming(null)}>
                      Keep
                    </Button>
                  </>
                ) : (
                  <Button tone="critical" variant="tertiary" icon="delete" onClick={() => setConfirming(d.id)}>
                    Delete
                  </Button>
                )}
              </>
            ),
          }))}
        />
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
