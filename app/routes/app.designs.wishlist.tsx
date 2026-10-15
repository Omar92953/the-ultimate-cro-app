import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { getWishlist, saveWishlist } from "../lib/designs.server";
import { applyWishlistPreset, WISHLIST_PRESETS, WISHLIST_SIZES, withWishlistDefaults, type WishlistDesign } from "../lib/wishlist-design";
import { Button, Checkbox, ColorField, NumberField, Select, TextField } from "../components/fields";
import { WishlistPreview } from "../components/WishlistPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker, templateInUse } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { SizesSection } from "../components/SizesSection";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme] = await Promise.all([getWishlist(admin), getThemeStatus(admin, session.shop).catch(() => null)]);
  const links = sectionLinks(session.shop);
  return { config, saved, css: storefrontCss("ucs-sections.css"), embedOn: theme ? theme.installed.boosters : null, embedLink: links.boosters, pageLink: links.track, pagesAdmin: `https://${session.shop}/admin/pages/new` };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveWishlist(admin, withWishlistDefaults(JSON.parse(String(form.get("config")))));
    return { ok: true, error: null, config };
  } catch (e) {
    return { ok: false, error: errorMessage(e), config: null };
  }
};

type C = WishlistDesign;

export default function WishlistDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("looks");
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [loaded, setLoaded] = useState(data.config);
  if (loaded !== data.config) {
    setLoaded(data.config);
    setCfg(data.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show(data.embedOn ? "Wishlist saved and live on your store" : "Wishlist saved");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify, data.embedOn]);

  const part =
    <K extends "where" | "page" | "text" | "look">(k: K) =>
    (patch: Partial<C[K]>) =>
      setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const where = part("where"), page = part("page"), text = part("text"), look = part("look");

  return (
    <s-page heading="Wishlist" inlineSize="large">
      <CategoryCrumb feature="wishlist" />
      <DemoButton feature="wishlist" template={templateInUse(WISHLIST_PRESETS, cfg, applyWishlistPreset)} />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle"} saved={data.saved} onSave={() => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" })} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={data.embedLink} target="_top" icon="theme-edit">
        {data.embedOn ? "Open in theme editor" : "Turn on in theme"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="wishlist" />
          <s-text color="subdued">
            Shoppers save products with a heart and find them on your wishlist page. The list is kept in their browser; “Share my wishlist” gives a link that opens it on any device. For the page: create a page (e.g. “Wishlist”, address {cfg.page.url}) and add the “Order &amp; wishlist pages” block to it with Page: Wishlist.
          </s-text>
          {data.embedOn === false ? (
            <s-banner tone="warning" heading="Turn on the Conversion boosters embed. The wishlist runs from it">
              <s-link href={data.embedLink} target="_top">
                Open App embeds
              </s-link>
            </s-banner>
          ) : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <LookPicker width={560} presets={WISHLIST_PRESETS} config={cfg} apply={applyWishlistPreset} onPick={(key) => setCfg((c) => applyWishlistPreset(c, key))} render={(c) => <WishlistPreview config={c} />} />
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Where the heart shows">
                  <s-stack gap="small-200">
                    <Checkbox label="Product pages (next to Add to cart)" checked={cfg.where.product} onValue={(v) => where({ product: v })} />
                    <Checkbox label="Product cards (collections, search, home)" checked={cfg.where.cards} onValue={(v) => where({ cards: v })} />
                    <Checkbox label="Floating button with the count" checked={cfg.where.floating} onValue={(v) => where({ floating: v })} />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="Button text" value={cfg.text.add} onValue={(v) => text({ add: v })} />
                      <TextField label="When saved" value={cfg.text.saved} onValue={(v) => text({ saved: v })} />
                    </s-grid>
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Wishlist page">
                  <s-stack gap="base">
                    <TextField label="Page address" details="The page with the “Order & wishlist pages” block set to Wishlist." value={cfg.page.url} onValue={(v) => page({ url: v })} />
                    <s-link href={data.pagesAdmin} target="_top">
                      Create a page in Shopify
                    </s-link>
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="Heading" value={cfg.page.heading} onValue={(v) => page({ heading: v })} />
                      <TextField label="Add to cart" value={cfg.page.add} onValue={(v) => page({ add: v })} />
                      <TextField label="Remove" value={cfg.page.remove} onValue={(v) => page({ remove: v })} />
                      <TextField label="Price dropped" details="{amount} = how much less" value={cfg.page.priceDrop} onValue={(v) => page({ priceDrop: v })} />
                      <TextField label="Share button" value={cfg.page.share} onValue={(v) => page({ share: v })} />
                      <TextField label="After copying" value={cfg.page.copied} onValue={(v) => page({ copied: v })} />
                    </s-grid>
                    <TextField label="Empty wishlist" value={cfg.page.empty} onValue={(v) => page({ empty: v })} />
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Icon" value={cfg.look.icon} onValue={(v) => look({ icon: v as C["look"]["icon"] })} options={[{ value: "heart", label: "Heart" }, { value: "star", label: "Star" }, { value: "bookmark", label: "Bookmark" }]} />
                    <ColorField label="Icon colour" value={cfg.look.color} onValue={(v) => look({ color: v })} />
                    <ColorField label="Button background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                    <NumberField label="Corners" suffix="px" min={0} max={999} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                    <Select label="Floating button" value={cfg.where.floatPos} onValue={(v) => where({ floatPos: v as C["where"]["floatPos"] })} options={[{ value: "bl", label: "Bottom left" }, { value: "br", label: "Bottom right" }]} />
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <SizesSection specs={WISHLIST_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </Pane>
            </s-stack>
            <PreviewFrame width={560} title="Your store · try the hearts">
              <WishlistPreview config={cfg} />
            </PreviewFrame>
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
