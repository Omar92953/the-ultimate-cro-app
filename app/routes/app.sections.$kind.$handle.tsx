/* eslint-disable @typescript-eslint/no-explicit-any -- App Bridge resource picker payloads are untyped */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { deleteItem, listItems, saveItem, shopOffset, toForm } from "../lib/sections.server";
import { SECTIONS, SOURCES, blankItem, isKind, type FieldDef, type MediaRef, type ProductRef, type SectionItem, type SectionKind, type Value } from "../lib/sections";
import { Button, Checkbox, DateField, Select, TextArea, TextField } from "../components/fields";
import { MediaPicker } from "../components/MediaPicker";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const kind = params.kind;
  if (!isKind(kind)) throw new Response("Not found", { status: 404 });
  const offset = await shopOffset(admin);
  if (params.handle === "new") return { kind, item: blankItem(kind), isNew: true };
  const item = (await listItems(admin, kind)).find((i) => i.handle === params.handle);
  if (!item) throw new Response("Not found", { status: 404 });
  return { kind, item: toForm(kind, item, offset.minutes), isNew: false };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, redirect } = await authenticate.admin(request);
  const kind = params.kind;
  if (!isKind(kind)) return { ok: false, error: "Unknown list.", next: null };
  const form = await request.formData();
  try {
    if (form.get("intent") === "delete") {
      await deleteItem(admin, kind, String(form.get("id")));
      return redirect(`/app/sections/${kind}`);
    }
    await saveItem(admin, kind, JSON.parse(String(form.get("item"))) as SectionItem);
    return { ok: true, error: null, next: String(form.get("next") || "list") };
  } catch (e) {
    return { ok: false, error: errorMessage(e), next: null };
  }
};

export default function SectionItemEditor() {
  const { kind, item: initial, isNew } = useLoaderData<typeof loader>();
  const cfg = SECTIONS[kind];
  const [item, setItem] = useState<SectionItem>(initial);
  const [touched, setTouched] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";

  const [loaded, setLoaded] = useState(initial);
  if (loaded !== initial) {
    setLoaded(initial);
    setItem(initial);
    setTouched(false);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      shopify.toast.show(`${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} saved`);
      // A fresh "new" URL reloads a blank form for the next one.
      navigate(fetcher.data.next === "another" ? `/app/sections/${kind}/new?n=${Date.now()}` : `/app/sections/${kind}`);
    } else if (fetcher.data.error) {
      shopify.toast.show("Not saved — see the message at the top", { isError: true });
    }
  }, [fetcher.state, fetcher.data, shopify, navigate, kind, cfg.singular]);

  const set = (key: string, value: Value) => setItem((it) => ({ ...it, values: { ...it.values, [key]: value } }));
  const missing = cfg.fields.filter((f) => f.required && !item.values[f.key]).map((f) => f.label);
  const save = (next: "list" | "another") => {
    setTouched(true);
    if (missing.length) return;
    fetcher.submit({ item: JSON.stringify(item), next }, { method: "post" });
  };
  const remove = () => {
    if (!item.id || !window.confirm(`Delete this ${cfg.singular}? This can't be undone.`)) return;
    fetcher.submit({ intent: "delete", id: item.id }, { method: "post" });
  };
  const title = isNew ? `New ${cfg.singular}` : String(item.values[cfg.titleKey] || cfg.singular);

  return (
    <s-page heading={title} inlineSize="base">
      <s-link slot="breadcrumb-actions" href={`/app/sections/${kind}`}>
        {cfg.title}
      </s-link>
      <Button slot="primary-action" variant="primary" onClick={() => save("list")} loading={busy}>
        Save
      </Button>
      {isNew ? (
        <Button slot="secondary-actions" onClick={() => save("another")} disabled={busy}>
          Save and add another
        </Button>
      ) : (
        <Button slot="secondary-actions" tone="critical" onClick={remove} disabled={busy}>
          Delete
        </Button>
      )}

      {fetcher.data?.error ? (
        <s-banner tone="critical" heading={`The ${cfg.singular} was not saved`}>
          {fetcher.data.error}
        </s-banner>
      ) : null}
      {touched && missing.length ? (
        <s-banner tone="warning" heading="Please fill in">
          {missing.join(", ")}
        </s-banner>
      ) : null}

      <s-section>
        <s-stack gap="base">
          {cfg.fields.map((f) => (
            <FieldInput key={f.key} field={f} value={item.values[f.key]} onValue={(v) => set(f.key, v)} alt={String(item.values[cfg.titleKey] || "")} error={touched && f.required && !item.values[f.key] ? `${f.label} is required` : undefined} />
          ))}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Preview">
        <Preview kind={kind} values={item.values} />
      </s-section>
    </s-page>
  );
}

/* ------------------------------------------------------------- one field -- */
function FieldInput(props: { field: FieldDef; value: Value; onValue: (v: Value) => void; alt: string; error?: string }) {
  const { field: f, value, onValue, error } = props;
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  switch (f.type) {
    case "textarea":
      return <TextArea label={f.label} details={f.details} value={text} onValue={onValue} rows={5} error={error} />;
    case "rating":
      return (
        <Select
          label={f.label}
          value={String(value || 0)}
          onValue={(v) => onValue(Number(v))}
          options={[5, 4, 3, 2, 1, 0].map((n) => ({ value: String(n), label: n ? `${"★".repeat(n)}${"☆".repeat(5 - n)}  ${n} star${n === 1 ? "" : "s"}` : "No stars" }))}
        />
      );
    case "select":
      return <Select label={f.label} details={f.details} value={text} onValue={onValue} options={f.options ?? []} />;
    case "date":
    case "datetime":
      return (
        <s-stack gap="small-200">
          <DateField label={f.label} details={f.details} value={text} onValue={onValue} error={error} />
          {text ? (
            <s-box>
              <Button variant="tertiary" onClick={() => onValue("")}>
                Clear date
              </Button>
            </s-box>
          ) : null}
        </s-stack>
      );
    case "bool":
      return <Checkbox label={f.label} details={f.details} checked={value === true} onValue={onValue} />;
    case "media":
    case "image":
      return <MediaField field={f} value={(value as MediaRef) ?? null} onValue={onValue} alt={props.alt} error={error} />;
    case "product":
      return <ProductField field={f} value={(value as ProductRef) ?? null} onValue={onValue} />;
    case "products":
      return <ProductsField field={f} value={Array.isArray(value) ? value : []} onValue={onValue} />;
    default:
      return <TextField label={f.label} details={f.details} placeholder={f.placeholder} value={text} onValue={onValue} error={error} />;
  }
}

function ProductField(props: { field: FieldDef; value: ProductRef | null; onValue: (v: Value) => void }) {
  const shopify = useAppBridge();
  const pick = async () => {
    const selected: any = await shopify.resourcePicker({ type: "product", multiple: false, action: "select" } as any);
    const p = selected?.[0];
    if (p) props.onValue({ id: p.id, title: p.title, image: p.images?.[0]?.originalSrc ?? null });
  };
  return (
    <s-stack gap="small-200">
      <s-text type="strong">{props.field.label}</s-text>
      {props.value ? (
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-thumbnail src={props.value.image ?? undefined} alt={props.value.title} size="small" />
          <s-text>{props.value.title}</s-text>
          <Button variant="tertiary" onClick={pick}>
            Change
          </Button>
          <Button variant="tertiary" tone="critical" onClick={() => props.onValue(null)}>
            Remove
          </Button>
        </s-stack>
      ) : (
        <s-box>
          <Button icon="product" onClick={pick}>
            Choose a product
          </Button>
        </s-box>
      )}
      {props.field.details ? <s-text color="subdued">{props.field.details}</s-text> : null}
    </s-stack>
  );
}

/** Several products: pick, add more, remove one at a time. */
function ProductsField(props: { field: FieldDef; value: ProductRef[]; onValue: (v: Value) => void }) {
  const shopify = useAppBridge();
  const pick = async () => {
    const selected: any = await shopify.resourcePicker({ type: "product", multiple: true, action: "select", selectionIds: props.value.map((p) => ({ id: p.id })) } as any);
    if (!selected) return;
    props.onValue(selected.map((p: any) => ({ id: p.id, title: p.title, image: p.images?.[0]?.originalSrc ?? null })));
  };
  return (
    <s-stack gap="small-200">
      <s-text type="strong">{props.field.label}</s-text>
      {props.value.map((p) => (
        <s-stack key={p.id} direction="inline" gap="base" alignItems="center">
          <s-thumbnail src={p.image ?? undefined} alt={p.title} size="small" />
          <s-text>{p.title || "Product"}</s-text>
          <Button variant="tertiary" tone="critical" accessibilityLabel={`Remove ${p.title}`} onClick={() => props.onValue(props.value.filter((x) => x.id !== p.id))}>
            Remove
          </Button>
        </s-stack>
      ))}
      <s-box>
        <Button icon="product" onClick={pick}>
          {props.value.length ? "Add or remove products" : "Choose products"}
        </Button>
      </s-box>
      {props.field.details ? <s-text color="subdued">{props.field.details}</s-text> : null}
    </s-stack>
  );
}

function MediaField(props: { field: FieldDef; value: MediaRef | null; onValue: (v: Value) => void; alt: string; error?: string }) {
  return (
    <MediaPicker
      label={props.field.label}
      details={props.field.details}
      accept={props.field.type === "image" ? "image" : "media"}
      value={props.value}
      onValue={props.onValue}
      alt={props.alt}
      error={props.error}
    />
  );
}

/* --------------------------------------------------------------- preview -- */
const box: React.CSSProperties = { borderRadius: 12, padding: 14, background: "#f6f6f7", fontSize: 13, lineHeight: 1.5 };

function Preview({ kind, values: v }: { kind: SectionKind; values: Record<string, Value> }) {
  if (kind === "reviews") {
    const media = v.media as MediaRef | null;
    const rating = Number(v.rating) || 0;
    const src = SOURCES.find((s) => s.value && s.value === v.source);
    return (
      <div style={{ ...box, padding: 0, overflow: "hidden" }}>
        {media?.url ? <img src={media.url} alt="" style={{ display: "block", width: "100%", aspectRatio: "4 / 5", objectFit: "cover" }} /> : null}
        <div style={{ padding: 14, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#f5a623", letterSpacing: 2 }}>{rating ? "★".repeat(rating) + "☆".repeat(5 - rating) : ""}</span>
            {src ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#e3e3e3" }}>{src.label}</span> : null}
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>{String(v.text || "What the customer said appears here.")}</div>
          <div>
            <b>{String(v.name || "Customer name")}</b>
            {v.verified ? <span style={{ color: "#1a7f37", marginLeft: 8, fontSize: 12 }}>✓ Verified buyer</span> : null}
            {v.location ? <div style={{ color: "#616161", fontSize: 12 }}>{String(v.location)}</div> : null}
          </div>
        </div>
      </div>
    );
  }
  if (kind === "faq") {
    return (
      <div style={box}>
        {v.group ? <div style={{ fontSize: 11, color: "#616161", textTransform: "uppercase", letterSpacing: ".05em" }}>{String(v.group)}</div> : null}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, margin: "4px 0 6px" }}>
          <span>{String(v.question || "Your question")}</span>
          <span>−</span>
        </div>
        <div style={{ color: "#4a4a4a", whiteSpace: "pre-wrap" }}>{String(v.answer || "The answer appears here.")}</div>
      </div>
    );
  }
  if (kind === "logos") {
    const img = v.image as MediaRef | null;
    return (
      <div style={{ ...box, display: "grid", placeItems: "center", minHeight: 90 }}>
        {img?.url ? <img src={img.url} alt={String(v.name || "")} style={{ maxHeight: 48, maxWidth: "100%", filter: "grayscale(1)", opacity: 0.85 }} /> : <span style={{ color: "#8a8a8a" }}>Your logo</span>}
      </div>
    );
  }
  return (
    <div style={{ ...box, background: "#121212", color: "#fff", textAlign: "center" }}>
      <span style={v.link ? { textDecoration: "underline", textUnderlineOffset: 3 } : undefined}>{String(v.message || "Your message")}</span>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
