/**
 * A Track page offer (Pro): an offer above or below the tracking on the Track page, made in Offers (lib/track-offers.ts).
 * The order is already paid, so the offer starts a new cart and/or gives a real Shopify code with a real expiry.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { planContext } from "../lib/rules.server";
import { isRuleError, requireTrackOffers } from "../lib/rules";
import { atLeast, EXTRA_PLAN, PLANS } from "../lib/plans";
import { DEFAULT_TRACK_OFFER, TRACK_OFFER_KINDS, withTrackOfferDefaults, type TrackOffer, type TrackOfferKind } from "../lib/track-offers";
import { deleteTrackOffer, getTrackOffers, saveTrackOffer } from "../lib/track-offers.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { NumberField, Select, Switch, TextField } from "../components/fields";
import { ResourceList } from "../components/ResourceList";
import { LimitUpgrade } from "../components/Upgrade";
import { DeleteOffer } from "../components/DeleteOffer";
import { EditorLayout } from "../components/EditorLayout";
import { SaveControls, changed } from "../components/SaveControls";
import { PreviewFrame } from "../components/DesignTabs";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { plan } = await planContext(admin, session.shop);
  const isNew = params.handle === "new";
  const offer = isNew ? { id: "", ...DEFAULT_TRACK_OFFER } : (await getTrackOffers(admin)).offers.find((o) => o.id === params.handle);
  if (!offer) throw new Response("Offer not found", { status: 404 });
  return { offer, isNew, pro: atLeast(plan, EXTRA_PLAN.trackOffers), proName: PLANS[EXTRA_PLAN.trackOffers].name, css: storefrontCss("ucs-sections.css") };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, redirect, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const { plan } = await planContext(admin, session.shop);
    requireTrackOffers(plan);
    if (form.get("intent") === "delete") {
      await deleteTrackOffer(admin, String(form.get("id")));
      return redirect("/app/offers");
    }
    const saved = await saveTrackOffer(admin, JSON.parse(String(form.get("offer"))));
    return { ok: true, error: null, id: saved.id, upgrade: false };
  } catch (e) {
    return { ok: false, error: errorMessage(e), id: null, upgrade: isRuleError(e) && e.upgrade };
  }
};

const KIND_OPTIONS = (Object.keys(TRACK_OFFER_KINDS) as TrackOfferKind[]).map((k) => ({ value: k, label: TRACK_OFFER_KINDS[k].title }));
const KIND_DEFAULTS: Record<TrackOfferKind, Partial<TrackOffer>> = {
  cross_sell: { headline: "Pairs well with your order", button: "Add to cart", percent: 0, hours: 48 },
  shipping: { headline: "Free shipping on your next order", text: "Add anything in the next 48 hours.", button: "Shop now", percent: 0, hours: 48, products: [] },
  gift: { headline: "A free gift for your next order", text: "Add it to your cart, it is free.", button: "Add my gift", percent: 0, hours: 48 },
  discount: { headline: "Take 15% off anything else", text: "A thank you, valid for 48 hours.", button: "Shop now", percent: 15, hours: 48 },
};

export default function TrackOfferEditor() {
  const { offer: initial, isNew, pro, proName, css } = useLoaderData<typeof loader>();
  const [o, setO] = useState<TrackOffer>(initial as TrackOffer);
  const [touched, setTouched] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";
  const [loaded, setLoaded] = useState(initial);
  if (loaded !== initial) {
    setLoaded(initial);
    if (JSON.stringify(loaded) !== JSON.stringify(initial)) setO(initial as TrackOffer);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      shopify.toast.show("Saved");
      if (isNew && fetcher.data.id) navigate(`/app/offers/track/${fetcher.data.id}`, { replace: true });
    } else if (fetcher.data.error) shopify.toast.show("Could not save. See the message at the top", { isError: true });
  }, [fetcher.state, fetcher.data, shopify, isNew, navigate]);

  const set = (patch: Partial<TrackOffer>) => setO((x) => ({ ...x, ...patch }));
  const clean = withTrackOfferDefaults({ ...o, name: o.name.trim() || o.headline });
  const problems: string[] = [];
  if (clean.kind === "cross_sell" && !clean.products.length) problems.push("Choose at least one product to offer.");
  if (clean.kind === "gift" && !clean.products.length) problems.push("Choose the product that is the gift.");
  const save = () => {
    setTouched(true);
    if (problems.length) return;
    fetcher.submit({ intent: "save", offer: JSON.stringify({ ...clean, id: o.id }) }, { method: "post" });
  };
  const gives = o.kind === "shipping" ? "free shipping" : o.kind === "gift" ? "a free gift" : `${o.percent}% off`;
  const about = TRACK_OFFER_KINDS[o.kind];

  return (
    <s-page heading={isNew ? "New Track page offer" : o.name || o.headline} inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/offers">
        Offers
      </s-link>
      <SaveControls dirty={changed(o, initial)} saving={busy} saved={!isNew} allowLeave={busy || (isNew && !!fetcher.data?.id)} onSave={save} onDiscard={() => { setO(initial as TrackOffer); setTouched(false); }} />
      {!pro ? (
        <s-banner tone="warning" heading={`Track page offers are on the ${proName} plan`}>
          <s-stack gap="small-200">
            You can look around, but saving needs the {proName} plan.
            <LimitUpgrade show />
          </s-stack>
        </s-banner>
      ) : null}
      {fetcher.data?.error ? (
        <s-banner tone="critical" heading="The offer was not saved">
          <s-stack gap="small-200">
            {fetcher.data.error}
            <LimitUpgrade show={fetcher.data.upgrade} />
          </s-stack>
        </s-banner>
      ) : null}
      {touched && problems.length ? (
        <s-banner tone="warning" heading="Please fix these first">
          <s-unordered-list>
            {problems.map((p) => (
              <s-list-item key={p}>{p}</s-list-item>
            ))}
          </s-unordered-list>
        </s-banner>
      ) : null}
      <EditorLayout
        preview
        side={
          <>
            <PreviewFrame title="Track page · this offer">
              <style dangerouslySetInnerHTML={{ __html: css }} />
              <div className="ucs-op__offer">
                <p className="ucs-op__t"><b>{o.headline}</b></p>
                {o.text ? <p className="ucs-op__t">{o.text}</p> : null}
                {o.kind === "cross_sell" || o.kind === "gift" ? (
                  <ul className="ucs-op__rg">
                    {(o.products.length ? o.products : [{ id: "x", title: "Pick a product" }]).map((p) => (
                      <li key={p.id} className="ucs-op__rc">
                        {"image" in p && p.image ? <img src={p.image} alt="" /> : <span className="ucs-op__ph" />}
                        <span className="ucs-op__rn">{p.title}</span>
                        {o.kind === "cross_sell" ? <span className="ucs-btn ucs-btn--outline">{o.button}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {o.kind !== "cross_sell" ? <p><span className="ucs-btn">{o.button}</span></p> : null}
                {o.kind !== "cross_sell" || o.percent > 0 ? <p className="ucs-op__t"><code className="ucs-op__code">TRACK-3FA9C2D1</code> <small>Valid for {o.hours} hours after the shopper opens the page.</small></p> : null}
              </div>
            </PreviewFrame>
            <s-text color="subdued">
              The order is already paid, so this never edits it: it starts a new cart and gives {gives} as a real Shopify code that works once and really expires.
            </s-text>
          </>
        }
      >
        <s-section heading="Status">
          <s-stack gap="base">
            <Switch label={o.active ? "Active: showing on the Track page" : "Paused: hidden"} checked={o.active} onValue={(v) => set({ active: v })} />
            <TextField label="Offer name" placeholder={o.headline} details="Only you see this." value={o.name} onValue={(v) => set({ name: v })} />
          </s-stack>
        </s-section>
        <s-section heading="1. What it offers">
          <s-stack gap="base">
            <Select label="Offer" value={o.kind} options={KIND_OPTIONS} details={about.about} onValue={(v) => { const k = v as TrackOfferKind; if (k !== o.kind) setO((x) => ({ ...x, kind: k, ...KIND_DEFAULTS[k], products: k === x.kind ? x.products : [] })); }} />
            {o.kind === "cross_sell" ? <ResourceList type="product" label="Products to offer" details="Up to 4. Only active products that are in stock are shown." value={o.products} onChange={(v) => set({ products: v.slice(0, 4) })} /> : null}
            {o.kind === "gift" ? <ResourceList type="product" multiple={false} label="The gift" details="The shopper adds it to a new cart and a one time code makes it free." value={o.products} onChange={(v) => set({ products: v.slice(0, 1) })} /> : null}
            <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
              {o.kind === "cross_sell" || o.kind === "discount" ? <NumberField label="Discount" details={o.kind === "cross_sell" ? "0 = none" : undefined} suffix="%" min={o.kind === "discount" ? 1 : 0} max={90} step={1} value={o.percent} onValue={(v) => set({ percent: v })} /> : <span />}
              {o.kind !== "cross_sell" || o.percent > 0 ? <NumberField label="Code lasts" details="Starts when the shopper opens their page." suffix="hours" min={1} max={720} step={1} value={o.hours} onValue={(v) => set({ hours: v })} /> : <span />}
              {o.kind === "discount" ? <NumberField label="Minimum order" details="0 = none" min={0} max={100000} step={1} value={o.minimum} onValue={(v) => set({ minimum: v })} /> : <span />}
            </s-grid>
          </s-stack>
        </s-section>
        <s-section heading="2. Where it shows">
          <Select label="On the Track page" value={o.slot} onValue={(v) => set({ slot: v === "above" ? "above" : "below" })} options={[{ value: "above", label: "Above the tracking" }, { value: "below", label: "Below the tracking" }]} details="One offer fits each place. Only shoppers whose order is paid see it." />
        </s-section>
        <s-section heading="3. Words">
          <s-stack gap="base">
            <TextField label="Headline" value={o.headline} maxLength={100} onValue={(v) => set({ headline: v })} />
            <TextField label="Text (optional)" value={o.text} maxLength={300} onValue={(v) => set({ text: v })} />
            <TextField label="Button" value={o.button} maxLength={40} onValue={(v) => set({ button: v })} />
          </s-stack>
        </s-section>
        {!isNew ? (
          <DeleteOffer busy={busy} onDelete={() => fetcher.submit({ intent: "delete", id: o.id }, { method: "post" })}>
            <s-paragraph>{`“${o.name || o.headline}” stops showing on the Track page. Codes already given stay valid until they expire. This cannot be undone.`}</s-paragraph>
          </DeleteOffer>
        ) : null}
      </EditorLayout>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
