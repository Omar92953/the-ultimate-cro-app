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

