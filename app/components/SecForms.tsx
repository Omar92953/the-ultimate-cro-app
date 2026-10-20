/* eslint-disable @typescript-eslint/no-explicit-any -- App Bridge resource picker payloads are untyped */
/**
 * The Content and Style settings of each CRO section (lib/cro-sections.ts), used by
 * app.designs.cro.$kind.tsx. One small form per kind; the shared look (colours, spacing) is in the route.
 */
import { useState, type ReactNode } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Button, Checkbox, NumberField, Select, Switch, TextArea, TextField } from "./fields";
import { MediaPicker } from "./MediaPicker";
import { SortableList, arrayMove } from "./Sortable";
import { SEC_ICONS, SEC_ICON_KEYS } from "../lib/sec-icons";
import type { SecConfig, SecContent, SecKind, SecLayout, Spot } from "../lib/cro-sections";

type Props<K extends SecKind> = { cfg: SecConfig<K>; content: (patch: Partial<SecContent[K]>) => void };
type LayoutProps<K extends SecKind> = { cfg: SecConfig<K>; layout: (patch: Partial<SecLayout[K]>) => void };

const ICON_OPTIONS = [{ value: "", label: "No icon" }, ...SEC_ICON_KEYS.map((k) => ({ value: k, label: SEC_ICONS[k].label }))];
const RATIO_OPTIONS = [{ value: "auto", label: "The picture's own shape" }, { value: "1", label: "Square" }, { value: "0.8", label: "Portrait (4:5)" }, { value: "1.5", label: "Landscape (3:2)" }];
const CELL = [{ value: "y", label: "Tick" }, { value: "n", label: "Cross" }, { value: "t", label: "Text" }];

function Box({ children }: { children: ReactNode }) {
  return (
    <s-box padding="small-200" borderWidth="base" borderRadius="base">
      {children}
    </s-box>
  );
}
function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button icon="delete" tone="critical" variant="tertiary" accessibilityLabel={label} onClick={onClick}>
      Remove
    </Button>
  );
}
/** A small icon picker: the icon drawn next to a select of names. */
function IconSelect({ value, onValue }: { value: string; onValue: (v: string) => void }) {
  return (
    <s-stack direction="inline" gap="small-200" alignItems="end">
      <span aria-hidden="true" style={{ display: "inline-flex", width: 36, height: 36, alignItems: "center", justifyContent: "center", border: "1px solid #e3e3e3", borderRadius: 8 }}>
        {value ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: SEC_ICONS[value as keyof typeof SEC_ICONS].svg }} /> : null}
      </span>
      <s-box inlineSize="200px">
        <Select label="Icon" value={value} onValue={onValue} options={ICON_OPTIONS} />
      </s-box>
    </s-stack>
  );
}

/* ---------------------------------------------------------------- content -- */

export function CompareContent({ cfg, content }: Props<"compare_table">) {
  const x = cfg.content;
  const row = (i: number, patch: Partial<SecContent["compare_table"]["rows"][number]>) => content({ rows: x.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const kind = (v: string) => (v === "y" || v === "n" ? v : "t");
  const Cell = ({ label, value, onValue }: { label: string; value: string; onValue: (v: string) => void }) => (
    <s-stack gap="small-200">
      <Select label={label} value={kind(value)} onValue={(v) => onValue(v === "t" ? "" : v)} options={CELL} />
      {kind(value) === "t" ? <TextField label={`${label} text`} value={value} onValue={onValue} placeholder="e.g. $29" /> : null}
    </s-stack>
  );
  const setThem = (them: string[]) => content({ them, rows: x.rows.map((r) => ({ ...r, them: them.map((_, i) => r.them[i] ?? "n") })) });
  return (
    <>
      <s-section heading="Columns">
        <s-stack gap="base">
          <TextField label="Your column" value={x.us} onValue={(v) => content({ us: v })} details="Your brand or product name." />
          {x.them.map((t, i) => (
            <s-stack key={i} direction="inline" gap="small-200" alignItems="end">
              <s-box inlineSize="70%">
                <TextField label={`Other column ${i + 1}`} value={t} onValue={(v) => setThem(x.them.map((y, j) => (j === i ? v : y)))} placeholder="Others" />
              </s-box>
              {x.them.length > 1 ? <Remove label={`Remove column ${i + 1}`} onClick={() => setThem(x.them.filter((_, j) => j !== i))} /> : null}
            </s-stack>
          ))}
          {x.them.length < 3 ? (
            <s-box>
              <Button icon="plus" onClick={() => setThem([...x.them, "Brand X"])}>Add a column</Button>
            </s-box>
          ) : null}
        </s-stack>
      </s-section>
      <s-section heading={`Rows (${x.rows.length})`}>
        <s-stack gap="base">
          <SortableList
            items={x.rows}
            keyOf={(_, i) => String(i)}
            labelOf={(r) => r.label || "Row"}
            onMove={(a, b) => content({ rows: arrayMove(x.rows, a, b) })}
            gap={6}
            render={(r, i, handle) => (
              <Box>
                <s-stack gap="small-200">
                  <s-stack direction="inline" gap="small-200" alignItems="end">
                    {handle}
                    <s-box inlineSize="60%">
                      <TextField label="Feature" value={r.label} onValue={(v) => row(i, { label: v })} />
                    </s-box>
                    <Remove label={`Remove ${r.label || "row"}`} onClick={() => content({ rows: x.rows.filter((_, j) => j !== i) })} />
                  </s-stack>
                  <s-grid gridTemplateColumns={`repeat(${1 + x.them.length}, 1fr)`} gap="small-200">
                    <Cell label={x.us || "You"} value={r.us} onValue={(v) => row(i, { us: v })} />
                    {x.them.map((t, k) => (
                      <Cell key={k} label={t || `Other ${k + 1}`} value={r.them[k] ?? "n"} onValue={(v) => row(i, { them: r.them.map((y, j) => (j === k ? v : y)) })} />
                    ))}
                  </s-grid>
                </s-stack>
              </Box>
            )}
          />
          {x.rows.length < 12 ? (
            <s-box>
              <Button icon="plus" onClick={() => content({ rows: [...x.rows, { label: "", us: "y", them: x.them.map(() => "n") }] })}>Add a row</Button>
            </s-box>
          ) : null}
        </s-stack>
      </s-section>
    </>
  );
}

export function BenefitsContent({ cfg, content }: Props<"benefits">) {
  const x = cfg.content;
  const item = (i: number, patch: Partial<SecContent["benefits"]["items"][number]>) => content({ items: x.items.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <s-section heading={`Benefits (${x.items.length})`}>
      <s-stack gap="base">
        <SortableList
          items={x.items}
          keyOf={(_, i) => String(i)}
          labelOf={(r) => r.title || "Benefit"}
          onMove={(a, b) => content({ items: arrayMove(x.items, a, b) })}
          gap={6}
          render={(r, i, handle) => (
            <Box>
              <s-stack gap="small-200">
                <s-stack direction="inline" gap="small-200" alignItems="end">
                  {handle}
                  <IconSelect value={r.icon} onValue={(v) => item(i, { icon: v as typeof r.icon })} />
                  <Remove label={`Remove ${r.title || "benefit"}`} onClick={() => content({ items: x.items.filter((_, j) => j !== i) })} />
                </s-stack>
                <s-grid gridTemplateColumns="1fr 1fr" gap="small-200">
                  <TextField label="Title" value={r.title} onValue={(v) => item(i, { title: v })} />
                  <TextField label="Text" value={r.text} onValue={(v) => item(i, { text: v })} />
                </s-grid>
                <MediaPicker label="Own picture instead of the icon (optional)" accept="image" value={r.image} onValue={(v) => item(i, { image: v })} alt={r.title || "Benefit icon"} />
              </s-stack>
            </Box>
          )}
        />
        {x.items.length < 6 ? (
          <s-box>
            <Button icon="plus" onClick={() => content({ items: [...x.items, { icon: "star", image: null, title: "", text: "" }] })}>Add a benefit</Button>
          </s-box>
        ) : null}
      </s-stack>
    </s-section>
  );
}

export function TabsContent({ cfg, content }: Props<"product_tabs">) {
  const x = cfg.content;
  const tab = (i: number, patch: Partial<SecContent["product_tabs"]["tabs"][number]>) => content({ tabs: x.tabs.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <>
      <s-section heading="Product description">
        <s-stack gap="base">
          <Switch label="First tab shows the product's own description" checked={x.desc} onValue={(v) => content({ desc: v })} />
          {x.desc ? <TextField label="Its title" value={x.descTitle} onValue={(v) => content({ descTitle: v })} /> : null}
        </s-stack>
      </s-section>
      <s-section heading={`More tabs (${x.tabs.length})`}>
        <s-stack gap="base">
          <s-text color="subdued">The same text shows on every product. To give a product its own text, name a product metafield (for example custom.care); products without it show the text below.</s-text>
          <SortableList
            items={x.tabs}
            keyOf={(_, i) => String(i)}
            labelOf={(r) => r.title || "Tab"}
            onMove={(a, b) => content({ tabs: arrayMove(x.tabs, a, b) })}
            gap={6}
            render={(r, i, handle) => (
              <Box>
                <s-stack gap="small-200">
                  <s-stack direction="inline" gap="small-200" alignItems="end">
                    {handle}
                    <s-box inlineSize="45%">
                      <TextField label="Title" value={r.title} onValue={(v) => tab(i, { title: v })} />
                    </s-box>
                    <s-box inlineSize="35%">
                      <TextField label="Product metafield (optional)" value={r.mf} onValue={(v) => tab(i, { mf: v.trim() })} placeholder="custom.shipping" />
                    </s-box>
                    <Remove label={`Remove ${r.title || "tab"}`} onClick={() => content({ tabs: x.tabs.filter((_, j) => j !== i) })} />
                  </s-stack>
                  <TextArea label="Text" rows={3} value={r.text} onValue={(v) => tab(i, { text: v })} />
                </s-stack>
              </Box>
            )}
          />
          {x.tabs.length < 5 ? (
            <s-box>
              <Button icon="plus" onClick={() => content({ tabs: [...x.tabs, { title: "", text: "", mf: "" }] })}>Add a tab</Button>
            </s-box>
          ) : null}
        </s-stack>
      </s-section>
    </>
  );
}

export function GuaranteeContent({ cfg, content }: Props<"guarantee">) {
  const x = cfg.content;
  return (
    <s-section heading="Guarantee">
      <s-stack gap="base">
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <Select
            label="Seal"
            value={x.seal}
            onValue={(v) => content({ seal: v as typeof x.seal })}
            options={[
              { value: "money", label: "Money back" },
              { value: "returns", label: "Free returns" },
              { value: "shipping", label: "Free shipping" },
              { value: "secure", label: "Secure checkout" },
              { value: "quality", label: "Premium quality" },
              { value: "image", label: "My own picture" },
              { value: "none", label: "No seal" },
            ]}
          />
          {x.seal === "money" || x.seal === "returns" ? <NumberField label="Days on the seal" min={1} max={365} value={x.days} onValue={(v) => content({ days: v })} /> : <span />}
        </s-grid>
        {x.seal === "image" ? <MediaPicker label="Seal picture" accept="image" value={x.image} onValue={(v) => content({ image: v })} alt="Guarantee seal" /> : null}
        <TextField label="Title" value={x.title} onValue={(v) => content({ title: v })} />
        <TextArea label="Text" rows={3} value={x.text} onValue={(v) => content({ text: v })} />
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <TextField label="Link text (optional)" value={x.linkText} onValue={(v) => content({ linkText: v })} placeholder="Read our policy" />
          <TextField label="Link" value={x.link} onValue={(v) => content({ link: v })} placeholder="/policies/refund-policy" />
        </s-grid>
        <s-text color="subdued">Only promise what your store really does: the guarantee should match your refund policy.</s-text>
      </s-stack>
    </s-section>
  );
}

export function BeforeAfterContent({ cfg, content }: Props<"before_after">) {
  const x = cfg.content;
  return (
    <s-section heading="Pictures">
      <s-stack gap="base">
        <s-text color="subdued">Use two pictures of the same size and framing. Sample pictures show until you pick yours.</s-text>
        <MediaPicker label="Before" accept="image" value={x.before} onValue={(v) => content({ before: v })} alt={x.beforeLabel || "Before"} />
        <MediaPicker label="After" accept="image" value={x.after} onValue={(v) => content({ after: v })} alt={x.afterLabel || "After"} />
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <TextField label="Before label" value={x.beforeLabel} onValue={(v) => content({ beforeLabel: v })} />
          <TextField label="After label" value={x.afterLabel} onValue={(v) => content({ afterLabel: v })} />
        </s-grid>
        <TextField label="Caption under the pictures (optional)" value={x.caption} onValue={(v) => content({ caption: v })} />
      </s-stack>
    </s-section>
  );
}

export function ShoppableContent({ cfg, content }: Props<"shoppable">) {
  const x = cfg.content;
  const shopify = useAppBridge();
  const [active, setActive] = useState(0);
  const spot = (i: number, patch: Partial<Spot>) => content({ spots: x.spots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  async function pick(i: number | null) {
    const selected: any = await shopify.resourcePicker({ type: "product", multiple: false, action: "select", filter: { variants: false } } as any);
    const p = selected?.[0];
    if (!p) return;
    const v = p.variants?.[0];
    const next: Spot = {
      x: i === null ? 50 : x.spots[i].x,
      y: i === null ? 50 : x.spots[i].y,
      id: p.id,
      handle: p.handle,
      title: p.title,
      image: p.images?.[0]?.originalSrc ?? p.images?.[0]?.url ?? null,
      price: Math.round(Number(v?.price ?? 0) * 100),
      variant: v?.id ?? "",
      variants: p.variants?.length || p.totalVariants || 1,
    };
    if (i === null) {
      content({ spots: [...x.spots, next] });
      setActive(x.spots.length);
    } else spot(i, next);
  }
  const url = x.image?.url;
  return (
    <>
      <s-section heading="Picture">
        <MediaPicker label="The picture" accept="image" value={x.image} onValue={(v) => content({ image: v })} alt="Shop the look" />
      </s-section>
      <s-section heading={`Products on the picture (${x.spots.length} of 8)`}>
        <s-stack gap="base">
          {url ? (
            <>
              <s-text color="subdued">Choose a product below, then click on the picture where it is.</s-text>
              <div
                role="presentation"
                onClick={(e) => {
                  if (!x.spots[active]) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  spot(active, { x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) });
                }}
                style={{ position: "relative", cursor: x.spots.length ? "crosshair" : "default", borderRadius: 8, overflow: "hidden", lineHeight: 0 }}
              >
                <img src={url} alt="" style={{ width: "100%", display: "block" }} />
                {x.spots.map((s, i) => (
                  <span key={i} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: 26, height: 26, margin: "-13px 0 0 -13px", borderRadius: "50%", background: i === active ? "#303030" : "#fff", color: i === active ? "#fff" : "#303030", display: "flex", alignItems: "center", justifyContent: "center", font: "600 12px/1 sans-serif", boxShadow: "0 1px 4px rgba(0,0,0,.4)" }}>
                    {i + 1}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <s-text color="subdued">Pick a picture first. The preview shows a sample until then.</s-text>
          )}
          {x.spots.map((s, i) => (
            <Box key={i}>
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <Button variant={i === active ? "primary" : "secondary"} onClick={() => setActive(i)} accessibilityLabel={`Place product ${i + 1} on the picture`}>
                  {String(i + 1)}
                </Button>
                <s-thumbnail src={s.image ?? undefined} alt={s.title} size="small" />
                <s-box inlineSize="40%">
                  <s-text>{s.title}</s-text>
                </s-box>
                <Button variant="tertiary" onClick={() => pick(i)}>Change</Button>
                <Remove label={`Remove ${s.title}`} onClick={() => content({ spots: x.spots.filter((_, j) => j !== i) })} />
              </s-stack>
            </Box>
          ))}
          {x.spots.length < 8 ? (
            <s-box>
              <Button icon="product" onClick={() => pick(null)}>Add a product</Button>
            </s-box>
          ) : null}
        </s-stack>
      </s-section>
      <s-section heading="Words">
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <TextField label="Add to cart button" value={x.button} onValue={(v) => content({ button: v })} />
          <TextField label="Button for products with options" value={x.viewText} onValue={(v) => content({ viewText: v })} />
        </s-grid>
      </s-section>
    </>
  );
}

export function RecentContent({ cfg, content }: Props<"recently_viewed">) {
  const x = cfg.content;
  return (
    <s-section heading="Products">
      <s-stack gap="base">
        <s-text color="subdued">Each shopper sees the products they opened last. The list stays in their own browser and is never sent to the app. Put this section on the product page so views are noted.</s-text>
        <NumberField label="How many products" min={2} max={12} value={x.count} onValue={(v) => content({ count: v })} />
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <TextField label="Add to cart button" value={x.button} onValue={(v) => content({ button: v })} />
          <TextField label="Button for products with options" value={x.chooseText} onValue={(v) => content({ chooseText: v })} />
          <TextField label="Sold out" value={x.soldOut} onValue={(v) => content({ soldOut: v })} />
        </s-grid>
      </s-stack>
    </s-section>
  );
}

export function StepsContent({ cfg, content }: Props<"how_it_works">) {
  const x = cfg.content;
  const step = (i: number, patch: Partial<SecContent["how_it_works"]["steps"][number]>) => content({ steps: x.steps.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <>
      <s-section heading={`Steps (${x.steps.length})`}>
        <s-stack gap="base">
          <SortableList
            items={x.steps}
            keyOf={(_, i) => String(i)}
            labelOf={(r) => r.title || "Step"}
            onMove={(a, b) => content({ steps: arrayMove(x.steps, a, b) })}
            gap={6}
            render={(r, i, handle) => (
              <Box>
                <s-stack gap="small-200">
                  <s-stack direction="inline" gap="small-200" alignItems="end">
                    {handle}
                    <s-text type="strong">Step {i + 1}</s-text>
                    <IconSelect value={r.icon} onValue={(v) => step(i, { icon: v as typeof r.icon })} />
                    {x.steps.length > 1 ? <Remove label={`Remove step ${i + 1}`} onClick={() => content({ steps: x.steps.filter((_, j) => j !== i) })} /> : null}
                  </s-stack>
                  <TextField label="Title" value={r.title} onValue={(v) => step(i, { title: v })} />
                  <TextArea label="Text" rows={2} value={r.text} onValue={(v) => step(i, { text: v })} />
                </s-stack>
              </Box>
            )}
          />
          {x.steps.length < 5 ? (
            <s-box>
              <Button icon="plus" onClick={() => content({ steps: [...x.steps, { icon: "check", title: "", text: "" }] })}>Add a step</Button>
            </s-box>
          ) : null}
        </s-stack>
      </s-section>
      <s-section heading="Button (optional)">
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <TextField label="Button text" value={x.button} onValue={(v) => content({ button: v })} placeholder="Shop now" />
          <TextField label="Link" value={x.link} onValue={(v) => content({ link: v })} placeholder="/collections/all" />
        </s-grid>
      </s-section>
    </>
  );
}

export function PopupContent({ cfg, content }: Props<"email_popup">) {
  const x = cfg.content;
  const discount = (patch: Partial<typeof x.discount>) => content({ discount: { ...x.discount, ...patch } });
  const show = (patch: Partial<typeof x.show>) => content({ show: { ...x.show, ...patch } });
  return (
    <>
      <s-section heading="Pop up">
        <s-stack gap="base">
          <Switch label="Show the pop up on the store" checked={x.on} onValue={(v) => content({ on: v })} details="It also needs the Conversion boosters embed switched on in your theme." />
          <MediaPicker label="Picture (optional)" accept="image" value={x.image} onValue={(v) => content({ image: v })} alt="Sign up" />
        </s-stack>
      </s-section>
      <s-section heading="Discount">
        <s-stack gap="base">
          <s-text color="subdued">Each email gets its own code, valid once and only for that shopper. The same email gets the same code back.</s-text>
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <Select label="Type" value={x.discount.type} onValue={(v) => discount({ type: v as typeof x.discount.type })} options={[{ value: "percent", label: "Percent off" }, { value: "amount", label: "Amount off" }]} />
            <NumberField label={x.discount.type === "percent" ? "Percent" : "Amount"} suffix={x.discount.type === "percent" ? "%" : undefined} min={1} max={x.discount.type === "percent" ? 90 : 100000} value={x.discount.value} onValue={(v) => discount({ value: v })} />
            <NumberField label="Minimum order (0 = none)" min={0} max={100000} value={x.discount.minimum} onValue={(v) => discount({ minimum: v })} />
            <NumberField label="Code works for" suffix="days" min={1} max={365} value={x.discount.days} onValue={(v) => discount({ days: v })} />
          </s-grid>
        </s-stack>
      </s-section>
      <s-section heading="When it shows">
        <s-stack gap="base">
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <NumberField label="After" suffix="seconds" min={0} max={120} value={x.show.delay} onValue={(v) => show({ delay: v })} details="0 = don't wait" />
            <NumberField label="Or after scrolling" suffix="%" min={0} max={100} value={x.show.scroll} onValue={(v) => show({ scroll: v })} details="0 = off" />
            <Select label="Pages" value={x.show.pages} onValue={(v) => show({ pages: v as typeof x.show.pages })} options={[{ value: "all", label: "Every page" }, { value: "home", label: "Home page" }, { value: "product", label: "Product pages" }, { value: "collection", label: "Collection pages" }]} />
            <NumberField label="Show again after" suffix="days" min={1} max={365} value={x.show.every} onValue={(v) => show({ every: v })} details="Never again once they sign up." />
          </s-grid>
          <Checkbox label="Also when the mouse leaves the page (computers only)" checked={x.show.exit} onValue={(v) => show({ exit: v })} />
        </s-stack>
      </s-section>
      <s-section heading="Words">
        <s-stack gap="base">
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <TextField label="Email box" value={x.placeholder} onValue={(v) => content({ placeholder: v })} />
            <TextField label="Button" value={x.button} onValue={(v) => content({ button: v })} />
            <TextField label="Close link" value={x.no} onValue={(v) => content({ no: v })} details="Empty = only the X" />
            <TextField label="Copy button" value={x.copy} onValue={(v) => content({ copy: v })} />
          </s-grid>
          <TextArea label="Consent line" rows={2} value={x.consent} onValue={(v) => content({ consent: v })} />
          <Checkbox label="Shoppers tick a box to agree (needed in some countries)" checked={x.tick} onValue={(v) => content({ tick: v })} />
          <TextField label="After signing up" value={x.success} onValue={(v) => content({ success: v })} />
          <s-text color="subdued">Sign ups are added to your Shopify customers with email marketing consent and the tag cro-popup, so your own email tool can welcome them. The app keeps no emails.</s-text>
        </s-stack>
      </s-section>
    </>
  );
}

/* ----------------------------------------------------------------- layout -- */

export function SecLayoutForm({ cfg, layout }: LayoutProps<SecKind>) {
  const l = cfg.layout as Record<string, any>;
  const set = (patch: Record<string, unknown>) => layout(patch as never);
  switch (cfg.kind) {
    case "compare_table":
      return (
        <s-stack gap="small-200">
          <Select label="Layout" value={l.style} onValue={(v) => set({ style: v })} options={[{ value: "table", label: "Table" }, { value: "cards", label: "Cards side by side" }]} />
          <Checkbox label="Highlight your column" checked={l.highlight} onValue={(v) => set({ highlight: v })} />
          <Checkbox label="Striped rows" checked={l.stripes} onValue={(v) => set({ stripes: v })} />
        </s-stack>
      );
    case "benefits":
      return (
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <Select label="Layout" value={l.style} onValue={(v) => set({ style: v })} options={[{ value: "top", label: "Icon on top" }, { value: "left", label: "Icon on the left" }, { value: "boxed", label: "Boxes" }, { value: "strip", label: "Slim strip" }]} />
          <Select label="On phones" value={l.mobile} onValue={(v) => set({ mobile: v })} options={[{ value: "two", label: "Two per row" }, { value: "stack", label: "One per row" }, { value: "scroll", label: "Swipe sideways" }]} />
        </s-grid>
      );
    case "product_tabs":
      return (
        <s-stack gap="small-200">
          <Select label="Layout" value={l.style} onValue={(v) => set({ style: v })} options={[{ value: "accordion", label: "Accordion in boxes" }, { value: "lines", label: "Accordion with lines" }, { value: "tabs", label: "Tabs" }]} />
          {l.style !== "tabs" ? <Checkbox label="First one open" checked={l.firstOpen} onValue={(v) => set({ firstOpen: v })} /> : null}
        </s-stack>
      );
    case "guarantee":
      return <Select label="Layout" value={l.style} onValue={(v) => set({ style: v })} options={[{ value: "left", label: "Seal on the left" }, { value: "center", label: "Seal on top, centred" }, { value: "banner", label: "Big banner" }, { value: "inline", label: "Small line" }]} />;
    case "before_after":
      return (
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <Select label="Direction" value={l.dir} onValue={(v) => set({ dir: v })} options={[{ value: "h", label: "Side to side" }, { value: "v", label: "Top to bottom" }]} />
          <Select label="Handle" value={l.handle} onValue={(v) => set({ handle: v })} options={[{ value: "circle", label: "Round" }, { value: "arrows", label: "Tall with arrows" }, { value: "line", label: "Thin line" }]} />
          <NumberField label="Line starts at" suffix="%" min={5} max={95} value={l.start} onValue={(v) => set({ start: v })} />
          <Select label="Shape" value={l.ratio} onValue={(v) => set({ ratio: v })} options={RATIO_OPTIONS} />
        </s-grid>
      );
    case "shoppable":
      return (
        <s-stack gap="small-200">
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <Select label="Markers" value={l.marker} onValue={(v) => set({ marker: v })} options={[{ value: "dot", label: "Dots" }, { value: "number", label: "Numbers" }, { value: "plus", label: "Plus signs" }]} />
            <Select label="Shape" value={l.ratio} onValue={(v) => set({ ratio: v })} options={RATIO_OPTIONS} />
          </s-grid>
          <Checkbox label="Markers pulse gently" checked={l.pulse} onValue={(v) => set({ pulse: v })} />
        </s-stack>
      );
    case "recently_viewed":
      return (
        <s-stack gap="small-200">
          <Select label="Layout" value={l.style} onValue={(v) => set({ style: v })} options={[{ value: "grid", label: "Cards" }, { value: "row", label: "Compact rows" }, { value: "carousel", label: "Carousel" }]} />
          <Checkbox label="Show prices" checked={l.price} onValue={(v) => set({ price: v })} />
          <Checkbox label="Add to cart buttons" checked={l.add} onValue={(v) => set({ add: v })} />
          <Checkbox label="Leave out the product being viewed" checked={l.hideCurrent} onValue={(v) => set({ hideCurrent: v })} />
        </s-stack>
      );
    case "how_it_works":
      return (
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <Select label="Layout" value={l.style} onValue={(v) => set({ style: v })} options={[{ value: "circles", label: "Circles in a row" }, { value: "timeline", label: "Timeline" }, { value: "cards", label: "Cards" }]} />
          <Select label="Marker" value={l.marker} onValue={(v) => set({ marker: v })} options={[{ value: "number", label: "Numbers" }, { value: "icon", label: "Icons" }]} />
        </s-grid>
      );
    case "email_popup":
      return <Select label="Layout" value={l.style} onValue={(v) => set({ style: v })} options={[{ value: "center", label: "Centred box" }, { value: "side", label: "Picture beside the form" }, { value: "bar", label: "Bar at the bottom" }, { value: "full", label: "Full screen on phones" }]} />;
  }
}

/** The Content tab for any kind. */
export function SecContentForm({ cfg, content }: { cfg: SecConfig; content: (patch: Record<string, unknown>) => void }) {
  const c = content as never;
  switch (cfg.kind) {
    case "compare_table": return <CompareContent cfg={cfg as SecConfig<"compare_table">} content={c} />;
    case "benefits": return <BenefitsContent cfg={cfg as SecConfig<"benefits">} content={c} />;
    case "product_tabs": return <TabsContent cfg={cfg as SecConfig<"product_tabs">} content={c} />;
    case "guarantee": return <GuaranteeContent cfg={cfg as SecConfig<"guarantee">} content={c} />;
    case "before_after": return <BeforeAfterContent cfg={cfg as SecConfig<"before_after">} content={c} />;
    case "shoppable": return <ShoppableContent cfg={cfg as SecConfig<"shoppable">} content={c} />;
    case "recently_viewed": return <RecentContent cfg={cfg as SecConfig<"recently_viewed">} content={c} />;
    case "how_it_works": return <StepsContent cfg={cfg as SecConfig<"how_it_works">} content={c} />;
    case "email_popup": return <PopupContent cfg={cfg as SecConfig<"email_popup">} content={c} />;
  }
}
