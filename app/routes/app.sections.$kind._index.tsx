import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { deleteItem, listItems, reorder, sectionLinks, setShown } from "../lib/sections.server";
import { SECTIONS, SOURCES, isKind, itemStatus, type MediaRef, type ProductRef, type SectionItem, type SectionKind } from "../lib/sections";
import { Button } from "../components/fields";
import { Explainer, Pill } from "../components/ui";
import { SectionTabs } from "../components/SectionTabs";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const kind = params.kind;
  if (!isKind(kind)) throw new Response("Not found", { status: 404 });
  let items: SectionItem[] = [];
  let error: string | null = null;
  try {
    items = await listItems(admin, kind);
  } catch (e) {
    error = errorMessage(e);
  }
  return { kind, items, error, themeLink: sectionLinks(session.shop)[kind] };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const kind = params.kind;
  if (!isKind(kind)) return { ok: false, error: "Unknown list." };
  const form = await request.formData();
  const intent = String(form.get("intent"));
  try {
    if (intent === "reorder") await reorder(admin, kind, JSON.parse(String(form.get("ids"))) as string[]);
    else if (intent === "shown") await setShown(admin, kind, String(form.get("id")), form.get("shown") === "true");
    else if (intent === "delete") await deleteItem(admin, kind, String(form.get("id")));
    else return { ok: false, error: "Unknown action." };
    return { ok: true, error: null, intent };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent };
  }
};

const stars = (n: number) => (n > 0 ? "★".repeat(n) + "☆".repeat(5 - n) : "");

function subtitle(kind: SectionKind, item: SectionItem): string {
  const v = item.values;
  const parts: string[] = [];
  if (kind === "reviews") {
    parts.push(stars(Number(v.rating) || 0));
    const src = SOURCES.find((s) => s.value === v.source && s.value);
    if (src) parts.push(src.label);
    if (v.product) parts.push((v.product as ProductRef).title);
    if (v.featured) parts.push("Featured");
    if (v.text) parts.push(`“${String(v.text).slice(0, 70)}${String(v.text).length > 70 ? "…" : ""}”`);
  } else if (kind === "faq") {
    if (v.group) parts.push(String(v.group));
    if (v.answer) parts.push(String(v.answer).slice(0, 90) + (String(v.answer).length > 90 ? "…" : ""));
  } else if (kind === "logos") {
    if (v.link) parts.push(String(v.link));
  } else {
    if (v.link) parts.push(`→ ${v.link}`);
    const day = (s: unknown) => new Date(String(s)).toLocaleDateString();
    if (v.starts_at || v.ends_at) parts.push(`${v.starts_at ? day(v.starts_at) : "now"} – ${v.ends_at ? day(v.ends_at) : "no end"}`);
  }
  return parts.filter(Boolean).join(" · ");
}

export default function SectionList() {
  const data = useLoaderData<typeof loader>();
  const cfg = SECTIONS[data.kind];
  const shopify = useAppBridge();
  const fetcher = useFetcher<typeof action>();
  const [items, setItems] = useState(data.items);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Fresh data from the server (after a change or navigation) replaces the local copy.
  const [loaded, setLoaded] = useState(data.items);
  if (loaded !== data.items) {
    setLoaded(data.items);
    setItems(data.items);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show(fetcher.data.intent === "delete" ? "Deleted" : "Saved");
    else shopify.toast.show(fetcher.data.error || "Something went wrong", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    fetcher.submit({ intent: "reorder", ids: JSON.stringify(next.map((x) => x.id)) }, { method: "post" });
  };
  const toggle = (item: SectionItem) => {
    const key = cfg.activeKey!;
    const shown = item.values[key] === false;
    setItems((all) => all.map((x) => (x.id === item.id ? { ...x, values: { ...x.values, [key]: shown } } : x)));
    fetcher.submit({ intent: "shown", id: item.id!, shown: String(shown) }, { method: "post" });
  };
  const remove = (item: SectionItem) => {
    setConfirming(null);
    setItems((all) => all.filter((x) => x.id !== item.id));
    fetcher.submit({ intent: "delete", id: item.id! }, { method: "post" });
  };

  const shownCount = items.filter((i) => itemStatus(data.kind, i).tone === "ok").length;

  return (
    <s-page heading={cfg.title} inlineSize="large">
      <Button slot="primary-action" variant="primary" href={`/app/sections/${data.kind}/new`}>
        {cfg.addLabel}
      </Button>
      <Button slot="secondary-actions" href={data.themeLink} target="_top" icon="theme-edit">
        {cfg.embed ? "Turn on in theme" : "Add to theme"}
      </Button>
      <s-stack gap="base">
        <SectionTabs />
        <Explainer {...cfg.help} />
        {data.error ? (
          <s-banner tone="critical" heading={`Your ${cfg.plural} could not be loaded`}>
            {data.error}
          </s-banner>
        ) : null}

        <s-section heading={items.length ? `${items.length} ${items.length === 1 ? cfg.singular : cfg.plural} · ${shownCount} shown` : `No ${cfg.plural} yet`}>
          {items.length ? (
            <s-stack gap="small-200">
              {items.map((item, i) => {
                const status = itemStatus(data.kind, item);
                const thumb = cfg.thumbKey ? (item.values[cfg.thumbKey] as MediaRef | null) : null;
                const title = String(item.values[cfg.titleKey] || "Untitled");
                return (
                  <s-box key={item.id ?? item.handle ?? i} padding="small-300" borderWidth="base" borderRadius="base">
                    <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                      <s-stack direction="inline" gap="base" alignItems="center">
                        {cfg.thumbKey ? <s-thumbnail src={thumb?.url ?? undefined} alt={thumb ? thumb.title : "No image"} size="small" /> : null}
                        <s-stack gap="small-100">
                          <s-stack direction="inline" gap="small-200" alignItems="center">
                            <s-link href={`/app/sections/${data.kind}/${item.handle}`}>{title}</s-link>
                            <Pill tone={status.tone}>{status.text}</Pill>
                            {thumb?.kind === "video" ? <Pill>Video</Pill> : null}
                          </s-stack>
                          {subtitle(data.kind, item) ? <s-text color="subdued">{subtitle(data.kind, item)}</s-text> : null}
                        </s-stack>
                      </s-stack>
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <Button icon="arrow-up" variant="tertiary" accessibilityLabel={`Move ${title} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                          Up
                        </Button>
                        <Button icon="arrow-down" variant="tertiary" accessibilityLabel={`Move ${title} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                          Down
                        </Button>
                        {cfg.activeKey ? (
                          <Button variant="tertiary" icon={item.values[cfg.activeKey] === false ? "view" : "hide"} onClick={() => toggle(item)}>
                            {item.values[cfg.activeKey] === false ? "Show" : "Hide"}
                          </Button>
                        ) : null}
                        <Button href={`/app/sections/${data.kind}/${item.handle}`} icon="edit">
                          Edit
                        </Button>
                        {confirming === item.id ? (
                          <>
                            <Button tone="critical" variant="primary" onClick={() => remove(item)}>
                              Delete
                            </Button>
                            <Button variant="tertiary" onClick={() => setConfirming(null)}>
                              Keep
                            </Button>
                          </>
                        ) : (
                          <Button tone="critical" variant="tertiary" icon="delete" accessibilityLabel={`Delete ${title}`} onClick={() => setConfirming(item.id)}>
                            Delete
                          </Button>
                        )}
                      </s-stack>
                    </s-stack>
                  </s-box>
                );
              })}
            </s-stack>
          ) : (
            <s-stack gap="base" alignItems="start">
              <s-paragraph>{cfg.empty}</s-paragraph>
              <Button variant="primary" href={`/app/sections/${data.kind}/new`} icon="plus">
                {cfg.addLabel}
              </Button>
            </s-stack>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
