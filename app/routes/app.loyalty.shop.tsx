/**
 * Loyalty → Points shop (Omar, 2026-10-24): products members get with points, or points plus money. Each one has
 * its price in points, a money part, who sees it and a limit per customer. Members get a one use code for the
 * variant they chose (lib/loyalty/shop.server.ts). Saving also saves the storefront copy (lib/loyalty/storefront.server.ts).
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage, gql } from "../lib/admin.server";
import { getProgram, saveProgramConfig } from "../lib/loyalty/program.server";
import { publishLoyalty } from "../lib/loyalty/storefront.server";
import { MAX_SHOP_ITEMS, SHOP_SHOW, SHOP_SHOW_LABEL, type LoyaltyConfig, type ShopItem, type ShopShow } from "../lib/loyalty/config";
import { Button, Checkbox, NumberField, Select, Switch } from "../components/fields";
import { HomeRow, HomeRows, PageIntro } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [p, shop] = await Promise.all([getProgram(session.shop), gql(admin, `#graphql
    query CroLoyaltyShop { shop { currencyCode } }`).catch(() => null)]);
  return { config: p.config, saved: p.saved, currency: shop?.shop?.currencyCode ?? "USD" };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveProgramConfig(session.shop, JSON.parse(String(form.get("config"))));
    await publishLoyalty(admin, session.shop);
    return { ok: true, error: null, config };
  } catch (e) {
    return { ok: false, error: errorMessage(e), config: null };
  }
};

type C = LoyaltyConfig;
const newId = () => `s${Date.now().toString(36).slice(-6)}`;

export default function LoyaltyShop() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [cfg, setCfg] = useState<C>(d.config);
  const [loaded, setLoaded] = useState(d.config);
  if (loaded !== d.config) {
    setLoaded(d.config);
    setCfg(d.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else shopify.toast.show("Saved");
  }, [fetcher.state, fetcher.data, shopify]);
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: d.currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
    } catch {
      return `${n} ${d.currency}`;
    }
  };
  const shop = cfg.shop;
  const setShop = (patch: Partial<C["shop"]>) => setCfg((c) => ({ ...c, shop: { ...c.shop, ...patch } }));
  const setItem = (i: number, patch: Partial<ShopItem>) => setShop({ items: shop.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const product = (p: any): ShopItem["product"] => ({
    id: String(p.id),
    title: String(p.title),
    handle: String(p.handle ?? ""),
    image: String(p.images?.[0]?.originalSrc ?? p.images?.[0]?.src ?? ""),
    price: Number(p.variants?.[0]?.price ?? 0),
  });
  async function addProducts() {
    const have = new Set(shop.items.map((x) => x.product.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selected: any[] = (await shopify.resourcePicker({ type: "product", multiple: true, action: "add", filter: { variants: false } } as any)) ?? [];
    const added: ShopItem[] = selected
      .filter((p) => !have.has(String(p.id)))
      .map((p, i) => {
        const pr = product(p);
        const points = Math.max(100, Math.round((pr.price * 100) / 50) * 50);
        return { id: `${newId()}${i}`.slice(0, 12), on: true, product: pr, points, money: 0, only: false, unlisted: false, show: "all", from: Math.max(1, Math.floor(points / 2)), limit: 0 };
      });
    if (added.length) setShop({ items: [...shop.items, ...added].slice(0, MAX_SHOP_ITEMS) });
  }
  async function changeProduct(i: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selected: any = await shopify.resourcePicker({ type: "product", multiple: false, action: "select", filter: { variants: false } } as any);
    const p = selected?.[0];
    if (!p || shop.items.some((x, j) => j !== i && x.product.id === String(p.id))) return;
    const pr = product(p);
    setItem(i, { product: pr, money: shop.items[i].money < pr.price ? shop.items[i].money : 0 });
  }
  const priceText = (x: ShopItem) => (x.money > 0 ? `${x.points} ${cfg.unit.many} + ${money(x.money)}` : `${x.points} ${cfg.unit.many}`);

  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <SaveControls dirty={changed(cfg, d.config)} saving={fetcher.state !== "idle"} saved={d.saved} onSave={() => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" })} onDiscard={() => setCfg(d.config)} />
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text="Products members get with their points, or with points plus a smaller price. A button shows on the product page, in the rewards panel and on the Rewards page. Members get a code for one item of the option they chose, only for them, and it is added to their cart." />

        <HomeRow title="Points shop">
          <s-stack gap="base">
            <Switch label="Points shop" details={shop.on ? "Members can get these products with points." : "Turned off: the products are hidden from members."} checked={shop.on} onValue={(v) => setShop({ on: v })} />
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))" gap="base">
              <NumberField label="Code works for" suffix="days" min={1} max={365} step={1} value={shop.days} onValue={(v) => setShop({ days: v })} />
            </s-grid>
            <Switch
              label="Keep a Points shop collection"
              details={shop.collection ? "A collection named Points shop holds the products here that are on and not hidden, and stays in step. Add it to a menu in Online Store, Navigation. Turning this off deletes it." : "Turn on to get a Points shop collection to link in your menu."}
              checked={shop.collection}
              onValue={(v) => setShop({ collection: v })}
            />
          </s-stack>
        </HomeRow>

        <HomeRow title={`Products (${shop.items.length})`}>
          <s-stack gap="base">
            {shop.items.length ? null : <s-text color="subdued">No products yet. Add the products members can get with points.</s-text>}
            {shop.items.map((x, i) => (
              <s-box key={x.id} padding="base" borderWidth="base" borderRadius="base">
                <s-stack gap="base">
                  <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                    <s-stack direction="inline" gap="base" alignItems="center">
                      {x.product.image ? <s-thumbnail src={x.product.image} alt={x.product.title} size="small" /> : null}
                      <Switch label={x.product.title} details={x.on ? `${priceText(x)}. Price in the store ${money(x.product.price)}.` : "Hidden from members."} checked={x.on} onValue={(v) => setItem(i, { on: v })} />
                    </s-stack>
                    <s-stack direction="inline" gap="small-200">
                      <Button variant="tertiary" onClick={() => changeProduct(i)}>
                        Change product
                      </Button>
                      <Button variant="tertiary" tone="critical" icon="delete" onClick={() => setShop({ items: shop.items.filter((_, j) => j !== i) })}>
                        Remove
                      </Button>
                    </s-stack>
                  </s-stack>
                  <s-grid gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))" gap="base">
                    <NumberField label="Price in points" suffix={cfg.unit.many} min={1} max={1000000} step={50} value={x.points} onValue={(v) => setItem(i, { points: v, from: Math.min(x.from, v) })} />
                    <NumberField
                      label="Plus money"
                      suffix={d.currency}
                      min={0}
                      max={Math.max(0, x.product.price - 0.01)}
                      step={1}
                      value={x.money}
                      details="0: points only. Less than the price in the store."
                      onValue={(v) => setItem(i, { money: v < x.product.price ? v : 0 })}
                    />
                    <Select label="Who sees it" value={x.show} onValue={(v) => setItem(i, { show: v as ShopShow })} options={SHOP_SHOW.map((k) => ({ value: k, label: SHOP_SHOW_LABEL[k] }))} />
                    {x.show === "from" ? <NumberField label="Seen from" suffix={cfg.unit.many} min={1} max={x.points} step={50} value={x.from} details="Members see their progress toward it." onValue={(v) => setItem(i, { from: v })} /> : null}
                    <NumberField label="Limit per customer" min={0} max={1000} step={1} value={x.limit} details="0: no limit." onValue={(v) => setItem(i, { limit: v })} />
                  </s-grid>
                  <s-text color="subdued">
                    {x.show === "all"
                      ? "Everyone sees it. Shoppers without enough points see how many more they need."
                      : x.show === "afford"
                        ? "Only signed in members with enough points see it."
                        : `Signed in members see it from ${x.from} ${cfg.unit.many}, with how far they are from the price.`}
                  </s-text>
                  <s-stack direction="inline" gap="large">
                    <Checkbox
                      label="Only with points"
                      details={x.only ? "The store's add to cart button is hidden on its page, and checkout refuses it without the member's code." : "Shoppers can also buy it with money."}
                      checked={x.only}
                      onValue={(v) => setItem(i, { only: v, unlisted: v && x.unlisted })}
                    />
                    {x.only ? (
                      <Checkbox
                        label="Hide it from collections and search"
                        details="The product is Unlisted in Shopify: only a link to it opens it. It is listed again when this is turned off or the product is removed."
                        checked={x.unlisted}
                        onValue={(v) => setItem(i, { unlisted: v })}
                      />
                    ) : null}
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
            {shop.items.length < MAX_SHOP_ITEMS ? (
              <s-stack direction="inline">
                <Button icon="plus" onClick={addProducts}>
                  Add products
                </Button>
              </s-stack>
            ) : null}
          </s-stack>
        </HomeRow>
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
