/**
 * Live preview of a deal on the product page: the same markup and classes as ucs-deals.js with the
 * storefront stylesheet (ucs-boosters.css), the deal's real pictures and prices, and the words the
 * storefront uses (DEAL_TEXT). Used by every deal editor (frequently bought together, buy X get Y,
 * volume, gift, upgrade). `highlight` ("item-N", "tier-N") outlines one row for a moment.
 */
import { Fragment } from "react";
import { DEAL_TEXT, type BogoConfig, type Deal, type FbtDesign, type FixedConfig, type GiftConfig, type UpgradeConfig, type VolumeConfig } from "../lib/deals";
import type { PreviewItem } from "./BundlePreview";
import { flashStyle } from "./flash";

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
const img = (url: string, w: number) => `${url}${url.includes("?") ? "&" : "?"}width=${w}`;

export function DealPreview({ deal, fbt, found, currency = "USD", highlight = null }: { deal: Deal; fbt?: FbtDesign | null; found: Record<string, PreviewItem[]>; currency?: string; highlight?: string | null }) {
  const money = (cents: number) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  };
  const price = (id: string | undefined) => (id ? found[id]?.[0]?.cents : undefined);
  const reward = (pct: number) => (pct >= 100 ? DEAL_TEXT.free : fill(DEAL_TEXT.off, { pct }));
  const sample = 4000;

  if (deal.kind === "bogo") {
    const c = deal.config as BogoConfig;
    const same = c.sameItems;
    const text = same ? fill(DEAL_TEXT.bogo_same, { n: c.x + c.y, y: c.y, reward: reward(c.pct) }) : fill(DEAL_TEXT.bogo, { x: c.x, y: c.y, reward: reward(c.pct) });
    return (
      <div className="ucs-deals">
        <div className="ucs-deal ucs-deal--bogo" style={flashStyle(highlight === "item-0")}>
          <span className="ucs-deal__icon" aria-hidden="true" />
          <div>
            <p className="ucs-deal__name">{deal.name}</p>
            <p className="ucs-deal__text">{text}</p>
          </div>
        </div>
      </div>
    );
  }

  if (deal.kind === "volume") {
    const c = deal.config as VolumeConfig;
    const firstId = c.target.type === "products" ? c.target.products[0]?.id : undefined;
    const unit = price(firstId) ?? sample;
    return (
      <div className="ucs-deals">
        <div className="ucs-deal ucs-deal--volume">
          <p className="ucs-deal__name">{deal.name}</p>
          <ul className="ucs-deal__tiers">
            {[...c.tiers]
              .map((t, n) => ({ t, n }))
              .sort((a, b) => a.t.qty - b.t.qty)
              .map(({ t, n }) => (
                <li key={n} style={flashStyle(highlight === `tier-${n}`)}>
                  <span>{fill(DEAL_TEXT.tier, { qty: t.qty })}</span>
                  <b>{fill(DEAL_TEXT.off, { pct: t.pct })}</b>
                  <small>{fill(DEAL_TEXT.each, { price: money(Math.round(unit * (1 - t.pct / 100))) })}</small>
                </li>
              ))}
          </ul>
        </div>
      </div>
    );
  }

  if (deal.kind === "gift") {
    const c = deal.config as GiftConfig;
    const title = c.gift?.title ?? "your gift";
    const need = Math.round((c.min || 50) * 100);
    return (
      <div className="ucs-deals">
        <div className="ucs-deal ucs-deal--gift" style={flashStyle(highlight === "item-0")}>
          {c.gift?.image ? <img src={img(c.gift.image, 120)} alt="" width={44} height={44} /> : <span className="ucs-deal__icon" aria-hidden="true" />}
          <div>
            <p className="ucs-deal__text">{fill(DEAL_TEXT.gift_left, { amount: money(Math.round(need * 0.4)), gift: title })}</p>
            <span className="ucs-deal__bar">
              <i style={{ width: "60%" }} />
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (deal.kind === "upgrade") {
    const c = deal.config as UpgradeConfig;
    const from = price(c.from?.productId), to = price(c.to?.productId);
    const delta = from !== undefined && to !== undefined ? Math.max(0, to - from) : 1500;
    const text = fill(c.text || "Upgrade to {to} for {delta} more", { to: c.to?.title ?? "the better option", delta: money(delta) });
    return (
      <div className="ucs-deals">
        <div className="ucs-deal ucs-deal--upgrade" style={flashStyle(highlight === "item-0")}>
          {c.to?.image ? <img src={img(c.to.image, 120)} alt="" width={44} height={44} /> : <span className="ucs-deal__icon" aria-hidden="true" />}
          <div>
            <p className="ucs-deal__text">{text}</p>
          </div>
          <button type="button" className="ucs-deal__up">
            {c.button || "Upgrade"}
          </button>
        </div>
      </div>
    );
  }

  // Frequently bought together
  const c = deal.config as FixedConfig;
  const f: FbtDesign = fbt ?? { heading: "Frequently bought together", images: true, button: "Buy all [count]: [price]", saving: "amount", layout: "row", align: "center", border: false, tiles: false };
  const items = c.items.length ? c.items : [{ product: { id: "a", title: "First product", image: null, handle: "" }, qty: 1 }, { product: { id: "b", title: "Second product", image: null, handle: "" }, qty: 1 }];
  const row = f.layout === "row";
  const full = items.reduce((n, i) => n + (price(i.product.id) ?? sample) * i.qty, 0);
  const cut = Math.round((full * (c.pct || 0)) / 100);
  const saving = f.saving === "pct" ? fill(DEAL_TEXT.off, { pct: c.pct || 0 }) : fill(DEAL_TEXT.save, { amount: money(cut) });
  const count = items.reduce((n, i) => n + i.qty, 0);
  const cls = ["ucs-deal", "ucs-deal--fixed", row ? "ucs-deal--row" : "", f.align === "start" ? "ucs-deal--start" : f.align === "end" ? "ucs-deal--end" : "ucs-deal--center", !f.border ? "ucs-deal--plain" : "", !f.tiles ? "ucs-deal--bare" : ""].filter(Boolean).join(" ");
  return (
    <div className="ucs-deals">
      <div className={cls}>
        <p className="ucs-deal__name">{f.heading || deal.name}</p>
        {row && f.images ? (
          <div className="ucs-deal__pics" aria-hidden="true">
            {items.map((i, n) => (
              <Fragment key={i.product.id}>
                {n ? <span className="ucs-deal__plus">+</span> : null}
                <span className="ucs-deal__pic" style={{ ...(i.product.image ? undefined : { background: n % 2 ? "linear-gradient(145deg,#bde0fe,#6c9bd2)" : "linear-gradient(145deg,#ffd6a5,#f4a261)" }), ...flashStyle(highlight === `item-${n}`) }}>
                  {i.product.image ? <img src={img(i.product.image, 300)} alt="" /> : null}
                </span>
              </Fragment>
            ))}
          </div>
        ) : null}
        <ul className="ucs-deal__items">
          {items.map((i, n) => (
            <Fragment key={i.product.id}>
              {!row && n ? (
                <li className="ucs-deal__plus" aria-hidden="true">
                  +
                </li>
              ) : null}
              <li className="ucs-deal__item" style={flashStyle(highlight === `item-${n}`)}>
                {f.images && !row ? i.product.image ? <img src={img(i.product.image, 120)} alt="" width={48} height={48} /> : <span /> : null}
                <span className="ucs-deal__it">
                  <a href="#preview" onClick={(e) => e.preventDefault()}>
                    {i.qty > 1 ? `${i.qty} × ` : ""}
                    {i.product.title}
                  </a>
                </span>
                <span className="ucs-deal__ip">{money((price(i.product.id) ?? sample) * i.qty)}</span>
              </li>
            </Fragment>
          ))}
        </ul>
        <div className="ucs-deal__total">
          <span>{DEAL_TEXT.bundle_total}</span>
          <span className="ucs-deal__price">
            <b>{money(full - cut)}</b> <s>{money(full)}</s> <em>{saving}</em>
          </span>
        </div>
        <button type="button" className="ucs-deal__add">
          {f.button.replace(/\[count\]/g, String(count)).replace(/\[price\]/g, money(full - cut))}
        </button>
      </div>
    </div>
  );
}
