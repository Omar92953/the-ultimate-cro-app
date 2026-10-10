import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { sectionLinks } from "../lib/sections.server";
import { deleteHero, duplicateHero, listHeroes, reorderHeroes, type HeroItem } from "../lib/hero.server";
import { Button } from "../components/fields";
import { Explainer, Pill } from "../components/ui";
import { CategoryCrumb } from "../components/FeatureNav";
import { SortableList, arrayMove } from "../components/Sortable";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  let items: HeroItem[] = [];
  let error: string | null = null;
  try {
    items = await listHeroes(admin);
  } catch (e) {
    error = errorMessage(e);
  }
  return { items, error, themeLink: sectionLinks(session.shop).hero };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const handle = String(form.get("handle"));
  try {
    if (intent === "delete") await deleteHero(admin, handle);
    else if (intent === "duplicate") return { ok: true, error: null, intent, handle: (await duplicateHero(admin, handle)).handle };
    else if (intent === "reorder") await reorderHeroes(admin, JSON.parse(String(form.get("handles"))) as string[]);
    else return { ok: false, error: "Unknown action.", intent, handle: null };
    return { ok: true, error: null, intent, handle: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent, handle: null };
  }
};

export default function HeroBanners() {
  const data = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof action>();
  const [confirming, setConfirming] = useState<string | null>(null);
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Something went wrong", { isError: true });
    else if (fetcher.data.intent === "duplicate" && fetcher.data.handle) navigate(`/app/designs/hero/${fetcher.data.handle}`);
    else shopify.toast.show(fetcher.data.intent === "delete" ? "Banner deleted" : "Order saved — the first banner shows when none is picked");
  }, [fetcher.state, fetcher.data, shopify, navigate]);

  const act = (intent: string, handle: string) => fetcher.submit({ intent, handle }, { method: "post" });
  // The new order shows at once; the server catches up in the background.
  const [items, setItems] = useState(data.items);
  const [loaded, setLoaded] = useState(data.items);
  if (loaded !== data.items) {
    setLoaded(data.items);
    setItems(data.items);
  }
  const move = (from: number, to: number) => {
    const next = arrayMove(items, from, to);
    setItems(next);
    fetcher.submit({ intent: "reorder", handle: "", handles: JSON.stringify(next.map((x) => x.handle)) }, { method: "post" });
  };

  return (
    <s-page heading="Hero banners" inlineSize="large">
      <CategoryCrumb feature="hero" />
      <Button slot="primary-action" variant="primary" href="/app/designs/hero/new">
        Add banner
      </Button>
      <Button slot="secondary-actions" href={data.themeLink} target="_top" icon="theme-edit">
        Add to theme
      </Button>
      <s-stack gap="base">
        <Explainer
          what="Big banners at the top of a page, with a separate image for phones so each device gets a picture that fits."
          how="Make banners here — images, text, buttons and look. Then add the “Hero image” section in the theme editor and pick a banner; with none picked it shows your first banner."
          example="A wide summer photo on desktop and a tall crop of it on phones, “Summer sale — up to 40% off”, with a Shop now button."
        />
        {data.error ? (
          <s-banner tone="critical" heading="Your banners could not be loaded">
            {data.error}
          </s-banner>
        ) : null}
        <s-section heading={items.length ? `${items.length} ${items.length === 1 ? "banner" : "banners"}` : "No banners yet"}>
          {items.length ? (
            <SortableList
              items={items}
              keyOf={(item) => item.handle}
              labelOf={(item) => item.config.name || "Untitled"}
              onMove={move}
              render={(item, i, handle) => {
                const c = item.config;
                const title = c.name || "Untitled";
                return (
                  <s-box padding="small-300" borderWidth="base" borderRadius="base">
                    <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                      <s-stack direction="inline" gap="small-300" alignItems="center">
                        {handle}
                        <s-thumbnail src={c.images.desktop?.url ?? undefined} alt={c.images.desktop ? c.images.desktop.title : "No image"} size="small" />
                        <s-stack gap="small-100">
                          <s-stack direction="inline" gap="small-200" alignItems="center">
                            <s-link href={`/app/designs/hero/${item.handle}`}>{title}</s-link>
                            {item.live ? <Pill tone="ok">Saved</Pill> : <Pill tone="warn">Not saved yet</Pill>}
                            {i === 0 ? <Pill>First · shown when no banner is picked</Pill> : null}
                            {!c.images.mobile ? <Pill tone="warn">No phone image</Pill> : null}
                          </s-stack>
                          <s-text color="subdued">{[c.text.heading, c.text.b1 && `Button: ${c.text.b1}`].filter(Boolean).join(" · ") || "No text"}</s-text>
                        </s-stack>
                      </s-stack>
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <Button href={`/app/designs/hero/${item.handle}`} icon="edit">
                          Edit
                        </Button>
                        <Button variant="tertiary" icon="duplicate" disabled={busy} onClick={() => act("duplicate", item.handle)}>
                          Duplicate
                        </Button>
                        {confirming === item.handle ? (
                          <>
                            <Button tone="critical" variant="primary" onClick={() => (setConfirming(null), act("delete", item.handle))}>
                              Delete
                            </Button>
                            <Button variant="tertiary" onClick={() => setConfirming(null)}>
                              Keep
                            </Button>
                          </>
                        ) : (
                          <Button tone="critical" variant="tertiary" icon="delete" accessibilityLabel={`Delete ${title}`} onClick={() => setConfirming(item.handle)}>
                            Delete
                          </Button>
                        )}
                      </s-stack>
                    </s-stack>
                  </s-box>
                );
              }}
            />
          ) : (
            <s-stack gap="base" alignItems="start">
              <s-paragraph>No banners yet. Start with your main one — a wide image for desktop and a tall one for phones.</s-paragraph>
              <Button variant="primary" href="/app/designs/hero/new" icon="plus">
                Add banner
              </Button>
            </s-stack>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
