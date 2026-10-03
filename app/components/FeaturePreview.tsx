/**
 * Showcase previews for the Home page cards: an example of what each storefront widget looks
 * like, with illustrated sample products. Purely decorative (aria-hidden), no store data.
 */
import styles from "./FeaturePreview.module.css";

const SAMPLE = [
  { name: "Canvas tote", price: "$34", was: "$38", tint: "linear-gradient(145deg,#ffd6a5,#f4a261)" },
  { name: "Travel mug", price: "$22", was: "$25", tint: "linear-gradient(145deg,#bde0fe,#6c9bd2)" },
  { name: "Scented candle", price: "$18", was: "$20", tint: "linear-gradient(145deg,#cdb4db,#9b72b0)" },
  { name: "Linen cap", price: "$26", was: "$29", tint: "linear-gradient(145deg,#b7e4c7,#52b788)" },
];

function Thumb({ tint, size = 26 }: { tint: string; size?: number }) {
  return <span className={styles.thumb} style={{ background: tint, width: size, height: size }} />;
}

type PreviewTier = { qty: number; pct: number; label?: string; badge?: string; value?: string };

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** With no props: the Home showcase. With props: a live sketch of the offer being edited. */
export function UpsellPreview(props: { heading?: string; tiers?: PreviewTier[]; variant?: boolean; selected?: number } = {}) {
  const unit = 40;
  const source: PreviewTier[] = props.tiers ?? [
    { qty: 1, pct: 0 },
    { qty: 2, pct: 10 },
    { qty: 3, pct: 15, badge: "Most popular" },
  ];
  const tiers = source.map((t, i) => {
    const full = props.variant ? unit + 10 * i : unit * Math.max(1, t.qty || 1);
    const price = Math.round(full * (1 - (t.pct || 0) / 100) * 100) / 100;
    return {
      label: t.label || (props.variant ? t.value || `Option ${i + 1}` : `Buy ${t.qty}`),
      price: money(price),
      was: t.pct > 0 ? money(full) : "",
      save: t.pct > 0 ? `Save ${t.pct}%` : "",
      badge: t.badge,
    };
  });
  const selected = props.selected ?? Math.min(2, tiers.length - 1);
  return (
    <div className={styles.frame} aria-hidden="true">
      <div className={styles.heading}>{props.heading ?? "Buy more, save more"}</div>
      <div className={styles.tiers}>
        {tiers.map((t, i) => (
          <div key={i} className={`${styles.tier} ${i === selected ? styles.selected : ""}`}>
            {t.save || t.badge ? (
              <span className={styles.tags}>
                {t.save ? <span className={styles.save}>{t.save}</span> : null}
                {t.badge ? <span className={styles.badge}>{t.badge}</span> : null}
              </span>
            ) : null}
            <span className={styles.radio} />
            <span className={styles.tierLabel}>{t.label}</span>
            {t.was ? <s className={styles.was}>{t.was}</s> : null}
            <strong>{t.price}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CrossSellPreview(props: { heading?: string; button?: string; products?: string[]; pct?: number } = {}) {
  const items = (props.products?.length ? props.products.slice(0, 3) : SAMPLE.slice(0, 2).map((p) => p.name)).map((name, i) => {
    const sample = SAMPLE[i % SAMPLE.length];
    const full = Number(sample.was.slice(1));
    const pct = props.products ? (props.pct ?? 0) : 10;
    return { name, tint: sample.tint, price: money(Math.round(full * (1 - pct / 100) * 100) / 100), was: pct > 0 ? sample.was : "" };
  });
  return (
    <div className={styles.frame} aria-hidden="true">
      <div className={styles.heading}>{props.heading ?? "Pairs well with"}</div>
      <div className={styles.rows}>
        {items.map((p, i) => (
          <div key={i} className={styles.row}>
            <span className={`${styles.check} ${i === 0 ? styles.checked : ""}`} />
            <Thumb tint={p.tint} />
            <span className={styles.rowText}>
              <span className={styles.line}>{p.name}</span>
              <span className={styles.price}>
                {p.price} {p.was ? <s className={styles.was}>{p.was}</s> : null}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div className={styles.button}>{(props.button || "Add selected to cart") + " (1)"}</div>
    </div>
  );
}

export function VideoPreview() {
  const captions = ["Unboxing", "How to style", "In use"];
  return (
    <div className={styles.frame} aria-hidden="true">
      <div className={styles.heading}>See it in action</div>
      <div className={styles.videos}>
        {SAMPLE.slice(0, 3).map((p, i) => (
          <span key={p.name} className={styles.video} style={{ background: p.tint }}>
            <span className={styles.play} />
            <span className={styles.caption}>{captions[i]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function BundlePreview() {
  return (
    <div className={styles.frame} aria-hidden="true">
      <div className={styles.heading}>
        Build your bundle <span className={styles.count}>2 / 3</span>
      </div>
      <div className={styles.grid}>
        {SAMPLE.map((p, i) => (
          <span key={p.name} className={`${styles.tile} ${i < 2 ? styles.picked : ""}`}>
            <Thumb tint={p.tint} size={0} />
            {i < 2 ? <span className={styles.tick} /> : null}
          </span>
        ))}
      </div>
      <div className={styles.summary}>
        <span>
          Any 3 for <strong>$60</strong>
        </span>
        <s className={styles.was}>$74</s>
      </div>
      <div className={styles.button}>Choose 1 more</div>
    </div>
  );
}

/* ------------------------------------------------------- store sections -- */
const Bars = ({ widths }: { widths: number[] }) => (
  <span className={styles.bars}>
    {widths.map((w, i) => (
      <span key={i} className={styles.bar} style={{ width: `${w}%` }} />
    ))}
  </span>
);

export function ReviewsPreview() {
  const cards = [
    { name: "Mariam A.", src: styles.srcWhatsapp, stars: 5, tint: SAMPLE[0].tint },
    { name: "Youssef K.", src: styles.srcInstagram, stars: 4, tint: SAMPLE[1].tint },
  ];
  return (
    <div className={styles.frame} aria-hidden="true">
      <div className={styles.heading}>
        What customers say <span className={styles.count}>★ 4.8</span>
      </div>
      <div className={styles.reviews}>
        {cards.map((c, i) => (
          <span key={c.name} className={styles.review}>
            {i === 1 ? <span className={styles.reviewMedia} style={{ background: c.tint }} /> : null}
            <span className={styles.reviewTop}>
              <span className={styles.stars}>{"★".repeat(c.stars)}</span>
              <span className={`${styles.src} ${c.src}`} />
            </span>
            {i === 0 ? <Bars widths={[100, 92, 70]} /> : <Bars widths={[80]} />}
            <span className={styles.line}>{c.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function FaqPreview() {
  const qs = ["How long does delivery take?", "Can I pay cash on delivery?", "What is your return policy?"];
  return (
    <div className={styles.frame} aria-hidden="true">
      <div className={styles.heading}>Frequently asked questions</div>
      <div className={styles.chips}>
        {["All", "Shipping", "Returns"].map((c, i) => (
          <span key={c} className={`${styles.chip} ${i === 0 ? styles.chipOn : ""}`}>{c}</span>
        ))}
      </div>
      <div className={styles.faq}>
        {qs.map((q, i) => (
          <span key={q} className={styles.faqRow}>
            <span className={styles.faqQ}>
              <span className={styles.line}>{q}</span>
              <span>{i === 0 ? "−" : "+"}</span>
            </span>
            {i === 0 ? <Bars widths={[85, 55]} /> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LogosPreview() {
  const rows = [
    ["VOGUE", "ELLE", "GQ", "WIRED"],
    ["Forbes", "TIME", "Esquire", "Allure"],
  ];
  return (
    <div className={styles.frame} aria-hidden="true">
      <div className={styles.heading}>Trusted by</div>
      <div className={styles.logos}>
        {rows.map((r, i) => (
          <span key={i} className={styles.logoRow} style={{ marginLeft: i ? -18 : 0 }}>
            {r.concat(r).map((l, j) => (
              <span key={j} className={styles.logo}>{l}</span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnnouncementPreview() {
  return (
    <div className={`${styles.frame} ${styles.page}`} aria-hidden="true">
      <span className={styles.annBar}>
        <span>‹</span>
        <span>🚚 Free delivery over $50</span>
        <span>›</span>
      </span>
      <span className={styles.progress} />
      <span className={styles.siteHead}>
        <span className={styles.logoMark} />
        <Bars widths={[40]} />
      </span>
      <span className={styles.pageBlocks}>
        <span style={{ background: SAMPLE[3].tint }} />
        <span style={{ background: SAMPLE[1].tint }} />
      </span>
    </div>
  );
}

export function QuickAddPreview() {
  return (
    <div className={styles.frame} aria-hidden="true">
      <div className={styles.heading}>New arrivals</div>
      <div className={styles.products}>
        {SAMPLE.slice(0, 3).map((p, i) => (
          <span key={p.name} className={styles.product}>
            <span className={styles.productImg} style={{ background: p.tint }}>
              <span className={`${styles.qa} ${i === 1 ? styles.qaDone : ""}`}>{i === 1 ? "✓" : "+"}</span>
            </span>
            <span className={styles.line}>{p.name}</span>
          </span>
        ))}
      </div>
      <div className={styles.sizes}>
        {["S", "M", "L", "XL"].map((s, i) => (
          <span key={s} className={`${styles.chip} ${i === 1 ? styles.chipOn : ""}`}>{s}</span>
        ))}
        <span className={styles.miniButton}>Add</span>
      </div>
    </div>
  );
}

export function HeroPreview() {
  return (
    <div className={styles.frame} aria-hidden="true">
      <div className={styles.heroWrap}>
        <span className={styles.hero} style={{ background: SAMPLE[1].tint }}>
          <span className={styles.heroTitle}>New collection</span>
          <Bars widths={[60]} />
          <span className={styles.heroBtn}>Shop now</span>
          <span className={styles.device}>Desktop</span>
        </span>
        <span className={`${styles.hero} ${styles.heroPhone}`} style={{ background: SAMPLE[2].tint }}>
          <span className={styles.heroTitle}>New</span>
          <span className={styles.heroBtn}>Shop</span>
          <span className={styles.device}>Mobile</span>
        </span>
      </div>
    </div>
  );
}

export function CountdownPreview() {
  return (
    <div className={`${styles.frame} ${styles.center}`} aria-hidden="true">
      <div className={styles.heading}>Hurry — the sale ends soon</div>
      <span className={styles.timer}>
        {[["02", "Days"], ["14", "Hours"], ["36", "Min"], ["09", "Sec"]].map(([n, l]) => (
          <span key={l} className={styles.unit}>
            <span className={styles.digit}>{n}</span>
            <span className={styles.unitLabel}>{l}</span>
          </span>
        ))}
      </span>
      <span className={styles.miniButton}>Shop now</span>
    </div>
  );
}

export function CountdownBarPreview() {
  return (
    <div className={`${styles.frame} ${styles.page}`} aria-hidden="true">
      <span className={styles.siteHead}>
        <span className={styles.logoMark} />
        <Bars widths={[40]} />
      </span>
      <span className={styles.pageBlocks}>
        <span style={{ background: SAMPLE[0].tint }} />
        <span style={{ background: SAMPLE[3].tint }} />
      </span>
      <span className={styles.cdBar}>
        <span>Ends in</span>
        {["05", "12", "44"].map((n) => (
          <span key={n} className={styles.cdDigit}>{n}</span>
        ))}
        <span className={styles.cdBtn}>Shop now</span>
      </span>
    </div>
  );
}
